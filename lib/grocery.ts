/**
 * Build a shopping list from a meal plan.
 *
 * Three things make this more than concatenating ingredient lists:
 *
 *  1. **Scaling.** A recipe serving 4 planned for 2 people needs half of it.
 *  2. **Batches.** A meal-prep batch is cooked once and eaten for days, so its
 *     ingredients are bought once for the whole batch, not once per meal.
 *  3. **Merging.** "2 onions" across three recipes is one line reading 6, and
 *     "1 lb beef" + "8 oz beef" is 1.5 lb rather than two lines.
 *
 * Pure and offline — testable without a phone or a database.
 */

import { parseIngredientLine, matchFood } from './nutrition';

/* ── aisles ─────────────────────────────────────────────────── */

export const AISLES = [
  'Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery', 'Pantry', 'Frozen', 'Other',
  // Staples from Preferences: listed last, left out of the Meijer cart.
  'Check the pantry',
] as const;
export type Aisle = (typeof AISLES)[number];

/** USDA food category -> supermarket aisle. */
const CATEGORY_AISLE: Record<number, Aisle> = {
  1: 'Dairy & Eggs',
  2: 'Pantry',          // spices and herbs
  4: 'Pantry',          // fats and oils
  5: 'Meat & Seafood',  // poultry
  6: 'Pantry',          // soups, sauces, gravies
  7: 'Meat & Seafood',  // sausages and luncheon meats
  9: 'Produce',         // fruit
  10: 'Meat & Seafood', // pork
  11: 'Produce',        // vegetables
  12: 'Pantry',         // nuts and seeds
  13: 'Meat & Seafood', // beef
  15: 'Meat & Seafood', // fish and shellfish
  16: 'Pantry',         // legumes
  17: 'Meat & Seafood', // lamb, veal, game
  18: 'Bakery',
  19: 'Pantry',         // sweets
  20: 'Pantry',         // grains and pasta
  23: 'Pantry',         // snacks
};

/* ── unit families ──────────────────────────────────────────── */

type Family = 'weight' | 'volume' | 'count';

const UNIT_FAMILY: Record<string, { family: Family; base: number; label: string }> = {
  g: { family: 'weight', base: 1, label: 'g' },
  gram: { family: 'weight', base: 1, label: 'g' },
  grams: { family: 'weight', base: 1, label: 'g' },
  kg: { family: 'weight', base: 1000, label: 'kg' },
  oz: { family: 'weight', base: 28.35, label: 'oz' },
  ounce: { family: 'weight', base: 28.35, label: 'oz' },
  ounces: { family: 'weight', base: 28.35, label: 'oz' },
  lb: { family: 'weight', base: 453.6, label: 'lb' },
  lbs: { family: 'weight', base: 453.6, label: 'lb' },
  pound: { family: 'weight', base: 453.6, label: 'lb' },
  pounds: { family: 'weight', base: 453.6, label: 'lb' },

  ml: { family: 'volume', base: 1, label: 'ml' },
  l: { family: 'volume', base: 1000, label: 'l' },
  litre: { family: 'volume', base: 1000, label: 'l' },
  liter: { family: 'volume', base: 1000, label: 'l' },
  tsp: { family: 'volume', base: 4.93, label: 'tsp' },
  teaspoon: { family: 'volume', base: 4.93, label: 'tsp' },
  teaspoons: { family: 'volume', base: 4.93, label: 'tsp' },
  tbsp: { family: 'volume', base: 14.79, label: 'tbsp' },
  tablespoon: { family: 'volume', base: 14.79, label: 'tbsp' },
  tablespoons: { family: 'volume', base: 14.79, label: 'tbsp' },
  cup: { family: 'volume', base: 236.6, label: 'cup' },
  cups: { family: 'volume', base: 236.6, label: 'cup' },
  pint: { family: 'volume', base: 473, label: 'pint' },
  quart: { family: 'volume', base: 946, label: 'quart' },

  clove: { family: 'count', base: 1, label: 'clove' },
  cloves: { family: 'count', base: 1, label: 'clove' },
  slice: { family: 'count', base: 1, label: 'slice' },
  slices: { family: 'count', base: 1, label: 'slice' },
  can: { family: 'count', base: 1, label: 'can' },
  cans: { family: 'count', base: 1, label: 'can' },
  piece: { family: 'count', base: 1, label: 'piece' },
  pieces: { family: 'count', base: 1, label: 'piece' },
  bunch: { family: 'count', base: 1, label: 'bunch' },
  sprig: { family: 'count', base: 1, label: 'sprig' },
  sprigs: { family: 'count', base: 1, label: 'sprig' },
  stalk: { family: 'count', base: 1, label: 'stalk' },
  stalks: { family: 'count', base: 1, label: 'stalk' },
  head: { family: 'count', base: 1, label: 'head' },
  heads: { family: 'count', base: 1, label: 'head' },
};

/**
 * Round an amount UP to something you can buy. Nobody buys 0.63 of an onion
 * or 24.17 cloves of garlic: counts go to whole numbers, small measures to a
 * quarter, bigger ones to a half, and large ones to a whole.
 */
export function shopAmount(n: number, counted: boolean): number {
  const up = (step: number) => Math.ceil(n / step - 0.02) * step;
  if (counted) return Math.max(1, up(1));
  if (n < 4) return up(0.25);
  if (n < 10) return up(0.5);
  return up(1);
}

/** Tidy numbers for a shopping list: 1.5, 3, 0.25 — never 1.4999999. */
export function formatQty(n: number): string {
  const r = Math.round(n * 100) / 100;
  if (Number.isInteger(r)) return String(r);
  // Common cooking fractions read better than decimals.
  const frac: [number, string][] = [[0.25, '¼'], [0.33, '⅓'], [0.5, '½'], [0.67, '⅔'], [0.75, '¾']];
  const whole = Math.floor(r);
  const rest = r - whole;
  for (const [value, glyph] of frac) {
    if (Math.abs(rest - value) < 0.04) return whole ? `${whole}${glyph}` : glyph;
  }
  return String(r);
}

/* ── the build ──────────────────────────────────────────────── */

export type PlannedRecipe = {
  recipeId: string;
  name: string;
  /** Servings the recipe itself yields. */
  recipeServings: number;
  /** Total servings this plan needs of it, already batch-aware. */
  neededServings: number;
  ingredientLines: string[];
};

export type GroceryLine = {
  key: string;
  name: string;
  aisle: Aisle;
  /** "3", "1.5 lb", "500 g + 2 tbsp" — ready to display. */
  display: string;
  recipes: string[];
  /**
   * What to type into a shop's search box: the recipes' own words ("cherry
   * tomatoes", "parmesan cheese"), not the USDA name ("Cheese, parmesan"),
   * which searches badly.
   */
  search: string;
};

/** Amount and packaging words that are not part of what to search for. */
const NOT_SEARCH = /\b(?:\d+|oz|ounces?|cans?|pt|pints?|pkg|packages?|jars?|lbs?|pounds?|inch|large|small|medium|plus|tbsps?|tsps?|cups?|handful|loosely|pinch|twelve|one|two|three|four)\b|-/g;

export function searchPhrase(food: string): string {
  return food
    // The recipe author talking: "vegan cream see notes", "i used violife".
    .replace(/\b(?:see notes?|i used|such as|we like|optional)\b.*$/, '')
    // "flank steak or your favorite cut" — the first choice is the one to buy.
    .replace(/\s+or\s+.*$/, '')
    .replace(NOT_SEARCH, ' ').replace(/\s+/g, ' ').trim();
}

type Bucket = {
  name: string;
  aisle: Aisle;
  byFamily: Map<Family, { total: number; unitLabel: string; unitBase: number; largest: number }>;
  /** Contributions with no recognisable unit, kept verbatim. */
  loose: string[];
  recipes: Set<string>;
  /** Each recipe phrase that landed here, and how often. */
  phrases: Map<string, number>;
};

/**
 * Collapse a plan into a shopping list.
 *
 * `planned` must already account for batches: pass the *total* servings needed
 * of each recipe across the whole plan, not one entry per meal.
 */
export function buildGroceryList(planned: PlannedRecipe[]): GroceryLine[] {
  const buckets = new Map<string, Bucket>();

  for (const r of planned) {
    const scale = r.recipeServings > 0 ? r.neededServings / r.recipeServings : 1;

    for (const line of r.ingredientLines) {
      const parsed = parseIngredientLine(line);
      if (!parsed.food) continue;
      // Water is not shopping.
      if (/(?:^|\s)water$/.test(parsed.food)) continue;

      // A phrase the parser left packaging on ("-ounce cans chickpeas") gets a
      // second try with that stripped.
      const food = matchFood(parsed.food) ?? matchFood(searchPhrase(parsed.food));
      // Match on the USDA food where possible, so "yellow onion" and "onions"
      // land on the same shopping line instead of two.
      const key = (food?.n ?? searchPhrase(parsed.food) ?? parsed.food).toLowerCase();
      const aisle: Aisle = (food && CATEGORY_AISLE[food.c]) || 'Other';
      const plain = searchPhrase(parsed.food) || parsed.food;
      const displayName = food ? tidyFoodName(food.n) : plain.charAt(0).toUpperCase() + plain.slice(1);

      let b = buckets.get(key);
      if (!b) {
        b = { name: displayName, aisle, byFamily: new Map(), loose: [], recipes: new Set(), phrases: new Map() };
        buckets.set(key, b);
      }
      b.recipes.add(r.name);
      const phrase = searchPhrase(parsed.food);
      if (phrase) b.phrases.set(phrase, (b.phrases.get(phrase) ?? 0) + 1);

      const qty = parsed.qty != null ? parsed.qty * scale : null;
      const unitDef = parsed.unit ? UNIT_FAMILY[parsed.unit] : undefined;

      if (qty == null) {
        // "Salt to taste" — no number to scale, so say so rather than invent one.
        if (!b.loose.includes('to taste')) b.loose.push('to taste');
        continue;
      }

      if (!parsed.unit) {
        // A bare count: "2 onions".
        const fam = b.byFamily.get('count') ?? { total: 0, unitLabel: '', unitBase: 1, largest: 0 };
        fam.total += qty;
        b.byFamily.set('count', fam);
        continue;
      }

      if (!unitDef) {
        b.loose.push(`${formatQty(qty)} ${parsed.unit}`);
        continue;
      }

      const grams = qty * unitDef.base;
      const fam = b.byFamily.get(unitDef.family) ?? {
        total: 0, unitLabel: unitDef.label, unitBase: unitDef.base, largest: 0,
      };
      fam.total += grams;
      // Report in the unit of the biggest single contribution: "1 lb + 8 oz"
      // reads as 1.5 lb, not 680 g.
      if (grams > fam.largest) {
        fam.largest = grams;
        fam.unitLabel = unitDef.label;
        fam.unitBase = unitDef.base;
      }
      b.byFamily.set(unitDef.family, fam);
    }
  }

  const lines: GroceryLine[] = [];
  for (const [key, b] of buckets) {
    const parts: string[] = [];
    for (const [, fam] of b.byFamily) {
      const value = shopAmount(fam.total / fam.unitBase, !fam.unitLabel || COUNTABLE.has(fam.unitLabel));
      // A bare count has no label ("3 onions"); a counted unit keeps one and
      // needs pluralising ("3 cloves", not "3 clove").
      parts.push(fam.unitLabel ? `${formatQty(value)} ${pluralise(fam.unitLabel, value)}` : formatQty(value));
    }
    parts.push(...b.loose);
    // Most common wording wins; a tie goes to the shorter, plainer one.
    const search = [...b.phrases.entries()].sort((x, y) => y[1] - x[1] || x[0].length - y[0].length)[0]?.[0] ?? b.name;
    lines.push({
      search,
      key,
      name: b.name,
      aisle: b.aisle,
      display: parts.join(' + ') || '—',
      recipes: [...b.recipes],
    });
  }

  // Aisle order matches how a shop is walked, then alphabetical within it.
  return lines.sort((a, b) => {
    const ai = AISLES.indexOf(a.aisle) - AISLES.indexOf(b.aisle);
    return ai !== 0 ? ai : a.name.localeCompare(b.name);
  });
}

/** Units that take an -s; weights and volumes never do ("3 lb", not "3 lbs"). */
const COUNTABLE = new Set(['clove', 'slice', 'can', 'piece', 'bunch', 'sprig', 'stalk', 'head']);

function pluralise(label: string, n: number): string {
  if (n === 1 || !COUNTABLE.has(label)) return label;
  return label.endsWith('h') ? label + 'es' : label + 's';
}

/** "Onions, raw" -> "Onions". Shopping lists do not need USDA qualifiers. */
export function tidyFoodName(usdaName: string): string {
  const segs = usdaName.split(',').map((s) => s.trim());
  const drop = /^(raw|cooked|fresh|dried|canned|frozen|unenriched|enriched|salted|unsalted|whole|regular|all|without.*|with.*|large or small curd|table)$/i;
  const kept = segs.filter((s, i) => i === 0 || !drop.test(s));
  const name = kept.slice(0, 2).join(', ');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Total servings needed per recipe, counting a meal-prep batch once.
 *
 * Every entry sharing a batch_id was cooked in one session, so its servings
 * add up to a single scaling of the recipe rather than one per meal.
 */
export function servingsByRecipe(
  entries: { recipe_id: string | null; servings: number; batch_id: string | null }[]
): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of entries) {
    if (!e.recipe_id) continue;
    out.set(e.recipe_id, (out.get(e.recipe_id) ?? 0) + e.servings);
  }
  return out;
}
