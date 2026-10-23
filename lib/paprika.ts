import { unzipSync, gunzipSync, strFromU8 } from 'fflate';

/**
 * Read a Paprika 3 export (`.paprikarecipes`).
 *
 * The format: a zip holding one `.paprikarecipe` per recipe, each of which is
 * gzipped JSON. Paprika keeps fields as the source site wrote them, so most
 * of this file is tidying — measured against a real 122-recipe export:
 *
 *   - **Servings** arrive as "Yields: 4 - 6", "Servings: 20 cookies",
 *     "Serves 9-10" or nothing. The first number wins; a range takes its low
 *     end, because the planner scales up to cover the family anyway.
 *   - **Times** are prose: "2 hr, 30 min", "20-25 mins", and some sites file
 *     "total time: 25 minutes" under *cook* time — which then has prep
 *     subtracted, or every one of those recipes reads twice as long.
 *   - **Ingredient lists carry page furniture** — "PRINT", "1X 2X 3X",
 *     "US METRIC" — and section headers ("FOR THE DRESSING:"). Both are
 *     dropped, or the grocery list grows a line called "PRINT".
 *   - **Nutrition** comes in three layouts: one per line, pipe-separated, and
 *     both at once. Read field by field, first value wins.
 *   - **Rating** is 0–5 stars, 0 meaning unrated. The app rates out of ten.
 *
 * Pure apart from fflate (also pure JS), so it is tested in node.
 */

export type PaprikaNutrition = {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
};

export type PaprikaRecipe = {
  uid: string;
  name: string;
  ingredients: string[];
  steps: string[];
  servings: number | null;
  prepMin: number | null;
  cookMin: number | null;
  /** Out of ten, or null when unrated. */
  rating: number | null;
  notes: string | null;
  sourceUrl: string | null;
  tags: string[];
  nutrition: PaprikaNutrition | null;
  /** JPEG, base64, when the recipe had a photo. */
  photoBase64: string | null;
};

export type PaprikaArchive = {
  recipes: PaprikaRecipe[];
  /** Entries that could not be read, by file name. */
  failed: string[];
};

/* ── the archive ────────────────────────────────────────────── */

export function readPaprikaArchive(bytes: Uint8Array): PaprikaArchive {
  const entries = unzipSync(bytes);
  const recipes: PaprikaRecipe[] = [];
  const failed: string[] = [];
  for (const [name, data] of Object.entries(entries)) {
    if (!name.toLowerCase().endsWith('.paprikarecipe')) continue;
    try {
      const json = JSON.parse(strFromU8(gunzipSync(data)));
      const r = parsePaprikaRecipe(json);
      if (r) recipes.push(r);
      else failed.push(name);
    } catch {
      failed.push(name);
    }
  }
  recipes.sort((a, b) => a.name.localeCompare(b.name));
  return { recipes, failed };
}

/* ── one recipe ─────────────────────────────────────────────── */

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export function parsePaprikaRecipe(j: Record<string, unknown>): PaprikaRecipe | null {
  const name = str(j.name).trim().replace(/\.$/, '');
  if (!name) return null;

  const prep = parseMinutes(str(j.prep_time));
  let cook = parseMinutes(str(j.cook_time));
  const cookText = str(j.cook_time).toLowerCase();
  if (/total/.test(cookText) && cook != null) {
    // "total time: 25 minutes" is not a cook time. Take prep back off it.
    cook = prep != null && cook > prep ? cook - prep : null;
  }
  if (cook == null && prep != null) {
    const total = parseMinutes(str(j.total_time));
    if (total != null && total > prep) cook = total - prep;
  }

  const stars = typeof j.rating === 'number' ? j.rating : 0;
  const photos = Array.isArray(j.photos) ? (j.photos as Record<string, unknown>[]) : [];
  const photo = str(j.photo_data) || str(photos[0]?.data) || null;
  const notes = [str(j.description).trim(), str(j.notes).trim()].filter(Boolean).join('\n\n');

  return {
    uid: str(j.uid) || name,
    name,
    ingredients: cleanIngredients(str(j.ingredients)),
    steps: cleanSteps(str(j.directions)),
    servings: parseServings(str(j.servings)),
    prepMin: prep,
    cookMin: cook,
    rating: stars > 0 ? Math.min(10, Math.round(stars * 2)) : null,
    notes: notes || null,
    sourceUrl: str(j.source_url).trim() || null,
    tags: Array.isArray(j.categories) ? (j.categories as unknown[]).filter((c): c is string => typeof c === 'string') : [],
    nutrition: parseNutrition(str(j.nutritional_info)),
    photoBase64: photo,
  };
}

/* ── fields ─────────────────────────────────────────────────── */

/** "Yields: 4 - 6" → 4. "Servings: 20 cookies" → 20. "" → null. */
export function parseServings(s: string): number | null {
  const m = s.match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return n > 0 && n < 200 ? n : null;
}

/** "2 hr, 30 min" → 150. "20-25 mins" → 20. "45" → 45. */
export function parseMinutes(s: string): number | null {
  const t = s.toLowerCase().replace(/(\d)\s*-\s*\d+/g, '$1');
  let total = 0;
  let found = false;
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s*(h(?:ou)?rs?|h\b|m(?:in(?:ute)?s?)?\b)/g)) {
    found = true;
    total += parseFloat(m[1]) * (m[2].startsWith('h') ? 60 : 1);
  }
  if (!found) {
    const bare = t.match(/^\s*(\d+)\s*$/);
    if (!bare) return null;
    total = parseInt(bare[1], 10);
  }
  return total > 0 ? Math.round(total) : null;
}

/** Page furniture copied off recipe sites along with the ingredients. */
const JUNK = /^(print|pin|pin it|save|jump to recipe|ingredients|us\s*\|?\s*metric|us|metric|(scale\s*)?(\d(\/\d)?x\s*)+|cups?\s*\/\s*grams)$/i;

/** A heading over a group of ingredients rather than an ingredient. */
function isHeader(line: string): boolean {
  if (/\d/.test(line)) return false;
  if (line.endsWith(':')) return true;
  return line.length <= 40 && /[A-Z]/.test(line) && line === line.toUpperCase();
}

export function cleanIngredients(s: string): string[] {
  return s
    .split('\n')
    .map((l) => l.replace(/^[-•*▢☐□]\s*/, '').trim())
    .filter((l) => l && !JUNK.test(l) && !isHeader(l));
}

export function cleanSteps(s: string): string[] {
  return s
    .split('\n')
    .map((l) => l.trim().replace(/^(step\s*)?\d+[.):]\s*/i, '').trim())
    // Headers ("THE BOWLS", "Instructions") are not steps.
    .filter((l) => l && !/^(directions|instructions|method|steps?\s*\d*):?$/i.test(l) && !isHeader(l));
}

/**
 * Nutrition, in every layout seen in a real export:
 *   "Calories: 123\nProtein: 5"                  one per line
 *   "Calories: 1414kcal | Protein: 88g"          pipes
 *   "Calories: 768cal (38%) Carbohydrates: 75g"  spaces only
 *   "Calories Per Serving: 560 kcal"
 *   "281 calories, 12g fat (6g saturated fat)"   value first
 *
 * A qualified fat ("Saturated Fat") is never read as fat, and the first value
 * for a field wins. Without calories nothing is kept — the estimator does
 * better than a half-read label.
 */
export function parseNutrition(s: string): PaprikaNutrition | null {
  if (!s.trim()) return null;
  const out: PaprikaNutrition = { kcal: null, protein: null, carbs: null, fat: null, fiber: null, sugar: null, sodium: null };

  const set = (field: string, value: string, before: string) => {
    const w = field.toLowerCase();
    const key: keyof PaprikaNutrition | null =
      w.startsWith('calorie') ? 'kcal'
      : w.startsWith('carb') ? 'carbs'
      : w.startsWith('sugar') ? 'sugar'
      : w === 'fat' || w === 'total fat' ? 'fat'
      : w === 'protein' || w === 'fiber' || w === 'sodium' ? w
      : null;
    if (key === 'fat' && /(saturated|trans)\s*$/i.test(before)) return;
    if (key && out[key] == null) out[key] = Math.round(parseFloat(value));
  };

  const FIELD = 'calories(?: per serving)?|protein|carbohydrates?|carbs|total fat|fat|fiber|sugars?|sodium';
  for (const m of s.matchAll(new RegExp(`\\b(${FIELD})\\s*:?\\s*(\\d+(?:\\.\\d+)?)`, 'gi'))) {
    set(m[1], m[2], s.slice(0, m.index));
  }
  for (const m of s.matchAll(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:k?cal|mg|g)?[ \\t]+(${FIELD})\\b`, 'gi'))) {
    const at = (m.index ?? 0) + m[0].length - m[2].length;
    set(m[2], m[1], s.slice(0, at));
  }
  return out.kcal != null ? out : null;
}
