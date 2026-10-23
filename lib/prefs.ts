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
 * Apply swaps to one ingredient line. The longest rule wins and only one rule
 * applies, so "chicken broth → vegetable broth" beats "chicken → Quorn", and
 * a swap's own output is never swapped again.
 */
export function applySwaps(line: string, swaps: Swap[]): string {
  const rules = [...swaps].filter((s) => s.from.trim()).sort((a, b) => b.from.length - a.from.length);
  for (const r of rules) {
    const re = new RegExp(`\\b${escape(r.from.trim())}\\b`, 'i');
    if (re.test(line)) return line.replace(re, r.to.trim());
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
export function describePeople(p: People): string {
  const who = [
    `${p.adults} adult${p.adults === 1 ? '' : 's'}`,
    p.kids ? `${p.kids} little one${p.kids === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(' + ');
  const extra = [p.leftoverLunch ? 'lunch leftovers' : '', p.extraDinner ? 'a spare dinner' : ''].filter(Boolean);
  return extra.length ? `${who}, with ${extra.join(' and ')}` : who;
}
