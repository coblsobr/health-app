import * as SQLite from 'expo-sqlite';

/**
 * Local database. Everything the app knows lives here first; the sync server
 * (Phase 10) will mirror these same tables.
 *
 * Two rules that make later sync straightforward, applied from the first
 * migration rather than retrofitted:
 *   - every row has a text `id` (uuid), not an autoincrement int
 *   - every row carries `user_id`, so multiple profiles need no schema change
 */

export const LOCAL_USER = 'local';

export type Recipe = {
  id: string;
  user_id: string;
  name: string;
  source_url: string | null;
  photo_uri: string | null;
  servings: number;
  prep_min: number | null;
  cook_min: number | null;
  rating: number | null; // out of 10
  is_favorite: number; // 0 | 1 — SQLite has no boolean
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Per serving. Populated by import when the source publishes it; Phase 3
  // will estimate the rest from the ingredient list.
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  /** 'published' (from the source) or 'estimated'. Always shown to the user. */
  nutrition_source: string | null;
};

export type Ingredient = {
  id: string;
  recipe_id: string;
  position: number;
  raw_text: string;
  is_primary: number;
};

export type Step = {
  id: string;
  recipe_id: string;
  position: number;
  text: string;
};

export type RecipeFull = Recipe & { ingredients: Ingredient[]; steps: Step[]; tags: string[] };

let readyPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Opens the database and creates the tables, once. Every public function below
 * awaits this, so screens never need to sequence startup themselves.
 *
 * The timeout matters: on web, `openDatabaseAsync` hangs indefinitely rather
 * than rejecting when the page is not cross-origin isolated (expo-sqlite runs
 * as WebAssembly there and needs SharedArrayBuffer). Without it the caller
 * waits forever with nothing logged. Native is unaffected.
 */
function ready(timeoutMs = 8000): Promise<SQLite.SQLiteDatabase> {
  if (!readyPromise) {
    readyPromise = Promise.race([
      openAndMigrate(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Local storage is unavailable here.')), timeoutMs)
      ),
    ]).catch((e) => {
      readyPromise = null; // let a later attempt retry rather than caching the failure
      throw e;
    });
  }
  return readyPromise;
}

/** Eagerly warm the database at startup. Callers may ignore the result. */
export function initDb() {
  return ready();
}

async function openAndMigrate() {
  const db = await SQLite.openDatabaseAsync('health.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS recipes (
      id          TEXT PRIMARY KEY NOT NULL,
      user_id     TEXT NOT NULL DEFAULT 'local',
      name        TEXT NOT NULL,
      source_url  TEXT,
      photo_uri   TEXT,
      servings    INTEGER NOT NULL DEFAULT 4,
      prep_min    INTEGER,
      cook_min    INTEGER,
      rating      INTEGER,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      notes       TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      deleted_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id         TEXT PRIMARY KEY NOT NULL,
      recipe_id  TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      position   INTEGER NOT NULL,
      raw_text   TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS recipe_steps (
      id        TEXT PRIMARY KEY NOT NULL,
      recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      position  INTEGER NOT NULL,
      text      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipe_tags (
      recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      tag       TEXT NOT NULL,
      PRIMARY KEY (recipe_id, tag)
    );

    -- One row per planned meal, keyed by date. There is deliberately no
    -- "week" table: weeks are just a date range, so nothing breaks at a week
    -- boundary and a plan can be any length.
    CREATE TABLE IF NOT EXISTS meal_plan_entries (
      id          TEXT PRIMARY KEY NOT NULL,
      user_id     TEXT NOT NULL DEFAULT 'local',
      date        TEXT NOT NULL,                    -- YYYY-MM-DD
      slot        TEXT NOT NULL,                    -- breakfast | lunch | dinner | snack
      recipe_id   TEXT REFERENCES recipes(id) ON DELETE CASCADE,
      servings    REAL NOT NULL DEFAULT 1,
      -- A meal-prep batch is cooked once and eaten several times. The cooked
      -- meal carries is_leftover = 0; the repeats share its batch_id so the
      -- grocery list counts the ingredients once, not once per serving.
      is_leftover INTEGER NOT NULL DEFAULT 0,
      batch_id    TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      deleted_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS grocery_items (
      id           TEXT PRIMARY KEY NOT NULL,
      user_id      TEXT NOT NULL DEFAULT 'local',
      name         TEXT NOT NULL,
      aisle        TEXT NOT NULL DEFAULT 'Other',
      qty_text     TEXT,
      is_purchased INTEGER NOT NULL DEFAULT 0,
      source       TEXT NOT NULL DEFAULT 'plan',   -- 'plan' | 'manual'
      -- Stable identity for an item across rebuilds, so ticking something off
      -- survives regenerating the list from a changed plan.
      item_key     TEXT,
      recipes      TEXT,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL,
      deleted_at   TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_grocery ON grocery_items(user_id, deleted_at);
    CREATE INDEX IF NOT EXISTS idx_plan_date  ON meal_plan_entries(user_id, date, deleted_at);
    CREATE INDEX IF NOT EXISTS idx_plan_batch ON meal_plan_entries(batch_id);
    CREATE INDEX IF NOT EXISTS idx_ing_recipe  ON recipe_ingredients(recipe_id);
    CREATE INDEX IF NOT EXISTS idx_step_recipe ON recipe_steps(recipe_id);
    CREATE INDEX IF NOT EXISTS idx_recipe_user ON recipes(user_id, deleted_at);
  `);

  await ensureColumns(db, 'recipes', {
    kcal: 'INTEGER',
    protein_g: 'INTEGER',
    carbs_g: 'INTEGER',
    fat_g: 'INTEGER',
    fiber_g: 'INTEGER',
    sugar_g: 'INTEGER',
    sodium_mg: 'INTEGER',
    nutrition_source: 'TEXT',
  });

  return db;
}

/**
 * Add any missing columns to an existing table.
 *
 * Checking the live schema rather than tracking a version number keeps
 * migrations idempotent and safe to reorder — important while the schema is
 * still moving and a phone may be several versions behind.
 */
async function ensureColumns(
  db: SQLite.SQLiteDatabase,
  table: string,
  columns: Record<string, string>
) {
  const existing = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  const have = new Set(existing.map((c) => c.name));
  for (const [name, type] of Object.entries(columns)) {
    if (!have.has(name)) {
      await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
    }
  }
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const now = () => new Date().toISOString();

export type RecipeInput = {
  name: string;
  servings: number;
  prepMin: number | null;
  cookMin: number | null;
  sourceUrl: string | null;
  photoUri: string | null;
  notes: string | null;
  rating: number | null;
  ingredients: { text: string; isPrimary: boolean }[];
  steps: string[];
  tags: string[];
  /** Per serving. Omit when unknown. */
  nutrition?: {
    kcal: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    fiber: number | null;
    sugar: number | null;
    sodium: number | null;
    source: 'published' | 'estimated';
  } | null;
};

export async function listRecipes(): Promise<Recipe[]> {
  const db = await ready();
  return db.getAllAsync<Recipe>(
    `SELECT * FROM recipes WHERE deleted_at IS NULL AND user_id = ? ORDER BY created_at DESC`,
    [LOCAL_USER]
  );
}

export async function getRecipe(id: string): Promise<RecipeFull | null> {
  const db = await ready();
  const recipe = await db.getFirstAsync<Recipe>(`SELECT * FROM recipes WHERE id = ?`, [id]);
  if (!recipe) return null;

  const [ingredients, steps, tagRows] = await Promise.all([
    db.getAllAsync<Ingredient>(`SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY position`, [id]),
    db.getAllAsync<Step>(`SELECT * FROM recipe_steps WHERE recipe_id = ? ORDER BY position`, [id]),
    db.getAllAsync<{ tag: string }>(`SELECT tag FROM recipe_tags WHERE recipe_id = ?`, [id]),
  ]);

  return { ...recipe, ingredients, steps, tags: tagRows.map((t) => t.tag) };
}

/** Insert when `id` is omitted, replace the children when it is given. */
export async function saveRecipe(input: RecipeInput, id?: string): Promise<string> {
  const db = await ready();
  const recipeId = id ?? uid();
  const ts = now();
  const n = input.nutrition ?? null;

  await db.withTransactionAsync(async () => {
    if (id) {
      await db.runAsync(
        `UPDATE recipes SET name=?, servings=?, prep_min=?, cook_min=?, source_url=?,
           photo_uri=?, notes=?, rating=?, updated_at=?,
           kcal=?, protein_g=?, carbs_g=?, fat_g=?, fiber_g=?, sugar_g=?, sodium_mg=?,
           nutrition_source=? WHERE id=?`,
        [input.name, input.servings, input.prepMin, input.cookMin, input.sourceUrl,
         input.photoUri, input.notes, input.rating, ts,
         n?.kcal ?? null, n?.protein ?? null, n?.carbs ?? null, n?.fat ?? null,
         n?.fiber ?? null, n?.sugar ?? null, n?.sodium ?? null, n?.source ?? null, id]
      );
      // Children are small; replacing them wholesale is simpler and safer than
      // diffing, and avoids orphaned rows when items are reordered or removed.
      await db.runAsync(`DELETE FROM recipe_ingredients WHERE recipe_id = ?`, [id]);
      await db.runAsync(`DELETE FROM recipe_steps WHERE recipe_id = ?`, [id]);
      await db.runAsync(`DELETE FROM recipe_tags WHERE recipe_id = ?`, [id]);
    } else {
      await db.runAsync(
        `INSERT INTO recipes (id, user_id, name, source_url, photo_uri, servings, prep_min,
           cook_min, rating, is_favorite, notes, created_at, updated_at,
           kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, nutrition_source)
         VALUES (?,?,?,?,?,?,?,?,?,0,?,?,?,?,?,?,?,?,?,?,?)`,
        [recipeId, LOCAL_USER, input.name, input.sourceUrl, input.photoUri, input.servings,
         input.prepMin, input.cookMin, input.rating, input.notes, ts, ts,
         n?.kcal ?? null, n?.protein ?? null, n?.carbs ?? null, n?.fat ?? null,
         n?.fiber ?? null, n?.sugar ?? null, n?.sodium ?? null, n?.source ?? null]
      );
    }

    for (let i = 0; i < input.ingredients.length; i++) {
      const ing = input.ingredients[i];
      if (!ing.text.trim()) continue;
      await db.runAsync(
        `INSERT INTO recipe_ingredients (id, recipe_id, position, raw_text, is_primary) VALUES (?,?,?,?,?)`,
        [uid(), recipeId, i, ing.text.trim(), ing.isPrimary ? 1 : 0]
      );
    }

    for (let i = 0; i < input.steps.length; i++) {
      const text = input.steps[i].trim();
      if (!text) continue;
      await db.runAsync(
        `INSERT INTO recipe_steps (id, recipe_id, position, text) VALUES (?,?,?,?)`,
        [uid(), recipeId, i, text]
      );
    }

    for (const tag of input.tags) {
      await db.runAsync(`INSERT OR IGNORE INTO recipe_tags (recipe_id, tag) VALUES (?,?)`, [recipeId, tag]);
    }
  });

  return recipeId;
}

export async function toggleFavorite(id: string, on: boolean) {
  const db = await ready();
  await db.runAsync(`UPDATE recipes SET is_favorite = ?, updated_at = ? WHERE id = ?`, [on ? 1 : 0, now(), id]);
}

export async function setRating(id: string, rating: number | null) {
  const db = await ready();
  await db.runAsync(`UPDATE recipes SET rating = ?, updated_at = ? WHERE id = ?`, [rating, now(), id]);
}

/** Soft delete — keeps the row so sync can propagate the deletion later. */
export async function deleteRecipe(id: string) {
  const db = await ready();
  const ts = now();
  await db.runAsync(`UPDATE recipes SET deleted_at = ?, updated_at = ? WHERE id = ?`, [ts, ts, id]);
}

export async function countRecipes(): Promise<number> {
  const db = await ready();
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM recipes WHERE deleted_at IS NULL AND user_id = ?`,
    [LOCAL_USER]
  );
  return row?.n ?? 0;
}

/* ── meal plan ──────────────────────────────────────────────── */

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export type PlanEntry = {
  id: string;
  date: string;
  slot: MealSlot;
  recipe_id: string | null;
  servings: number;
  is_leftover: number;
  batch_id: string | null;
  // joined from recipes
  name: string | null;
  photo_uri: string | null;
  kcal: number | null;
  protein_g: number | null;
  recipe_servings: number | null;
};

/** Every planned meal between two dates, inclusive. */
export async function listPlan(startDate: string, endDate: string): Promise<PlanEntry[]> {
  const db = await ready();
  return db.getAllAsync<PlanEntry>(
    `SELECT e.id, e.date, e.slot, e.recipe_id, e.servings, e.is_leftover, e.batch_id,
            r.name, r.photo_uri, r.kcal, r.protein_g, r.servings AS recipe_servings
       FROM meal_plan_entries e
       LEFT JOIN recipes r ON r.id = e.recipe_id
      WHERE e.user_id = ? AND e.deleted_at IS NULL
        AND e.date >= ? AND e.date <= ?
      ORDER BY e.date, CASE e.slot
        WHEN 'breakfast' THEN 0 WHEN 'lunch' THEN 1
        WHEN 'dinner' THEN 2 ELSE 3 END`,
    [LOCAL_USER, startDate, endDate]
  );
}

export async function addPlanEntry(e: {
  date: string; slot: MealSlot; recipeId: string; servings?: number;
  isLeftover?: boolean; batchId?: string | null;
}): Promise<string> {
  const db = await ready();
  const id = uid();
  const ts = now();
  await db.runAsync(
    `INSERT INTO meal_plan_entries
       (id, user_id, date, slot, recipe_id, servings, is_leftover, batch_id, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, LOCAL_USER, e.date, e.slot, e.recipeId, e.servings ?? 1,
     e.isLeftover ? 1 : 0, e.batchId ?? null, ts, ts]
  );
  return id;
}

export async function removePlanEntry(id: string) {
  const db = await ready();
  const ts = now();
  await db.runAsync(`UPDATE meal_plan_entries SET deleted_at = ?, updated_at = ? WHERE id = ?`, [ts, ts, id]);
}

/** Clear a date range before regenerating, so a rebuild replaces rather than stacks. */
export async function clearPlanRange(startDate: string, endDate: string) {
  const db = await ready();
  const ts = now();
  await db.runAsync(
    `UPDATE meal_plan_entries SET deleted_at = ?, updated_at = ?
      WHERE user_id = ? AND deleted_at IS NULL AND date >= ? AND date <= ?`,
    [ts, ts, LOCAL_USER, startDate, endDate]
  );
}

/** Write a generated plan in one transaction. */
export async function savePlan(entries: {
  date: string; slot: MealSlot; recipeId: string; servings: number;
  isLeftover: boolean; batchId: string | null;
}[]) {
  const db = await ready();
  const ts = now();
  await db.withTransactionAsync(async () => {
    for (const e of entries) {
      await db.runAsync(
        `INSERT INTO meal_plan_entries
           (id, user_id, date, slot, recipe_id, servings, is_leftover, batch_id, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [uid(), LOCAL_USER, e.date, e.slot, e.recipeId, e.servings,
         e.isLeftover ? 1 : 0, e.batchId, ts, ts]
      );
    }
  });
}

/** A stable id for grouping one cook session with its leftovers. */
export function newBatchId() {
  return uid();
}

/* ── grocery list ───────────────────────────────────────────── */

export type GroceryItem = {
  id: string;
  name: string;
  aisle: string;
  qty_text: string | null;
  is_purchased: number;
  source: string;
  item_key: string | null;
  recipes: string | null;
};

export async function listGrocery(): Promise<GroceryItem[]> {
  const db = await ready();
  return db.getAllAsync<GroceryItem>(
    `SELECT id, name, aisle, qty_text, is_purchased, source, item_key, recipes
       FROM grocery_items
      WHERE user_id = ? AND deleted_at IS NULL
      ORDER BY is_purchased, name`,
    [LOCAL_USER]
  );
}

export async function setGroceryPurchased(id: string, on: boolean) {
  const db = await ready();
  await db.runAsync(
    `UPDATE grocery_items SET is_purchased = ?, updated_at = ? WHERE id = ?`,
    [on ? 1 : 0, now(), id]
  );
}

export async function addManualGroceryItem(name: string, qtyText: string | null = null) {
  const db = await ready();
  const ts = now();
  const id = uid();
  await db.runAsync(
    `INSERT INTO grocery_items (id, user_id, name, aisle, qty_text, is_purchased, source, item_key, created_at, updated_at)
     VALUES (?,?,?,?,?,0,'manual',?,?,?)`,
    [id, LOCAL_USER, name.trim(), 'Other', qtyText, `manual:${name.trim().toLowerCase()}`, ts, ts]
  );
  return id;
}

export async function removeGroceryItem(id: string) {
  const db = await ready();
  const ts = now();
  await db.runAsync(`UPDATE grocery_items SET deleted_at = ?, updated_at = ? WHERE id = ?`, [ts, ts, id]);
}

export async function clearPurchasedGrocery() {
  const db = await ready();
  const ts = now();
  await db.runAsync(
    `UPDATE grocery_items SET deleted_at = ?, updated_at = ?
      WHERE user_id = ? AND deleted_at IS NULL AND is_purchased = 1`,
    [ts, ts, LOCAL_USER]
  );
}

/**
 * Replace the plan-derived part of the list.
 *
 * Manual additions are left alone, and anything already ticked off stays
 * ticked — rebuilding after a plan change should not undo a shopping trip
 * already half done.
 */
export async function replacePlanGrocery(
  lines: { key: string; name: string; aisle: string; display: string; recipes: string[] }[]
) {
  const db = await ready();
  const ts = now();

  const previous = await db.getAllAsync<{ item_key: string; is_purchased: number }>(
    `SELECT item_key, is_purchased FROM grocery_items
      WHERE user_id = ? AND deleted_at IS NULL AND source = 'plan'`,
    [LOCAL_USER]
  );
  const wasPurchased = new Map(previous.map((p) => [p.item_key, p.is_purchased]));

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE grocery_items SET deleted_at = ?, updated_at = ?
        WHERE user_id = ? AND deleted_at IS NULL AND source = 'plan'`,
      [ts, ts, LOCAL_USER]
    );
    for (const l of lines) {
      await db.runAsync(
        `INSERT INTO grocery_items
           (id, user_id, name, aisle, qty_text, is_purchased, source, item_key, recipes, created_at, updated_at)
         VALUES (?,?,?,?,?,?,'plan',?,?,?,?)`,
        [uid(), LOCAL_USER, l.name, l.aisle, l.display,
         wasPurchased.get(l.key) ?? 0, l.key, l.recipes.join(', '), ts, ts]
      );
    }
  });
}

/** Ingredient lines for a set of recipes, for building the shopping list. */
export async function getIngredientsFor(
  recipeIds: string[]
): Promise<Map<string, { name: string; servings: number; lines: string[] }>> {
  const out = new Map<string, { name: string; servings: number; lines: string[] }>();
  if (recipeIds.length === 0) return out;
  const db = await ready();
  const marks = recipeIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<{ id: string; name: string; servings: number; raw_text: string | null }>(
    `SELECT r.id, r.name, r.servings, i.raw_text
       FROM recipes r
       LEFT JOIN recipe_ingredients i ON i.recipe_id = r.id
      WHERE r.id IN (${marks})
      ORDER BY r.id, i.position`,
    recipeIds
  );
  for (const row of rows) {
    let entry = out.get(row.id);
    if (!entry) {
      entry = { name: row.name, servings: row.servings, lines: [] };
      out.set(row.id, entry);
    }
    if (row.raw_text) entry.lines.push(row.raw_text);
  }
  return out;
}
