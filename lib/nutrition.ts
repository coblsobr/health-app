/**
 * Estimate a recipe's nutrition from its ingredient lines.
 *
 * Used only when the source publishes nothing. Everything is rule-based and
 * offline: parse the line, convert to grams, match a USDA food, sum, divide by
 * servings. Results are always labelled "estimated" and every ingredient
 * reports how it was matched, so a wrong number is visible rather than hidden.
 *
 * Data: USDA FoodData Central SR Legacy (public domain), trimmed to cooking
 * ingredients in `foods.json`, including USDA's own measured gram weights per
 * cup/tbsp/tsp/each — real weights rather than assumed densities.
 */

import FOODS_RAW from './foods.json';

export type FoodEntry = {
  n: string;            // description, e.g. "Onions, raw"
  c: number;            // USDA category id
  kcal: number;         // per 100 g
  p: number; f: number; ch: number; fb: number; sg: number; na: number;
  g?: { cup?: number; tbsp?: number; tsp?: number; each?: number };
};

const FOODS = FOODS_RAW as FoodEntry[];

export type ParsedIngredient = {
  qty: number | null;
  unit: string | null;
  food: string;
  raw: string;
};

export type IngredientMatch = {
  raw: string;
  food: string;
  matchedName: string | null;
  grams: number | null;
  kcal: number; protein: number; fat: number; carbs: number;
  fiber: number; sugar: number; sodium: number;
  /** Why this line contributed nothing, when it did not. */
  reason?: 'no-match' | 'no-quantity' | 'not-food';
};

export type Estimate = {
  perServing: {
    kcal: number; protein: number; fat: number; carbs: number;
    fiber: number; sugar: number; sodium: number;
  };
  matches: IngredientMatch[];
  matchedCount: number;
  totalCount: number;
  /** Share of lines that produced a number — the honest confidence signal. */
  coverage: number;
};

/* ── quantities ─────────────────────────────────────────────── */

const VULGAR: Record<string, number> = {
  '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

/**
 * Read a leading quantity and return it with the remaining text.
 *
 * Order matters. Matching a leading integer first swallows the numerator of
 * "1/2", which then parses as 1 — a silent 2x error on every fraction in
 * every recipe. The most specific shapes are tried first.
 */
export function takeQuantity(s: string): { qty: number | null; rest: string } {
  const text = s.trim();
  if (!text) return { qty: null, rest: s };

  const take = (m: RegExpMatchArray | null, value: number) =>
    m ? { qty: value, rest: text.slice(m[0].length) } : null;

  // "2-3 onions" is neither 2 nor 3; the midpoint is the honest reading.
  // The lookahead keeps "1-1/2" (a written mixed number) out of this branch.
  const range = text.match(/^(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)(?!\s*\/)/);
  if (range) return take(range, (parseFloat(range[1]) + parseFloat(range[2])) / 2)!;

  const mixed = text.match(/^(\d+)[\s-]+(\d+)\s*\/\s*(\d+)/);
  if (mixed) return take(mixed, parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / parseInt(mixed[3], 10))!;

  const mixedVulgar = text.match(/^(\d+)\s*([¼½¾⅓⅔⅛⅜⅝⅞])/);
  if (mixedVulgar) return take(mixedVulgar, parseInt(mixedVulgar[1], 10) + VULGAR[mixedVulgar[2]])!;

  const frac = text.match(/^(\d+)\s*\/\s*(\d+)/);
  if (frac) {
    const d = parseInt(frac[2], 10);
    if (d) return take(frac, parseInt(frac[1], 10) / d)!;
  }

  const vulgar = text.match(/^([¼½¾⅓⅔⅛⅜⅝⅞])/);
  if (vulgar) return take(vulgar, VULGAR[vulgar[1]])!;

  const plain = text.match(/^(\d+(?:\.\d+)?)/);
  if (plain) return take(plain, parseFloat(plain[1]))!;

  return { qty: null, rest: s };
}

/** "1 1/2" | "1/2" | "½" | "1½" | "2-3" | "1.5" → a number. */
export function parseQuantity(s: string): number | null {
  return takeQuantity(s).qty;
}

/* ── units ──────────────────────────────────────────────────── */

type UnitKind = 'weight' | 'volume' | 'count';
type UnitDef = { kind: UnitKind; grams?: number; ml?: number; key?: 'cup' | 'tbsp' | 'tsp' | 'each' };

const UNITS: Record<string, UnitDef> = {
  g: { kind: 'weight', grams: 1 }, gram: { kind: 'weight', grams: 1 }, grams: { kind: 'weight', grams: 1 },
  kg: { kind: 'weight', grams: 1000 }, kilogram: { kind: 'weight', grams: 1000 }, kilograms: { kind: 'weight', grams: 1000 },
  oz: { kind: 'weight', grams: 28.35 }, ounce: { kind: 'weight', grams: 28.35 }, ounces: { kind: 'weight', grams: 28.35 },
  lb: { kind: 'weight', grams: 453.6 }, lbs: { kind: 'weight', grams: 453.6 },
  pound: { kind: 'weight', grams: 453.6 }, pounds: { kind: 'weight', grams: 453.6 },

  cup: { kind: 'volume', ml: 236.6, key: 'cup' }, cups: { kind: 'volume', ml: 236.6, key: 'cup' },
  tbsp: { kind: 'volume', ml: 14.8, key: 'tbsp' }, tablespoon: { kind: 'volume', ml: 14.8, key: 'tbsp' },
  tablespoons: { kind: 'volume', ml: 14.8, key: 'tbsp' },
  tsp: { kind: 'volume', ml: 4.9, key: 'tsp' }, teaspoon: { kind: 'volume', ml: 4.9, key: 'tsp' },
  teaspoons: { kind: 'volume', ml: 4.9, key: 'tsp' },
  ml: { kind: 'volume', ml: 1 }, millilitre: { kind: 'volume', ml: 1 }, milliliter: { kind: 'volume', ml: 1 },
  l: { kind: 'volume', ml: 1000 }, litre: { kind: 'volume', ml: 1000 }, liter: { kind: 'volume', ml: 1000 },
  litres: { kind: 'volume', ml: 1000 }, liters: { kind: 'volume', ml: 1000 },
  pint: { kind: 'volume', ml: 473 }, pints: { kind: 'volume', ml: 473 },
  quart: { kind: 'volume', ml: 946 }, quarts: { kind: 'volume', ml: 946 },

  clove: { kind: 'count', key: 'each' }, cloves: { kind: 'count', key: 'each' },
  slice: { kind: 'count', key: 'each' }, slices: { kind: 'count', key: 'each' },
  piece: { kind: 'count', key: 'each' }, pieces: { kind: 'count', key: 'each' },
  stalk: { kind: 'count', key: 'each' }, stalks: { kind: 'count', key: 'each' },
  sprig: { kind: 'count', key: 'each' }, sprigs: { kind: 'count', key: 'each' },
  head: { kind: 'count', key: 'each' }, heads: { kind: 'count', key: 'each' },
  can: { kind: 'count', key: 'each' }, cans: { kind: 'count', key: 'each' },
};

/** Volume→grams fallback when USDA has no measured weight for this food. */
const CATEGORY_G_PER_ML: Record<number, number> = {
  2: 0.42,   // spices and herbs, dried and fluffy
  4: 0.92,   // fats and oils
  20: 0.55,  // grains, flour, pasta
  12: 0.55,  // nuts and seeds
  1: 1.01,   // dairy, mostly liquid
  19: 0.85,  // sweets, sugar and syrup
};
const DEFAULT_G_PER_ML = 0.9;

/**
 * Rough per-piece weights, used only when USDA has no measured "each" weight
 * for the matched food. Better than dropping the ingredient entirely, and the
 * result is labelled estimated regardless.
 */
const CATEGORY_EACH_G: Record<number, number> = {
  9: 120,   // fruit
  11: 100,  // vegetables
  1: 50,    // dairy and egg
  20: 30,   // grains, a slice of bread
};

/* ── ingredient line → parts ────────────────────────────────── */

const UNIT_WORDS = Object.keys(UNITS).sort((a, b) => b.length - a.length);
const UNIT_ALT = UNIT_WORDS.join('|');

/** Words that describe handling, not the food itself. */
const PREP_WORDS = new RegExp(
  '\\b(?:finely|roughly|thinly|coarsely|freshly|lightly|well|very|about|approximately|' +
  'chopped|minced|diced|sliced|grated|shredded|crushed|beaten|melted|softened|cubed|' +
  'peeled|seeded|deseeded|drained|rinsed|trimmed|halved|quartered|packed|sifted|' +
  'plus more|to taste|for serving|for garnish|optional|divided|room temperature|' +
  'at room temperature|cold|warm|hot|large|medium|small|ripe|extra)\\b',
  'gi'
);

export function parseIngredientLine(raw: string): ParsedIngredient {
  let s = raw.trim();

  // Drop leading bullets and step numbers.
  s = s.replace(/^[\s•·▪●\-–—*]+/, '');

  const { qty, rest } = takeQuantity(s);
  s = rest.replace(/^\s+/, '');

  // Unit directly after the quantity.
  let unit: string | null = null;
  const um = s.match(new RegExp('^\\s*(' + UNIT_ALT + ')\\b\\.?\\s*', 'i'));
  if (um) {
    unit = um[1].toLowerCase();
    s = s.slice(um[0].length);
  }

  // Metric-in-parentheses is the more precise figure: "1 lb (450 g) beef".
  const paren = s.match(/^\s*\(([^)]*)\)\s*/);
  if (paren) s = s.slice(paren[0].length);

  // Everything before the first comma is the food; the rest is preparation.
  let food = s.split(',')[0];
  food = food.replace(/\([^)]*\)/g, ' ');       // "(all-purpose)"
  food = food.replace(PREP_WORDS, ' ');
  food = food.replace(/\b(?:of|the|a|an|and)\b/gi, ' ');
  food = food.replace(/[^\p{L}\s-]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

  return { qty, unit, food, raw };
}

/* ── food matching ──────────────────────────────────────────── */

function singular(w: string): string {
  if (w.length > 3 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 3 && w.endsWith('oes')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('es') && /(?:ch|sh|ss|x|z)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

const tokens = (s: string) =>
  s.toLowerCase().split(/[^a-z]+/).filter((t) => t.length > 1).map(singular);

/**
 * USDA descriptions read "Category, food, qualifier, qualifier". A single
 * segment is not enough to identify the food: "Spices, caraway seed" and
 * "Leavening agents, baking powder" both hide the real name in segment two.
 * So identity spans the first two segments, and the taxonomy words below are
 * not counted against a candidate that carries them.
 */
const TAXONOMY = new Set([
  'spice', 'leavening', 'agent', 'soup', 'sauce', 'gravy', 'snack', 'beverage',
  'babyfood', 'cereal', 'grain', 'pasta', 'product', 'food', 'meal', 'entree',
  'formulated', 'bar', 'supplement',
]);

/** Cooking states that change nutrition, so never assume them silently. */
const COOKED = new Set([
  'sauteed', 'boiled', 'fried', 'roasted', 'baked', 'grilled', 'broiled',
  'steamed', 'braised', 'stewed', 'microwaved', 'dehydrated', 'canned',
  'creamed', 'breaded', 'battered', 'candied', 'pickled', 'smoked',
]);

const INDEX = FOODS.map((f) => {
  const segs = f.n.split(',');
  const identity = tokens(segs.slice(0, 2).join(' '));
  return {
    food: f,
    head: new Set(identity),
    all: new Set(tokens(f.n)),
    len: f.n.length,
  };
});

/**
 * Words that describe an amount or a cut, not the food. "4 garlic cloves" has
 * head noun "clove", which is not a food — step back to the real noun.
 */
const COUNT_NOUNS = new Set(['clove', 'slice', 'piece', 'stalk', 'sprig', 'head', 'can', 'sheet', 'bunch', 'stick']);

/** Common to thousands of entries, so matching one says almost nothing. */
const WEAK = new Set(['raw', 'cooked', 'fresh', 'dried', 'canned', 'frozen', 'prepared', 'unprepared', 'with', 'without', 'and', 'or', 'all', 'type', 'commercially', 'home']);

/**
 * Staples where the plain English name is genuinely ambiguous in USDA terms.
 * "flour" scores identically against carob, soy and wheat flour, and nothing
 * in the data says which one a recipe means — so say it here rather than let
 * the tie break at random. Values are matched as substrings, most specific
 * first.
 */
const ALIASES: [RegExp, string][] = [
  [/^(?:plain |all[- ]?purpose |ap |white )?flour$/, 'Wheat flour, white, all-purpose, unenriched'],
  [/^(?:bread )?flour$/, 'Wheat flours, bread, unenriched'],
  [/^whole ?(?:wheat|grain) flour$/, 'Wheat flour, whole-grain, soft wheat'],
  [/^(?:granulated |white |caster )?sugar$/, 'Sugars, granulated'],
  [/^brown sugar$/, 'Sugars, brown'],
  [/^(?:whole )?milk$/, 'Milk, whole, 3.25% milkfat, with added vitamin D'],
  [/^eggs?$/, 'Egg, whole, raw, fresh'],
  [/^(?:sea |kosher |table )?salt$/, 'Salt, table'],
  [/^(?:black )?pepper$/, 'Spices, pepper, black'],
  [/^(?:extra[- ]virgin |virgin )?olive oil$/, 'Oil, olive, salad or cooking'],
  [/^(?:vegetable|canola|sunflower) oil$/, 'Oil, vegetable, soybean, refined'],
  [/^(?:white |long[- ]grain )*rice$/, 'Rice, white, long-grain, regular, raw, enriched'],
  [/chicken breasts?$/, 'Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw'],
  [/^(?:full[- ]fat )?cottage cheese$/, 'Cheese, cottage, creamed, large or small curd'],
  [/^sour cream$/, 'Cream, sour, cultured'],
  [/^heavy (?:whipping )?cream$/, 'Cream, fluid, heavy whipping'],
  [/^baking powder$/, 'Leavening agents, baking powder, double-acting, straight phosphate'],
  [/^baking soda$/, 'Leavening agents, baking soda'],
  [/^butter$/, 'Butter, salted'],
];

const BY_NAME = new Map(FOODS.map((f) => [f.n.toLowerCase(), f]));

/** Water contributes nothing and should not be reported as unmatched. */
const ZERO_FOODS = /^(?:water|ice|cold water|warm water|boiling water)$/;

export function matchFood(foodPhrase: string): FoodEntry | null {
  const phrase = foodPhrase.trim().toLowerCase();

  for (const [re, target] of ALIASES) {
    if (re.test(phrase)) {
      const hit = BY_NAME.get(target.toLowerCase());
      if (hit) return hit;
    }
  }

  const want = tokens(foodPhrase).filter((t) => !COUNT_NOUNS.has(t));
  if (want.length === 0) return null;

  const wantSet = new Set(want);
  // The last remaining word is normally the head noun: "plain flour" -> flour.
  const headNoun = want[want.length - 1];

  let best: { entry: FoodEntry; score: number } | null = null;

  for (const cand of INDEX) {
    let score = 0;
    if (cand.head.has(headNoun)) score += 10;
    else if (cand.all.has(headNoun)) score += 4;
    else continue; // the head noun must appear somewhere, or this is not the food

    // Reward the ingredient's other words, and dock a little when one is
    // absent — recipes say "sea salt" where USDA says "Salt, table", so a
    // missing modifier must not be disqualifying.
    for (const t of want) {
      if (t === headNoun) continue;
      if (cand.head.has(t)) score += 4;
      else if (cand.all.has(t)) score += 2;
      else score -= 1.5;
    }

    // Words the candidate adds that were never asked for. The position matters:
    // everything before the first comma defines what the food *is* ("Fish
    // broth"), while later words are just qualifiers ("Oil, olive, salad or
    // cooking"). Penalising both equally either lets fish broth win or throws
    // olive oil away.
    for (const t of cand.head) {
      if (wantSet.has(t) || WEAK.has(t) || TAXONOMY.has(t)) continue;
      score -= 3.5;
    }
    for (const t of cand.all) {
      if (wantSet.has(t) || WEAK.has(t) || cand.head.has(t)) continue;
      score -= 0.35;
    }

    // A cooking method the recipe never asked for is a real nutrition
    // difference, not a wording quirk — "Onions, yellow, sauteed" carries the
    // oil it was cooked in.
    for (const t of COOKED) {
      if (cand.all.has(t) && !wantSet.has(t)) score -= 4.5;
    }

    // Nudge towards plain forms over elaborate ones.
    if (cand.all.has('raw')) score += 1.5;
    score -= cand.len * 0.01;

    if (!best || score > best.score) best = { entry: cand.food, score };
  }

  return best && best.score >= 4 ? best.entry : null;
}

/* ── grams ──────────────────────────────────────────────────── */

export function toGrams(qty: number, unit: string | null, food: FoodEntry): number | null {
  // No unit: a count, like "2 eggs" or "1 onion".
  if (!unit) {
    const each = food.g?.each ?? CATEGORY_EACH_G[food.c];
    return each ? qty * each : null;
  }

  const def = UNITS[unit];
  if (!def) return null;

  if (def.kind === 'weight') return qty * (def.grams ?? 1);

  if (def.kind === 'count') {
    const each = food.g?.each ?? CATEGORY_EACH_G[food.c];
    return each ? qty * each : null;
  }

  // Volume: use USDA's measured weight for this food where it exists.
  const measured = def.key ? food.g?.[def.key] : undefined;
  if (measured) return qty * measured;

  const gPerMl = CATEGORY_G_PER_ML[food.c] ?? DEFAULT_G_PER_ML;
  return qty * (def.ml ?? 0) * gPerMl;
}

/* ── the estimate ───────────────────────────────────────────── */

export function estimateRecipe(ingredientLines: string[], servings: number): Estimate {
  const serv = Math.max(1, servings || 1);
  const totals = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, sodium: 0 };
  const matches: IngredientMatch[] = [];

  for (const raw of ingredientLines) {
    const p = parseIngredientLine(raw);
    const blank: IngredientMatch = {
      raw, food: p.food, matchedName: null, grams: null,
      kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, sodium: 0,
    };

    if (!p.food) {
      matches.push({ ...blank, reason: 'not-food' });
      continue;
    }

    // Water adds nothing; counting it as a miss would understate coverage.
    if (ZERO_FOODS.test(p.food)) {
      matches.push({ ...blank, matchedName: 'Water', grams: 0 });
      continue;
    }

    const food = matchFood(p.food);
    if (!food) {
      matches.push({ ...blank, reason: 'no-match' });
      continue;
    }

    const grams = p.qty != null ? toGrams(p.qty, p.unit, food) : null;
    if (grams == null || !isFinite(grams) || grams <= 0) {
      matches.push({ ...blank, matchedName: food.n, reason: 'no-quantity' });
      continue;
    }

    const k = grams / 100; // the table is per 100 g
    const m: IngredientMatch = {
      raw, food: p.food, matchedName: food.n, grams: Math.round(grams),
      kcal: food.kcal * k, protein: food.p * k, fat: food.f * k,
      carbs: food.ch * k, fiber: food.fb * k, sugar: food.sg * k, sodium: food.na * k,
    };
    matches.push(m);
    totals.kcal += m.kcal; totals.protein += m.protein; totals.fat += m.fat;
    totals.carbs += m.carbs; totals.fiber += m.fiber; totals.sugar += m.sugar;
    totals.sodium += m.sodium;
  }

  const matchedCount = matches.filter((m) => m.grams != null).length;

  return {
    perServing: {
      kcal: Math.round(totals.kcal / serv),
      protein: Math.round(totals.protein / serv),
      fat: Math.round(totals.fat / serv),
      carbs: Math.round(totals.carbs / serv),
      fiber: Math.round(totals.fiber / serv),
      sugar: Math.round(totals.sugar / serv),
      sodium: Math.round(totals.sodium / serv),
    },
    matches,
    matchedCount,
    totalCount: matches.length,
    coverage: matches.length ? matchedCount / matches.length : 0,
  };
}
