/**
 * Build a dinner plan from a library of recipes.
 *
 * Two ideas drive it, and they pull in opposite directions:
 *
 *   - **Cadence.** A recipe can be marked "about once a month" or "every three
 *     months". Those are not rules to obey exactly; they are a rhythm. A
 *     recipe becomes *due* at `lastMade + cadence` and gets more insistent the
 *     longer it waits, so nothing is ever silently dropped.
 *   - **Everything else is filler.** The days a cadence recipe does not claim
 *     get filled from the library, or left open on purpose so the cook can
 *     choose. The planner reports what it could not fill rather than quietly
 *     inventing something.
 *
 * Pure and dateless beyond ISO strings, so it can be tested in node.
 */

export type Cadence = number | null; // days between cookings; null = no rhythm

export type PlanRecipe = {
  id: string;
  name: string;
  /** Servings the recipe yields as written. */
  servings: number;
  /** Calories per serving, when known. */
  kcal: number | null;
  /** Out of ten, matching the library. */
  rating: number | null;
  cadenceDays: Cadence;
  /** ISO date it was last cooked, or null for never. */
  lastMade: string | null;
};

export type Household = {
  adults: number;
  kids: number;
  /** A child eats this share of an adult portion. */
  kidFactor: number;
  /** How many people take leftovers for lunch the next day. 0 turns it off. */
  lunchPeople: number;
};

export type Targets = {
  basis: 'servings' | 'calories';
  /** basis 'calories': what one adult eats at dinner, and at lunch. */
  adultDinnerKcal: number;
  adultLunchKcal: number;
};

export type PlanEntry = {
  date: string;
  recipeId: string;
  name: string;
  /** How many times the recipe is made that night. */
  batches: number;
  servingsMade: number;
  /** Servings eaten at dinner; the rest is lunch. */
  dinnerServings: number;
  lunchServings: number;
  /** Why it landed here — shown so the plan can be argued with. */
  reason: 'due' | 'rhythm' | 'filler';
};

export type PlanResult = {
  entries: PlanEntry[];
  /** Dates with nothing on them. */
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

/**
 * Servings one cooking has to yield.
 *
 * Dinner for the household, plus lunch the next day for whoever takes it. A
 * child is counted as a fraction of an adult rather than a whole portion,
 * because planning three adult servings for two adults and a five-year-old
 * buys about a third too much food every single day.
 */
export function servingsNeeded(
  house: Household,
  targets: Targets,
  recipe: Pick<PlanRecipe, 'kcal'>
): { dinner: number; lunch: number; total: number } {
  const eaters = house.adults + house.kids * house.kidFactor;

  if (targets.basis === 'calories' && recipe.kcal && recipe.kcal > 0) {
    const dinnerKcal = targets.adultDinnerKcal * eaters;
    const lunchKcal = targets.adultLunchKcal * house.lunchPeople;
    return {
      dinner: dinnerKcal / recipe.kcal,
      lunch: lunchKcal / recipe.kcal,
      total: (dinnerKcal + lunchKcal) / recipe.kcal,
    };
  }

  // By servings — also the fallback when a recipe has no calorie figure, since
  // a missing number must not quietly plan a single portion for a family.
  return { dinner: eaters, lunch: house.lunchPeople, total: eaters + house.lunchPeople };
}

/** Whole batches, because half a recipe is not a thing you can cook. */
export function batchesFor(need: number, recipeServings: number): number {
  if (recipeServings <= 0) return 1;
  return Math.max(1, Math.ceil(need / recipeServings - 0.02)); // 0.02: 4.01 servings of a 4-serving recipe is one batch
}

function entryFor(
  date: string,
  recipe: PlanRecipe,
  house: Household,
  targets: Targets,
  reason: PlanEntry['reason']
): PlanEntry {
  const need = servingsNeeded(house, targets, recipe);
  const batches = batchesFor(need.total, recipe.servings);
  const made = batches * recipe.servings;
  const dinner = Math.min(made, need.dinner);
  return {
    date,
    recipeId: recipe.id,
    name: recipe.name,
    batches,
    servingsMade: round(made),
    dinnerServings: round(dinner),
    lunchServings: round(made - dinner),
    reason,
  };
}

const round = (n: number) => Math.round(n * 10) / 10;

/* ── scheduling ─────────────────────────────────────────────── */

/**
 * How overdue a recipe is on the first day of the plan, in cadence-lengths.
 *
 * Expressed as a multiple of its own cadence so a monthly recipe two months
 * late outranks a quarterly one two months late — the monthly one has missed
 * twice as many turns.
 */
export function urgency(recipe: PlanRecipe, on: string): number {
  if (!recipe.cadenceDays || recipe.cadenceDays <= 0) return 0;
  if (!recipe.lastMade) return 1; // never made: due once, not infinitely overdue
  return daysBetween(recipe.lastMade, on) / recipe.cadenceDays;
}

/**
 * Place the recipes that have a rhythm, then report what is left.
 *
 * Deliberately does **not** fill the gaps. The cook is asked what to do with
 * them — that conversation is the point of the feature, and a planner that
 * silently fills a month with whatever it found is one nobody trusts.
 */
export function planCadence(
  recipes: PlanRecipe[],
  start: string,
  days: number,
  house: Household,
  targets: Targets
): PlanResult {
  const dates = datesFrom(start, days);
  const taken = new Map<string, PlanEntry>();

  // Most overdue first, so a scarce early slot goes to the recipe that has
  // waited longest relative to its own rhythm.
  const withRhythm = recipes
    .filter((r) => r.cadenceDays && r.cadenceDays > 0)
    .map((r) => ({ r, u: urgency(r, start) }))
    .sort((a, b) => b.u - a.u);

  for (const { r } of withRhythm) {
    const cadence = r.cadenceDays as number;

    // First due date: when it next comes round, or day one if already overdue.
    let due = r.lastMade ? addDays(r.lastMade, cadence) : start;
    if (daysBetween(start, due) < 0) due = start;

    while (daysBetween(due, dates[dates.length - 1]) >= 0) {
      const slot = nextFree(dates, taken, due);
      if (!slot) break;
      taken.set(slot, entryFor(slot, r, house, targets, slot === due ? 'due' : 'rhythm'));
      due = addDays(slot, cadence);
    }
  }

  const entries = dates.filter((d) => taken.has(d)).map((d) => taken.get(d)!);
  return { entries, openDates: dates.filter((d) => !taken.has(d)) };
}

/** The first free date on or after `from`, or null if the plan is full. */
function nextFree(dates: string[], taken: Map<string, PlanEntry>, from: string): string | null {
  for (const d of dates) {
    if (daysBetween(from, d) >= 0 && !taken.has(d)) return d;
  }
  return null;
}

/* ── filling the gaps ───────────────────────────────────────── */

export type FillOptions = {
  /** Recipes already cooked before, worth repeating. */
  fromLibrary: number;
  /** Recipes in the library never cooked yet. */
  neverTried: number;
  /** Only consider recipes at or above this rating, out of ten. */
  minRating: number | null;
  /** Days that must pass before the same recipe comes round again. */
  minGapDays: number;
};

export const DEFAULT_FILL: FillOptions = {
  fromLibrary: 0,
  neverTried: 0,
  minRating: null,
  minGapDays: 14,
};

/**
 * Fill open dates from the library.
 *
 * Takes the plan as it stands so a filler cannot land next to the same recipe
 * placed by cadence — repeating a meal two days running is the fastest way to
 * make a plan feel automated rather than thought about.
 */
export function fillOpenDates(
  plan: PlanResult,
  recipes: PlanRecipe[],
  opts: FillOptions,
  house: Household,
  targets: Targets
): PlanResult {
  const entries = [...plan.entries];
  const open = [...plan.openDates];
  const placed: string[] = [];

  const eligible = (r: PlanRecipe) =>
    opts.minRating == null || (r.rating ?? 0) >= opts.minRating;

  const tried = recipes.filter((r) => r.lastMade && eligible(r));
  const untried = recipes.filter((r) => !r.lastMade && eligible(r));

  // Best-rated first within each bucket; a tie goes to whatever has waited
  // longest, so the list rotates instead of favouring the same few.
  const byAppeal = (a: PlanRecipe, b: PlanRecipe) =>
    (b.rating ?? 0) - (a.rating ?? 0) ||
    (a.lastMade ?? '').localeCompare(b.lastMade ?? '');

  const queue: { r: PlanRecipe; reason: PlanEntry['reason'] }[] = [
    ...tried.sort(byAppeal).slice(0, opts.fromLibrary).map((r) => ({ r, reason: 'filler' as const })),
    ...untried.sort(byAppeal).slice(0, opts.neverTried).map((r) => ({ r, reason: 'filler' as const })),
  ];

  const stillOpen: string[] = [];
  for (const date of open) {
    const pick = queue.findIndex(({ r }) => !tooClose(entries, r.id, date, opts.minGapDays));
    if (pick === -1) {
      stillOpen.push(date);
      continue;
    }
    const { r, reason } = queue.splice(pick, 1)[0];
    entries.push(entryFor(date, r, house, targets, reason));
    placed.push(date);
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));
  return { entries, openDates: stillOpen };
}

function tooClose(entries: PlanEntry[], recipeId: string, date: string, gap: number): boolean {
  return entries.some(
    (e) => e.recipeId === recipeId && Math.abs(daysBetween(e.date, date)) < gap
  );
}

/* ── summary ────────────────────────────────────────────────── */

export type PlanSummary = {
  days: number;
  planned: number;
  open: number;
  cookSessions: number;
  totalServings: number;
  lunchesCovered: number;
  distinctRecipes: number;
};

export function summarise(plan: PlanResult, days: number): PlanSummary {
  return {
    days,
    planned: plan.entries.length,
    open: plan.openDates.length,
    cookSessions: plan.entries.reduce((n, e) => n + e.batches, 0),
    totalServings: round(plan.entries.reduce((n, e) => n + e.servingsMade, 0)),
    lunchesCovered: round(plan.entries.reduce((n, e) => n + e.lunchServings, 0)),
    distinctRecipes: new Set(plan.entries.map((e) => e.recipeId)).size,
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
  { label: 'No rhythm', days: null },
];

export function cadenceLabel(days: Cadence): string {
  return CADENCES.find((c) => c.days === days)?.label ?? 'No rhythm';
}
