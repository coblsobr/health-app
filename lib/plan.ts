/**
 * Weekly meal-plan generation.
 *
 * Two modes, because they are genuinely different problems:
 *
 *   daily — a different recipe in every slot. Most variety, most cooking.
 *   prep  — cook a few recipes in batches and eat each several times. Fewer
 *           cook sessions, and the grocery list buys each recipe's ingredients
 *           once rather than once per meal.
 *
 * Rule-based and offline: hard filters first, then a score, then a spread that
 * keeps the same recipe off consecutive days where it can.
 */

import type { Recipe, MealSlot } from './db';

export type PlanMode = 'daily' | 'prep';

export type PlanOptions = {
  startDate: string;           // YYYY-MM-DD, first day of the plan
  days: number;                // how many days to fill
  slots: MealSlot[];           // which meals to plan
  people: number;              // servings needed per meal
  mode: PlanMode;
  /** prep mode: how many distinct recipes to cook across the whole plan. */
  cookSessions: number;
  /** Skip recipes above this per-serving figure. Null means no limit. */
  maxKcal: number | null;
  /** Only use recipes carrying every one of these tags. */
  requiredTags: string[];
  favouritesOnly: boolean;
};

export type GeneratedEntry = {
  date: string;
  slot: MealSlot;
  recipeId: string;
  servings: number;
  isLeftover: boolean;
  batchId: string | null;
};

export type GenerateResult = {
  entries: GeneratedEntry[];
  /** Empty when the plan is complete; otherwise why it fell short. */
  warnings: string[];
  usedRecipeIds: string[];
};

/* ── dates ──────────────────────────────────────────────────── */

export function toISODate(d: Date): string {
  // Local calendar date, not UTC: toISOString() shifts the day for anyone
  // west of Greenwich and silently plans the wrong dates.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + n);
  return toISODate(date);
}

/** Monday of the week containing `d`. */
export function startOfWeek(d: Date = new Date()): string {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (date.getDay() + 6) % 7; // 0 = Monday
  date.setDate(date.getDate() - dow);
  return toISODate(date);
}

export function formatDayLabel(iso: string): { weekday: string; day: string } {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return {
    weekday: date.toLocaleDateString(undefined, { weekday: 'short' }),
    day: String(date.getDate()),
  };
}

/* ── choosing recipes ───────────────────────────────────────── */

/** Recipes a slot could plausibly take, by the tags they carry. */
function suitableForSlot(r: Recipe, slot: MealSlot, tagsById: Map<string, string[]>): boolean {
  const tags = (tagsById.get(r.id) ?? []).map((t) => t.toLowerCase());
  if (slot === 'breakfast') {
    // Only exclude when a recipe is explicitly labelled otherwise; most
    // libraries have no breakfast tagging at all, and an empty plan is worse
    // than an occasional odd suggestion.
    if (tags.includes('breakfast')) return true;
    if (tags.includes('dessert') || tags.includes('side')) return false;
    return true;
  }
  if (slot === 'snack') return true;
  return !tags.includes('dessert');
}

function passesFilters(r: Recipe, o: PlanOptions, tagsById: Map<string, string[]>): boolean {
  if (o.favouritesOnly && !r.is_favorite) return false;
  if (o.maxKcal != null && r.kcal != null && r.kcal > o.maxKcal) return false;
  if (o.requiredTags.length) {
    const tags = new Set((tagsById.get(r.id) ?? []).map((t) => t.toLowerCase()));
    if (!o.requiredTags.every((t) => tags.has(t.toLowerCase()))) return false;
  }
  return true;
}

/** Higher is better. Favourites and ratings win; unrated recipes sit mid-pack. */
function score(r: Recipe): number {
  let s = 0;
  if (r.is_favorite) s += 4;
  s += r.rating != null ? r.rating * 0.6 : 3;
  const total = (r.prep_min ?? 0) + (r.cook_min ?? 0);
  if (total > 0 && total <= 30) s += 1.5;
  return s;
}

/** Deterministic shuffle so "regenerate" gives a different week each press. */
function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ── the generator ──────────────────────────────────────────── */

export function generatePlan(
  recipes: Recipe[],
  tagsById: Map<string, string[]>,
  options: PlanOptions,
  seed = Date.now()
): GenerateResult {
  const warnings: string[] = [];
  const entries: GeneratedEntry[] = [];
  const used = new Set<string>();

  const pool = recipes.filter((r) => passesFilters(r, options, tagsById));

  if (pool.length === 0) {
    return {
      entries: [],
      warnings: [
        recipes.length === 0
          ? 'Your library is empty — add or import a recipe first.'
          : 'No recipes match those filters. Try loosening them.',
      ],
      usedRecipeIds: [],
    };
  }

  const dates = Array.from({ length: options.days }, (_, i) => addDays(options.startDate, i));
  const ranked = shuffled(pool, seed).sort((a, b) => score(b) - score(a));

  if (options.mode === 'prep') {
    // Cook a handful of recipes, then repeat each across the plan.
    for (const slot of options.slots) {
      const candidates = ranked.filter((r) => suitableForSlot(r, slot, tagsById));
      if (candidates.length === 0) {
        warnings.push(`Nothing in your library suits ${slot}.`);
        continue;
      }

      const sessions = Math.max(1, Math.min(options.cookSessions, candidates.length, dates.length));
      const chosen = candidates.slice(0, sessions);

      // Give each batch a contiguous run of days, so leftovers are eaten while
      // they are still good rather than scattered across the week.
      const perBatch = Math.ceil(dates.length / sessions);
      chosen.forEach((recipe, i) => {
        const batchDates = dates.slice(i * perBatch, (i + 1) * perBatch);
        if (batchDates.length === 0) return;
        const batchId = `${recipe.id}-${slot}-${i}-${seed.toString(36)}`;
        used.add(recipe.id);
        batchDates.forEach((date, dayIndex) => {
          entries.push({
            date,
            slot,
            recipeId: recipe.id,
            servings: options.people,
            // The first day is the cook; the rest eat what it made.
            isLeftover: dayIndex > 0,
            batchId,
          });
        });
      });
    }
  } else {
    // A different recipe in each slot, reusing only once the pool runs out.
    for (const slot of options.slots) {
      const candidates = ranked.filter((r) => suitableForSlot(r, slot, tagsById));
      if (candidates.length === 0) {
        warnings.push(`Nothing in your library suits ${slot}.`);
        continue;
      }
      if (candidates.length < dates.length) {
        warnings.push(
          `Only ${candidates.length} recipe${candidates.length === 1 ? '' : 's'} available for ${slot}, so some repeat.`
        );
      }
      dates.forEach((date, i) => {
        const recipe = candidates[i % candidates.length];
        used.add(recipe.id);
        entries.push({
          date, slot, recipeId: recipe.id,
          servings: options.people, isLeftover: false, batchId: null,
        });
      });
    }
  }

  return { entries, warnings, usedRecipeIds: [...used] };
}

/* ── reading a plan back ────────────────────────────────────── */

export type DayTotals = { kcal: number; protein: number; meals: number; estimated: boolean };

/**
 * Calories and protein for one day.
 *
 * Recipe figures are per serving, so a meal for two counts twice — this is the
 * number that has to line up with the diary and the Health tab later.
 */
export function dayTotals(
  entries: { kcal: number | null; protein_g: number | null; servings: number }[]
): DayTotals {
  let kcal = 0;
  let protein = 0;
  let anyMissing = false;
  for (const e of entries) {
    if (e.kcal == null) anyMissing = true;
    kcal += (e.kcal ?? 0) * e.servings;
    protein += (e.protein_g ?? 0) * e.servings;
  }
  return { kcal: Math.round(kcal), protein: Math.round(protein), meals: entries.length, estimated: anyMissing };
}

/**
 * How many separate cook sessions a plan involves.
 *
 * The headline benefit of meal prep, so it is worth showing rather than
 * leaving the user to count meals and guess.
 */
export function countCookSessions(entries: { is_leftover: number; batch_id: string | null; id: string }[]): number {
  const batches = new Set<string>();
  let singles = 0;
  for (const e of entries) {
    if (e.is_leftover) continue;
    if (e.batch_id) batches.add(e.batch_id);
    else singles++;
  }
  return batches.size + singles;
}
