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
