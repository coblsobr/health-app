import {
  planCadence, fillOpenDates, summarise, servingsNeeded, batchesFor, urgency,
  addDays, daysBetween, DEFAULT_FILL,
  type PlanRecipe, type Household, type Targets,
} from './lib/planner.ts';

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log('  ok  ', name); }
  else { fail++; console.log('  FAIL', name, detail && '\n        ' + detail); }
};

/** Two adults and one kid — the household from the brief. */
const HOUSE: Household = { adults: 2, kids: 1, kidFactor: 0.5, lunchPeople: 2 };
const BY_SERVINGS: Targets = { basis: 'servings', adultDinnerKcal: 700, adultLunchKcal: 550 };
const BY_CALORIES: Targets = { basis: 'calories', adultDinnerKcal: 700, adultLunchKcal: 550 };

const recipe = (over: Partial<PlanRecipe> & { id: string }): PlanRecipe => ({
  name: over.id, servings: 4, kcal: 500, rating: 8, cadenceDays: null, lastMade: null, ...over,
});

console.log('\n════════ how much to cook ════════\n');
{
  const need = servingsNeeded(HOUSE, BY_SERVINGS, { kcal: 500 });
  check('dinner counts the kid as half', need.dinner === 2.5, String(need.dinner));
  check('lunch for the two adults', need.lunch === 2, String(need.lunch));
  check('4.5 servings needed in total', need.total === 4.5, String(need.total));

  check('a 4-serving recipe needs 2 batches', batchesFor(4.5, 4) === 2, String(batchesFor(4.5, 4)));
  check('a 6-serving recipe needs 1', batchesFor(4.5, 6) === 1, String(batchesFor(4.5, 6)));
  check('exactly enough is still 1 batch', batchesFor(4, 4) === 1, String(batchesFor(4, 4)));
  check('a rounding whisker over is 1 batch', batchesFor(4.01, 4) === 1, String(batchesFor(4.01, 4)));
  check('never less than 1', batchesFor(0, 4) === 1);

  const noLunch = servingsNeeded({ ...HOUSE, lunchPeople: 0 }, BY_SERVINGS, { kcal: 500 });
  check('leftovers off drops the lunch servings', noLunch.total === 2.5, String(noLunch.total));

  const kcal = servingsNeeded(HOUSE, BY_CALORIES, { kcal: 500 });
  // dinner 700*2.5 = 1750 kcal, lunch 550*2 = 1100 kcal, at 500 per serving
  check('by calories: 3.5 servings of dinner', kcal.dinner === 3.5, String(kcal.dinner));
  check('by calories: 2.2 servings of lunch', kcal.lunch === 2.2, String(kcal.lunch));

  const noKcal = servingsNeeded(HOUSE, BY_CALORIES, { kcal: null });
  check('a recipe with no calories falls back to servings', noKcal.total === 4.5, String(noKcal.total));
}

console.log('\n════════ cadence ════════\n');
{
  // Chipotle pasta monthly, marry-me chickpeas quarterly — the brief's example.
  const recipes = [
    recipe({ id: 'chipotle-pasta', cadenceDays: 30, lastMade: '2026-09-01' }),
    recipe({ id: 'marry-me-chickpeas', cadenceDays: 90, lastMade: '2026-08-01' }),
  ];
  const plan = planCadence(recipes, '2026-10-01', 90, HOUSE, BY_SERVINGS);
  const pasta = plan.entries.filter((e) => e.recipeId === 'chipotle-pasta');
  const peas = plan.entries.filter((e) => e.recipeId === 'marry-me-chickpeas');

  check('pasta lands 3 times in 90 days', pasta.length === 3, `got ${pasta.length}`);
  check('chickpeas land once in 90 days', peas.length === 1, `got ${peas.length}`);
  check('pasta starts when it comes due', pasta[0].date === '2026-10-01', pasta[0].date);
  check(
    'pasta repeats about a month apart',
    pasta.every((e, i) => i === 0 || Math.abs(daysBetween(pasta[i - 1].date, e.date) - 30) <= 1),
    pasta.map((e) => e.date).join(' ')
  );
  check('the rest of the days are left open', plan.openDates.length === 90 - 4, String(plan.openDates.length));
  check('each cooking feeds dinner and lunch', pasta[0].dinnerServings === 2.5 && pasta[0].lunchServings === 5.5,
    `${pasta[0].dinnerServings} / ${pasta[0].lunchServings}`);
}

{
  const never = planCadence(
    [recipe({ id: 'new-thing', cadenceDays: 30, lastMade: null })],
    '2026-10-01', 60, HOUSE, BY_SERVINGS
  );
  check('a never-made recipe starts on day one', never.entries[0]?.date === '2026-10-01', never.entries[0]?.date);
  check('and then keeps its rhythm', never.entries.length === 2, `got ${never.entries.length}`);
}

{
  // A monthly recipe two months late has missed two turns; a quarterly one two
  // months late has not missed any.
  const monthly = recipe({ id: 'm', cadenceDays: 30, lastMade: '2026-08-01' });
  const quarterly = recipe({ id: 'q', cadenceDays: 90, lastMade: '2026-08-01' });
  check('the monthly recipe is more overdue', urgency(monthly, '2026-10-01') > urgency(quarterly, '2026-10-01'),
    `${urgency(monthly, '2026-10-01')} vs ${urgency(quarterly, '2026-10-01')}`);
}

{
  // Everything due at once, on a plan with fewer days than recipes.
  const many = Array.from({ length: 10 }, (_, i) =>
    recipe({ id: `r${i}`, cadenceDays: 30, lastMade: '2026-01-01' })
  );
  const plan = planCadence(many, '2026-10-01', 5, HOUSE, BY_SERVINGS);
  check('never plans more days than it has', plan.entries.length === 5, `got ${plan.entries.length}`);
  check('one recipe per day', new Set(plan.entries.map((e) => e.date)).size === 5);
  check('and no day is left both open and taken', plan.openDates.length === 0);
}

console.log('\n════════ filling the gaps ════════\n');
{
  const library = [
    recipe({ id: 'loved', rating: 9, lastMade: '2026-05-01' }),
    recipe({ id: 'liked', rating: 7, lastMade: '2026-06-01' }),
    recipe({ id: 'meh', rating: 3, lastMade: '2026-07-01' }),
    recipe({ id: 'untried-good', rating: 8, lastMade: null }),
    recipe({ id: 'untried-poor', rating: 2, lastMade: null }),
  ];
  const empty = planCadence([], '2026-10-01', 7, HOUSE, BY_SERVINGS);
  check('nothing planned without a cadence', empty.entries.length === 0);
  check('all 7 days open', empty.openDates.length === 7);

  const filled = fillOpenDates(
    empty, library,
    { ...DEFAULT_FILL, fromLibrary: 2, neverTried: 1, minRating: 5 },
    HOUSE, BY_SERVINGS
  );
  check('fills exactly what was asked for', filled.entries.length === 3, `got ${filled.entries.length}`);
  check('leaves the rest open', filled.openDates.length === 4, `got ${filled.openDates.length}`);
  check('respects the rating floor', !filled.entries.some((e) => /meh|poor/.test(e.recipeId)),
    filled.entries.map((e) => e.recipeId).join(' '));
  check('takes the best-rated first', filled.entries.some((e) => e.recipeId === 'loved'),
    filled.entries.map((e) => e.recipeId).join(' '));
  check('includes an untried one', filled.entries.some((e) => e.recipeId === 'untried-good'),
    filled.entries.map((e) => e.recipeId).join(' '));
  check('entries stay in date order',
    filled.entries.every((e, i) => i === 0 || e.date >= filled.entries[i - 1].date));
}

{
  // A filler must not land beside the same recipe placed by cadence.
  const r = recipe({ id: 'pasta', cadenceDays: 30, lastMade: '2026-09-30', rating: 10 });
  const plan = planCadence([r], '2026-10-01', 7, HOUSE, BY_SERVINGS);
  const filled = fillOpenDates(plan, [r], { ...DEFAULT_FILL, fromLibrary: 5, minGapDays: 14 }, HOUSE, BY_SERVINGS);
  const pasta = filled.entries.filter((e) => e.recipeId === 'pasta');
  check('the same recipe is not repeated inside the gap', pasta.length === 1, `got ${pasta.length}`);
}

console.log('\n════════ summary ════════\n');
{
  const recipes = [
    recipe({ id: 'a', cadenceDays: 7, lastMade: '2026-09-30', servings: 4 }),
    recipe({ id: 'b', cadenceDays: 14, lastMade: '2026-09-30', servings: 6 }),
  ];
  const plan = planCadence(recipes, '2026-10-01', 28, HOUSE, BY_SERVINGS);
  const s = summarise(plan, 28);
  check('counts the days', s.days === 28);
  check('planned plus open is every day', s.planned + s.open === 28, `${s.planned} + ${s.open}`);
  check('two distinct recipes', s.distinctRecipes === 2, String(s.distinctRecipes));
  check('a 4-serving recipe is cooked twice a night', plan.entries.filter((e) => e.recipeId === 'a')[0].batches === 2);
  check('a 6-serving recipe once', plan.entries.filter((e) => e.recipeId === 'b')[0].batches === 1);
  check('lunches are counted', s.lunchesCovered > 0, String(s.lunchesCovered));
}

console.log('\n════════ dates ════════\n');
{
  check('adds days across a month end', addDays('2026-10-31', 1) === '2026-11-01', addDays('2026-10-31', 1));
  check('adds days across a year end', addDays('2026-12-31', 1) === '2027-01-01', addDays('2026-12-31', 1));
  check('counts days between', daysBetween('2026-10-01', '2026-10-31') === 30, String(daysBetween('2026-10-01', '2026-10-31')));
  check('handles a leap day', addDays('2028-02-28', 1) === '2028-02-29', addDays('2028-02-28', 1));
  // A year-long plan is the longest horizon offered, so it has to hold up.
  check('a year of dates is a year long', daysBetween('2026-10-01', addDays('2026-10-01', 364)) === 364);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
