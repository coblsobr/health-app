/**
 * Things decided once, ahead of time, so planning a week is three taps.
 *
 * The Plan screen asks only how many meals, over how many days, and whether
 * to bring in new recipes. Everything else — who is eating, leftovers, what
 * kinds of meals, ingredient swaps, what is always in the cupboard — lives
 * here and is set on the Preferences screen.
 *
 * Pure, so it is tested in node; loading and saving is lib/preferences.ts.
 */

import type { People, Prefs } from './planner';

/** "chicken" → "Quorn chik'n pieces", applied to ingredient lines before shopping. */
export type Swap = { from: string; to: string };

export type Preferences = {
  people: People;
  kinds: Prefs;
  swaps: Swap[];
  /** Always in the cupboard: listed separately and left out of the Meijer cart. */
  pantry: string[];
};

export const DEFAULT_PANTRY = [
  'salt', 'black pepper', 'olive oil', 'vegetable oil', 'cooking spray',
  'garlic powder', 'onion powder', 'oregano', 'cumin', 'chili powder', 'paprika',
  'cinnamon', 'italian seasoning', 'red pepper flakes', 'flour', 'sugar',
  'baking powder', 'baking soda', 'vanilla extract',
];

export const DEFAULT_PREFERENCES: Preferences = {
  people: { adults: 2, kids: 1, leftoverLunch: true, extraDinner: false },
  kinds: {},
  swaps: [],
  pantry: DEFAULT_PANTRY,
};

/**
 * Read what was saved, filling gaps from the defaults. Copes with the older
 * `household` shape, `{ perMeal, leftoverLunch }`, which predates counting
 * people.
 */
export function readPreferences(raw: {
  household?: string | null; kinds?: string | null; swaps?: string | null; pantry?: string | null;
}): Preferences {
  const parse = <T,>(s: string | null | undefined): T | null => {
    try { return s ? (JSON.parse(s) as T) : null; } catch { return null; }
  };
  const h = parse<Partial<People> & { perMeal?: number }>(raw.household) ?? {};
  const d = DEFAULT_PREFERENCES.people;
  return {
    people: {
      adults: typeof h.adults === 'number' ? h.adults : d.adults,
      kids: typeof h.kids === 'number' ? h.kids : d.kids,
      leftoverLunch: typeof h.leftoverLunch === 'boolean' ? h.leftoverLunch : d.leftoverLunch,
      extraDinner: typeof h.extraDinner === 'boolean' ? h.extraDinner : d.extraDinner,
    },
    kinds: parse<Prefs>(raw.kinds) ?? {},
    swaps: (parse<Swap[]>(raw.swaps) ?? []).filter((s) => s && s.from?.trim() && s.to?.trim()),
    pantry: parse<string[]>(raw.pantry) ?? DEFAULT_PANTRY,
  };
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The stand-ins "mostly vegetarian" buys, for the meat lib/kinds.ts calls
 * swappable. Broth and stock come first in effect (longest rule wins), so
 * "chicken broth" becomes vegetable broth, not plant-based chicken. A swap of
 * the user's own with the same "from" replaces the one here.
 */
export const VEG_SWAPS: Swap[] = [
  { from: 'chicken broth', to: 'vegetable broth' },
  { from: 'chicken stock', to: 'vegetable stock' },
  { from: 'beef broth', to: 'vegetable broth' },
  { from: 'chicken bouillon', to: 'vegetable bouillon' },
  { from: 'ground beef', to: 'veggie crumbles' },
  { from: 'ground turkey', to: 'veggie crumbles' },
  { from: 'ground chicken', to: 'veggie crumbles' },
  { from: 'beef crumbles', to: 'veggie crumbles' },
  { from: 'meatballs', to: 'veggie meatballs' },
  { from: 'chicken', to: 'plant-based chicken' },
  { from: 'sausage', to: 'veggie sausage' },
  { from: 'chorizo', to: 'soy chorizo' },
  { from: 'bacon', to: 'veggie bacon' },
];

/** The swaps actually applied: yours, plus the diet's where you have not said otherwise. */
export function effectiveSwaps(p: Pick<Preferences, 'swaps' | 'kinds'>): Swap[] {
  if (p.kinds.diet !== 'mostlyVeg') return p.swaps;
  const mine = new Set(p.swaps.map((s) => s.from.trim().toLowerCase()));
  return [...p.swaps, ...VEG_SWAPS.filter((s) => !mine.has(s.from))];
}

/** Already a stand-in — mirrors MEAT_FREE in lib/kinds.ts (kept here so node tests can import this file). */
const MEAT_FREE = /\b(vegan|vegetarian|veggie|plant[- ]based|meatless|meat[- ]free|quorn|impossible|beyond|gardein|morningstar|tofurky|fake|faux|chik['’]?n)\b/i;

/** The amount at the start of a line: "1 lb", "2", "1 (12 oz) package", "4 cups". */
const AMOUNT = /^\s*(?:[\d½¼¾⅓⅔⅛⅜⅝⅞]+(?:[\s./-]+[\d½¼¾⅓⅔⅛⅜⅝⅞]+)*\s*(?:\([^)]*\)\s*)?(?:(?:lbs?|pounds?|oz|ounces?|cups?|g|grams?|kg|packages?|pkgs?|cans?|tbsps?|tsps?|tablespoons?|teaspoons?|slices?|links?|strips?)\.?\s+)?)?/i;

/**
 * Apply swaps to one ingredient line. The longest rule wins and only one
 * applies, so "chicken broth → vegetable broth" beats "chicken → Quorn".
 *
 * The amount is kept and the rest of the line becomes the stand-in: "1 lb
 * boneless skinless chicken breasts, diced" → "1 lb plant-based chicken".
 * Replacing only the word gave "1 lb boneless skinless plant-based chicken
 * breasts", which no shop's search box understands. A line that is already a
 * stand-in ("fake bacon") is left alone.
 */
export function applySwaps(line: string, swaps: Swap[]): string {
  if (MEAT_FREE.test(line) && !swaps.some((s) => MEAT_FREE.test(s.from))) return line;
  const rules = [...swaps].filter((s) => s.from.trim()).sort((a, b) => b.from.length - a.from.length);
  for (const r of rules) {
    const re = new RegExp(`\\b${escape(r.from.trim())}s?\\b`, 'i');
    if (re.test(line)) {
      const amount = line.match(AMOUNT)?.[0] ?? '';
      return `${amount}${r.to.trim()}`.trim();
    }
  }
  return line;
}

const words = (s: string) =>
  s.toLowerCase().split(/[^a-z]+/).filter(Boolean).map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));

/**
 * Is a shopping line something always in the cupboard? Every word of a pantry
 * entry must appear, so "black pepper" never catches red bell peppers and
 * "olive oil" never catches olives.
 */
export function inPantry(line: { name: string; search: string }, pantry: string[]): boolean {
  const have = new Set(words(`${line.search} ${line.name}`));
  return pantry.some((p) => {
    const need = words(p);
    return need.length > 0 && need.every((w) => have.has(w));
  });
}

/** Servings one cook makes, in words, for the Plan screen. */
export function describePeople(p: People, diet?: 'any' | 'mostlyVeg'): string {
  if (diet === 'mostlyVeg') return `${describePeople(p)} · mostly vegetarian`;
  const who = [
    `${p.adults} adult${p.adults === 1 ? '' : 's'}`,
    p.kids ? `${p.kids} little one${p.kids === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(' + ');
  const extra = [p.leftoverLunch ? 'lunch leftovers' : '', p.extraDinner ? 'a spare dinner' : ''].filter(Boolean);
  return extra.length ? `${who}, with ${extra.join(' and ')}` : who;
}
