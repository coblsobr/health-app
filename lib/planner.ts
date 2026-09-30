/**
 * Build a dinner plan — a week, two weeks or a month — from the library.
 *
 * The rules, in the order they are applied:
 *
 *   1. **Kept days stay.** Anything picked by hand or locked survives a
 *      shuffle, so the plan can be argued with one day at a time.
 *   2. **Rhythms are a promise.** A recipe marked "monthly" is in every
 *      monthly plan, a weekly one lands four times in a month, and so on —
 *      spread across the plan rather than bunched at the start. A rhythm
 *      longer than the plan only claims a day when it comes due inside it.
 *   3. **Every other day is filled**, from preferences ("more chicken, no
 *      pork") or from nothing at all. The previous version deliberately left
 *      days open and asked what to do with them; nobody wanted to be asked.
 *      A day is only left open when the library genuinely cannot fill it.
 *
 * Every dinner cooks enough for that night and, when leftovers are on, the
 * next day's lunch — scaled in half-batch steps, because 1.5x a recipe is a
 * normal thing to cook and doubling a 4-serving recipe to feed 5 is not.
 *
 * Pure and dateless beyond ISO strings, so it can be tested in node.
 */

import type { MealKind } from './kinds';

/** What is in the middle of the plate — two nights running is what to avoid. */
const PROTEINS: MealKind[] = ['Chicken', 'Beef', 'Pork', 'Seafood', 'Vegetarian'];
const mainProtein = (kinds: MealKind[]) => kinds.find((k) => PROTEINS.includes(k)) ?? null;

export type Cadence = number | null; // days between cookings; null = no rhythm

export type PlanRecipe = {
  id: string;
  name: string;
  /** Servings the recipe yields as written. */
  servings: number;
  /** Out of ten, matching the library. */
  rating: number | null;
  favorite: boolean;
  cadenceDays: Cadence;
  /** ISO date it was last cooked, or null for never. */
  lastMade: string | null;
  kinds: MealKind[];
};

export type Household = {
  /** Servings eaten at one meal. Two adults and a toddler is 2.5. */
  perMeal: number;
  /** Cook enough at dinner to cover the next day's lunch as well. */
  leftoverLunch: boolean;
};

/** Per kind: lean towards it, or leave it out. Absent means no opinion. */
export type Prefs = Partial<Record<MealKind, 'more' | 'skip'>>;

export type PlanEntry = {
  date: string;
  recipeId: string;
  name: string;
  /** How much of the recipe is cooked: 1, 1.5, 2… */
  scale: number;
  servingsMade: number;
  /** Why it landed here — shown so the plan can be argued with. */
  reason: 'rhythm' | 'pick' | 'chosen';
  /** Kept through a shuffle. Anything chosen by hand is locked. */
  locked: boolean;
};

export type Plan = {
  start: string;
  days: number;
  entries: PlanEntry[];
  /** Dates nothing could fill. */
  openDates: string[];
};

/* ── dates ──────────────────────────────────────────────────── */

/**
 * Local calendar date, never `toISOString()` — that shifts the day for anyone
 * west of Greenwich and silently plans the wrong dates.
 */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / 86_400_000);
}

export function datesFrom(start: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDays(start, i));
}

/* ── how much to cook ───────────────────────────────────────── */

/** Servings one dinner has to yield: tonight, plus tomorrow's lunch. */
export function servingsPerCook(house: Household): number {
  return house.perMeal * (house.leftoverLunch ? 2 : 1);
}

/**
 * How much of a recipe to cook, in half-batch steps, never under the need.
 *
 * A 0.02 whisker so 4.01 servings of a 4-serving recipe is one batch, not
 * one and a half.
 */
export function scaleFor(need: number, recipeServings: number): number {
  if (recipeServings <= 0) return 1;
  return Math.max(1, Math.ceil((need / recipeServings - 0.02) * 2) / 2);
}

function entryFor(date: string, r: PlanRecipe, house: Household, reason: PlanEntry['reason'], locked = false): PlanEntry {
  const scale = scaleFor(servingsPerCook(house), r.servings);
  return {
    date, recipeId: r.id, name: r.name, scale,
    servingsMade: round(scale * r.servings),
    reason, locked,
  };
}

const round = (n: number) => Math.round(n * 10) / 10;

/* ── randomness ─────────────────────────────────────────────── */

/**
 * Seeded, so the same seed gives the same plan — which is what makes tests
 * possible and "Shuffle" meaningful.
 */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── rhythms ────────────────────────────────────────────────── */

/**
 * How many times a recipe with a rhythm belongs in a plan of this length.
 *
 * As many whole cadences as fit, with a little slack so a 30-day "monthly"
 * fits a 30-day plan and a weekly one lands 4 times, not 4.3. A rhythm longer
 * than the plan gets one turn only if it comes due inside the plan — a monthly
 * recipe does not belong in every single week.
 */
export function timesInPlan(r: PlanRecipe, start: string, days: number): number {
  const cad = r.cadenceDays;
  if (!cad || cad <= 0) return 0;
  const whole = Math.floor(days / cad + 0.1);
  if (whole >= 1) return whole;
  if (!r.lastMade) return 1;
  const due = addDays(r.lastMade, cad);
  return daysBetween(due, addDays(start, days - 1)) >= 0 ? 1 : 0;
}

/** The free date nearest `target`, searching outwards both ways. */
function nearestFree(dates: string[], taken: Map<string, PlanEntry>, target: number): string | null {
  for (let d = 0; d < dates.length; d++) {
    for (const i of [target + d, target - d]) {
      if (i >= 0 && i < dates.length && !taken.has(dates[i])) return dates[i];
    }
  }
  return null;
}

/* ── filling ────────────────────────────────────────────────── */

/** Recipes the planner is allowed to reach for, given preferences. */
export function eligible(recipes: PlanRecipe[], prefs: Prefs): PlanRecipe[] {
  return recipes.filter(
    (r) => (r.rating == null || r.rating > 3) && !r.kinds.some((k) => prefs[k] === 'skip')
  );
}

/**
 * How appealing a recipe is for one date, before variety and repeats.
 * Rating, favourite and preferences multiply, so "more chicken" makes chicken
 * about three times as likely without making anything else impossible.
 */
function appeal(r: PlanRecipe, prefs: Prefs): number {
  let w = (r.rating ?? 7) / 10;
  if (r.favorite) w *= 1.5;
  if (r.kinds.some((k) => prefs[k] === 'more')) w *= 3;
  return w;
}

/** Days to the nearest other night this recipe is on, or Infinity. */
function distanceToSame(entries: Map<string, PlanEntry>, recipeId: string, date: string): number {
  let best = Infinity;
  for (const e of entries.values()) {
    if (e.recipeId === recipeId && e.date !== date) best = Math.min(best, Math.abs(daysBetween(e.date, date)));
  }
  return best;
}

/**
 * Score every candidate for one date. Exported so "Swap" can offer the next
 * best thing rather than something random.
 */
export function candidatesFor(
  date: string,
  plan: Map<string, PlanEntry>,
  recipes: PlanRecipe[],
  prefs: Prefs,
  minGap: number
): { r: PlanRecipe; score: number }[] {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const neighbour = (n: number) => {
    const e = plan.get(addDays(date, n));
    return e ? mainProtein(byId.get(e.recipeId)?.kinds ?? []) : null;
  };
  const around = [neighbour(-1), neighbour(1)];

  return eligible(recipes, prefs)
    .map((r) => {
      const gap = distanceToSame(plan, r.id, date);
      if (gap < minGap) return { r, score: 0 };
      let score = appeal(r, prefs);
      // Chicken two nights running is the quickest way to make a plan feel
      // generated. Not forbidden — a chicken-only library still plans.
      const p = mainProtein(r.kinds);
      if (p && around.includes(p)) score *= 0.3;
      // Rhythm recipes already have their turns; only reach for them again
      // when there is nothing else.
      if (r.cadenceDays) score *= 0.05;
      // Longer since it was last on the plan, the better — rotates the library.
      if (gap !== Infinity) score *= Math.min(1, gap / 21) + 0.3;
      return { r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Days before the same recipe may come round again: two weeks, unless the
 * library is too small for that, in which case as long as it allows.
 */
export function repeatGap(pool: number): number {
  return Math.max(1, Math.min(14, pool - 1));
}

/* ── the build ──────────────────────────────────────────────── */

export type BuildOptions = {
  start: string;
  days: number;
  house: Household;
  prefs: Prefs;
  seed: number;
  /** Entries to keep exactly where they are. */
  keep?: PlanEntry[];
};

export function buildPlan(recipes: PlanRecipe[], o: BuildOptions): Plan {
  const dates = datesFrom(o.start, o.days);
  const inRange = new Set(dates);
  const taken = new Map<string, PlanEntry>();
  const rand = rng(o.seed);

  for (const e of o.keep ?? []) if (inRange.has(e.date)) taken.set(e.date, e);

  // Rhythms, most frequent first: a weekly recipe has the least room to move.
  const withRhythm = recipes
    .filter((r) => r.cadenceDays && r.cadenceDays > 0)
    .sort((a, b) => (a.cadenceDays as number) - (b.cadenceDays as number));

  for (const r of withRhythm) {
    const already = [...taken.values()].filter((e) => e.recipeId === r.id).length;
    const n = timesInPlan(r, o.start, o.days) - already;
    if (n <= 0) continue;
    const interval = o.days / n;

    // Start where it next comes due, or somewhere in the first interval when
    // it has never been made, so ten new monthly recipes do not all pile
    // into the first ten days.
    let first = r.lastMade ? daysBetween(o.start, addDays(r.lastMade, r.cadenceDays as number)) : -1;
    if (first < 0 || first >= interval) first = Math.floor(rand() * interval);

    for (let i = 0; i < n; i++) {
      const slot = nearestFree(dates, taken, Math.round(first + i * interval));
      if (!slot) break;
      taken.set(slot, entryFor(slot, r, o.house, 'rhythm'));
    }
  }

  // Everything else, day by day.
  const pool = eligible(recipes, o.prefs);
  const openDates: string[] = [];
  for (const date of dates) {
    if (taken.has(date)) continue;
    const pick = choose(date, taken, recipes, o.prefs, repeatGap(pool.length), rand);
    if (pick) taken.set(date, entryFor(date, pick, o.house, 'pick'));
    else openDates.push(date);
  }

  return {
    start: o.start,
    days: o.days,
    entries: dates.filter((d) => taken.has(d)).map((d) => taken.get(d)!),
    openDates,
  };
}

/**
 * Weighted random among the best few, relaxing the repeat gap if the library
 * is too small to honour it. Picking only from the top keeps a 2★ recipe
 * from turning up just because the dice said so.
 */
function choose(
  date: string,
  taken: Map<string, PlanEntry>,
  recipes: PlanRecipe[],
  prefs: Prefs,
  gap: number,
  rand: () => number
): PlanRecipe | null {
  for (let g = gap; g >= 1; g = g > 1 ? Math.floor(g / 2) : 0) {
    const cands = candidatesFor(date, taken, recipes, prefs, g).slice(0, 6);
    if (cands.length === 0) continue;
    const total = cands.reduce((n, c) => n + c.score, 0);
    let x = rand() * total;
    for (const c of cands) {
      x -= c.score;
      if (x <= 0) return c.r;
    }
    return cands[cands.length - 1].r;
  }
  return null;
}

/** Put a specific recipe on a date, locked. */
export function setDay(plan: Plan, date: string, r: PlanRecipe, house: Household): Plan {
  const entries = plan.entries.filter((e) => e.date !== date);
  entries.push(entryFor(date, r, house, 'chosen', true));
  entries.sort((a, b) => a.date.localeCompare(b.date));
  return { ...plan, entries, openDates: plan.openDates.filter((d) => d !== date) };
}

export function clearDay(plan: Plan, date: string): Plan {
  return {
    ...plan,
    entries: plan.entries.filter((e) => e.date !== date),
    openDates: [...plan.openDates, date].sort(),
  };
}

/** The next best recipe for a date that is not the one already there. */
export function swapDay(plan: Plan, date: string, recipes: PlanRecipe[], prefs: Prefs, house: Household, seed: number): Plan {
  const current = plan.entries.find((e) => e.date === date)?.recipeId;
  const taken = new Map(plan.entries.filter((e) => e.date !== date).map((e) => [e.date, e]));
  const pool = eligible(recipes, prefs);
  const others = recipes.filter((r) => r.id !== current);
  const pick = choose(date, taken, others, prefs, repeatGap(pool.length), rng(seed));
  if (!pick) return plan;
  const next = setDay(plan, date, pick, house);
  // A swap is the planner's choice, not yours: keep it unlocked.
  return { ...next, entries: next.entries.map((e) => (e.date === date ? { ...e, reason: 'pick', locked: false } : e)) };
}

/* ── summary ────────────────────────────────────────────────── */

export function summarise(plan: Plan) {
  return {
    days: plan.days,
    planned: plan.entries.length,
    open: plan.openDates.length,
    distinctRecipes: new Set(plan.entries.map((e) => e.recipeId)).size,
    totalServings: round(plan.entries.reduce((n, e) => n + e.servingsMade, 0)),
  };
}

/* ── the cadences offered in the UI ─────────────────────────── */

export const CADENCES: { label: string; days: number | null }[] = [
  { label: 'Weekly', days: 7 },
  { label: 'Every 2 weeks', days: 14 },
  { label: 'Monthly', days: 30 },
  { label: 'Every 2 months', days: 60 },
  { label: 'Every 3 months', days: 90 },
  { label: 'Twice a year', days: 182 },
  { label: 'Once a year', days: 365 },
  { label: 'Not scheduled', days: null },
];

export function cadenceLabel(days: Cadence): string {
  return CADENCES.find((c) => c.days === days)?.label ?? 'Not scheduled';
}
