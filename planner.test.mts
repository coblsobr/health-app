import {
  buildPlan, timesInPlan, scaleFor, servingsPerCook, setDay, swapDay, clearDay,
  summarise, repeatGap, addDays, daysBetween,
  type PlanRecipe, type Household, type Prefs,
} from './lib/planner.ts';
import { inferKinds } from './lib/kinds.ts';

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log('  ok  ', name); }
  else { fail++; console.log('  FAIL', name, detail && '\n        ' + detail); }
};

/** Two adults and a one-year-old, with lunch leftovers — the brief. */
const HOUSE: Household = { perMeal: 2.5, leftoverLunch: true };
const START = '2026-10-05';

const recipe = (over: Partial<PlanRecipe> & { id: string }): PlanRecipe => ({
  name: over.id, servings: 4, rating: null, favorite: false,
  cadenceDays: null, lastMade: null, kinds: [], ...over,
});

/** A library of twenty ordinary dinners across the proteins. */
const PROTEINS = ['Chicken', 'Beef', 'Pork', 'Seafood', 'Vegetarian'] as const;
const LIBRARY = Array.from({ length: 20 }, (_, i) =>
  recipe({ id: `r${i}`, kinds: [PROTEINS[i % 5]], servings: [4, 6, 8][i % 3] })
);

console.log('\n════════ how much to cook ════════\n');
{
  check('2.5 a meal plus lunch is 5 a night', servingsPerCook(HOUSE) === 5);
  check('without leftovers it is 2.5', servingsPerCook({ ...HOUSE, leftoverLunch: false }) === 2.5);
  check('a 4-serving recipe is cooked 1.5x (6), not doubled', scaleFor(5, 4) === 1.5, String(scaleFor(5, 4)));
  check('a 6-serving recipe once', scaleFor(5, 6) === 1);
  check('a 2-serving recipe 2.5x', scaleFor(5, 2) === 2.5, String(scaleFor(5, 2)));
  check('exactly enough is not rounded up', scaleFor(4, 4) === 1);
  check('a whisker over is not rounded up', scaleFor(4.05, 4) === 1, String(scaleFor(4.05, 4)));
  check('never under one batch', scaleFor(1, 8) === 1);

  const plan = buildPlan(LIBRARY, { start: START, days: 30, house: HOUSE, prefs: {}, seed: 1 });
  check('every night makes at least 5 servings', plan.entries.every((e) => e.servingsMade >= 5),
    plan.entries.map((e) => e.servingsMade).join(' '));
}

console.log('\n════════ rhythms ════════\n');
{
  const monthly = recipe({ id: 'm', cadenceDays: 30, lastMade: '2026-10-01' });
  check('monthly is in a month plan even if just made', timesInPlan(monthly, START, 30) === 1);
  check('weekly lands 4 times a month', timesInPlan(recipe({ id: 'w', cadenceDays: 7 }), START, 30) === 4);
  check('every 2 weeks lands twice a month', timesInPlan(recipe({ id: 'b', cadenceDays: 14 }), START, 30) === 2);
  check('weekly lands twice in 2 weeks', timesInPlan(recipe({ id: 'w', cadenceDays: 7 }), START, 14) === 2);
  check('monthly not due is out of a week plan', timesInPlan(monthly, START, 7) === 0);
  check('monthly due this week is in it',
    timesInPlan(recipe({ id: 'm', cadenceDays: 30, lastMade: '2026-09-07' }), START, 7) === 1);
  check('never-made monthly is in a week plan', timesInPlan(recipe({ id: 'm', cadenceDays: 30 }), START, 7) === 1);
  check('quarterly in a month only when due',
    timesInPlan(recipe({ id: 'q', cadenceDays: 90, lastMade: '2026-09-01' }), START, 30) === 0);

  const lib = [
    ...LIBRARY,
    recipe({ id: 'tacos', cadenceDays: 7 }),
    recipe({ id: 'lasagna', cadenceDays: 30, lastMade: '2026-10-02' }),
    recipe({ id: 'chili', cadenceDays: 14 }),
  ];
  const plan = buildPlan(lib, { start: START, days: 30, house: HOUSE, prefs: {}, seed: 7 });
  const on = (id: string) => plan.entries.filter((e) => e.recipeId === id);
  check('month plan has tacos 4 times', on('tacos').length === 4, String(on('tacos').length));
  check('month plan has lasagna once', on('lasagna').length === 1, String(on('lasagna').length));
  check('month plan has chili twice', on('chili').length === 2, String(on('chili').length));
  const t = on('tacos').map((e) => e.date);
  check('weekly tacos are spread about a week apart',
    t.every((d, i) => i === 0 || Math.abs(daysBetween(t[i - 1], d) - 7.5) <= 2), t.join(' '));
  check('rhythm entries say so', on('tacos').every((e) => e.reason === 'rhythm'));

  // Ten never-made monthly recipes must not pile into the first ten days.
  const many = Array.from({ length: 10 }, (_, i) => recipe({ id: `m${i}`, cadenceDays: 30 }));
  const spread = buildPlan([...LIBRARY, ...many], { start: START, days: 30, house: HOUSE, prefs: {}, seed: 3 });
  const late = spread.entries.filter((e) => e.recipeId.startsWith('m') && daysBetween(START, e.date) >= 10);
  check('new monthly recipes spread across the month', late.length >= 3, `${late.length} after day 10`);
}

console.log('\n════════ filling every day ════════\n');
{
  for (const days of [7, 14, 30]) {
    const plan = buildPlan(LIBRARY, { start: START, days, house: HOUSE, prefs: {}, seed: 11 });
    check(`${days}-day plan is full`, plan.entries.length === days && plan.openDates.length === 0,
      `${plan.entries.length} planned, ${plan.openDates.length} open`);
  }

  const plan = buildPlan(LIBRARY, { start: START, days: 30, house: HOUSE, prefs: {}, seed: 5 });
  const byId = new Map(LIBRARY.map((r) => [r.id, r]));
  let sameProteinRuns = 0;
  for (let i = 1; i < plan.entries.length; i++) {
    if (byId.get(plan.entries[i].recipeId)!.kinds[0] === byId.get(plan.entries[i - 1].recipeId)!.kinds[0]) sameProteinRuns++;
  }
  check('rarely the same protein two nights running', sameProteinRuns <= 3, `${sameProteinRuns} times`);

  const gap = repeatGap(LIBRARY.length);
  const repeatsTooSoon = plan.entries.some((e, i) =>
    plan.entries.some((f, j) => j > i && f.recipeId === e.recipeId && daysBetween(e.date, f.date) < gap));
  check(`no recipe repeats inside ${gap} days`, !repeatsTooSoon);

  // A tiny library still fills the month, by repeating.
  const tiny = [recipe({ id: 'a' }), recipe({ id: 'b' }), recipe({ id: 'c' })];
  const t = buildPlan(tiny, { start: START, days: 30, house: HOUSE, prefs: {}, seed: 2 });
  check('three recipes still fill a month', t.openDates.length === 0, String(t.openDates.length));
  check('and never the same one two nights running',
    t.entries.every((e, i) => i === 0 || e.recipeId !== t.entries[i - 1].recipeId));

  const none = buildPlan([], { start: START, days: 7, house: HOUSE, prefs: {}, seed: 1 });
  check('an empty library leaves the days open', none.openDates.length === 7);

  const a = buildPlan(LIBRARY, { start: START, days: 14, house: HOUSE, prefs: {}, seed: 42 });
  const b = buildPlan(LIBRARY, { start: START, days: 14, house: HOUSE, prefs: {}, seed: 42 });
  const c = buildPlan(LIBRARY, { start: START, days: 14, house: HOUSE, prefs: {}, seed: 43 });
  const ids = (p: typeof a) => p.entries.map((e) => e.recipeId).join();
  check('same seed, same plan', ids(a) === ids(b));
  check('a new seed shuffles', ids(a) !== ids(c));

  const poor = [...LIBRARY, recipe({ id: 'bad', rating: 2 })];
  const p = buildPlan(poor, { start: START, days: 30, house: HOUSE, prefs: {}, seed: 9 });
  check('a recipe rated 2 is never picked', !p.entries.some((e) => e.recipeId === 'bad'));
}

console.log('\n════════ preferences ════════\n');
{
  const noPork: Prefs = { Pork: 'skip' };
  const p = buildPlan(LIBRARY, { start: START, days: 30, house: HOUSE, prefs: noPork, seed: 4 });
  const byId = new Map(LIBRARY.map((r) => [r.id, r]));
  check('skip pork means no pork', !p.entries.some((e) => byId.get(e.recipeId)!.kinds.includes('Pork')));
  check('and the month is still full', p.openDates.length === 0);

  let base = 0;
  let more = 0;
  for (let s = 0; s < 20; s++) {
    const count = (prefs: Prefs) => buildPlan(LIBRARY, { start: START, days: 30, house: HOUSE, prefs, seed: s })
      .entries.filter((e) => byId.get(e.recipeId)!.kinds.includes('Chicken')).length;
    base += count({});
    more += count({ Chicken: 'more' });
  }
  check('"more chicken" means more chicken', more > base * 1.2, `${base / 20} → ${more / 20} a month`);

  // Kept days survive a rebuild.
  const first = buildPlan(LIBRARY, { start: START, days: 7, house: HOUSE, prefs: {}, seed: 1 });
  const chosen = setDay(first, addDays(START, 2), LIBRARY[19], HOUSE);
  const kept = chosen.entries.filter((e) => e.locked);
  const again = buildPlan(LIBRARY, { start: START, days: 7, house: HOUSE, prefs: {}, seed: 99, keep: kept });
  check('a chosen day is locked', kept.length === 1 && kept[0].recipeId === 'r19');
  check('and survives a shuffle', again.entries.find((e) => e.date === addDays(START, 2))?.recipeId === 'r19');

  const swapped = swapDay(first, START, LIBRARY, {}, HOUSE, 5);
  check('swap changes the recipe', swapped.entries[0].recipeId !== first.entries[0].recipeId);
  check('swap keeps the day filled', swapped.entries.length === 7);

  const cleared = clearDay(first, START);
  check('clear opens the day', cleared.openDates.includes(START) && cleared.entries.length === 6);

  const s = summarise(first);
  check('summary counts the days', s.planned === 7 && s.open === 0);
}

console.log('\n════════ meal kinds ════════\n');
{
  const k = (name: string, ingredients: string[] = [], tags: string[] = [], minutes: number | null = null) =>
    inferKinds({ name, ingredients, tags, minutes });
  check('chicken from the name', k('Chicken tortilla soup').includes('Chicken'));
  check('and it is a soup', k('Chicken tortilla soup').includes('Soup & stew'));
  check('name beats garnish', !k('Chicken tortilla soup', ['4 slices bacon']).includes('Pork'));
  check('protein from ingredients', k('Weeknight skillet', ['1 lb ground beef', '1 onion']).includes('Beef'));
  check('chicken stock is not chicken',
    k('Lentil soup', ['1 cup lentils', '4 cups chicken stock']).includes('Vegetarian'));
  check('no meat is vegetarian', k('Mushroom risotto', ['arborio rice', 'mushrooms']).join() === 'Vegetarian,Bowls & rice',
    k('Mushroom risotto', ['arborio rice', 'mushrooms']).join());
  check('no ingredients is not guessed vegetarian', !k('Mystery dish').includes('Vegetarian'));
  check('pasta', k('Spaghetti carbonara', ['pancetta']).includes('Pasta'));
  check('tacos', k('Fish tacos').includes('Tacos & Mexican') && k('Fish tacos').includes('Seafood'));
  check('quick by time', k('Eggs', ['eggs'], [], 20).includes('Quick'));
  check('quick by tag', k('Eggs', ['eggs'], ['Quick']).includes('Quick'));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
