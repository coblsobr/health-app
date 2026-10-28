import {
  buildPlan, timesInPlan, scaleFor, servingsPerCook, setDay, swapDay, clearDay,
  summarise, repeatGap, addDays, daysBetween, cookDates, householdFrom, allowedRecipe, swapSide, dropSide,
  type PlanRecipe, type Household, type Prefs,
} from './lib/planner.ts';
import { inferKinds, meatStatus } from './lib/kinds.ts';

let pass = 0;
let fail = 0;
const eq3 = (name: string, got: unknown, want: unknown) =>
  check(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
function check(name: string, cond: boolean, detail = '') {
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
  check('name beats garnish', !k('Chicken tortilla soup', ['1 lb chicken breasts', '4 slices bacon']).includes('Pork'));
  check('a name the ingredients do not back up is not trusted', k("Copycat P.F. Chang's Chicken Lettuce Wraps", ['1 lb. chikn crumbles', 'lettuce']).join() === 'Vegetarian', k("Copycat P.F. Chang's Chicken Lettuce Wraps", ['1 lb. chikn crumbles', 'lettuce']).join());
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

console.log('\n════════ not dinner ════════\n');
{
  // All from a real imported library.
  const k = (name: string, tags: string[] = []) => inferKinds({ name, ingredients: ['1 egg'], tags, minutes: null });
  check('muffins are baking', k('Baby Led Weaning Raspberry Muffins').includes('Sweets & baking'));
  check('cookies are baking', k('Bakery-Style Peanut Butter Chocolate Chip Cookies').includes('Sweets & baking'));
  check('a latte is a drink', k('Peppermint Mocha Latte {Starbucks Copycat}').includes('Drinks'));
  check('a lassi is a drink', k('Mango Lassi').includes('Drinks'));
  check('a dressing is a dressing', k('Chipotle Ranch Dressing').includes('Sauces & dressings'));
  check('a bowl with a dressing is a bowl',
    !k('Barley Bowl With Chickpeas Roasted Vegs And Avocodo Dressing').includes('Sauces & dressings'));
  check('ravioli with a sauce in the name is dinner',
    !k('Sage Brown Butter Sauce Butternut Squash Ravioli').includes('Sauces & dressings'));
  check('crepes are breakfast', k('Easy Baby Crepes with Berries and Yogurt').includes('Breakfast'));
  check('a Breakfast category is breakfast', k('Something', ['Breakfast']).includes('Breakfast'));
  check('a cheeseburger pie is dinner', !k('Cheeseburger Pie').some((x) => ['Breakfast', 'Sweets & baking'].includes(x)));

  const lib = [
    ...LIBRARY,
    recipe({ id: 'muffins', kinds: ['Sweets & baking'], rating: 10 }),
    recipe({ id: 'latte', kinds: ['Drinks'], rating: 10 }),
  ];
  const p = buildPlan(lib, { start: START, days: 30, house: HOUSE, prefs: {}, seed: 8 });
  check('muffins and lattes stay off dinner nights', !p.entries.some((e) => ['muffins', 'latte'].includes(e.recipeId)));
  let seen = false;
  for (let s = 0; s < 10 && !seen; s++) {
    seen = buildPlan(lib, { start: START, days: 30, house: HOUSE, prefs: { 'Sweets & baking': 'more' }, seed: s })
      .entries.some((e) => e.recipeId === 'muffins');
  }
  check('unless asked for', seen);
}

console.log('\n════════ a few meals a week ════════\n');
{
  eq3('3 meals in 7 days are spread out', cookDates(START, 7, 3), [START, addDays(START, 2), addDays(START, 5)]);
  eq3('no meal count means every night', cookDates(START, 7).length, 7);
  eq3('more meals than days is every night', cookDates(START, 7, 9).length, 7);

  // Two adults and a toddler, leftovers for lunch: 2.5 x 2 = 5 a cook.
  const fam = householdFrom({ adults: 2, kids: 1, leftoverLunch: true, extraDinner: false });
  eq3('the family is 2.5 a meal', fam.perMeal, 2.5);
  eq3('with lunch leftovers, 5 a cook', servingsPerCook(fam), 5);
  const spare = householdFrom({ adults: 2, kids: 1, leftoverLunch: true, extraDinner: true });
  eq3('with a spare dinner too, 7.5 a cook', servingsPerCook(spare), 7.5);

  const p = buildPlan(LIBRARY, { start: START, days: 7, meals: 3, house: fam, prefs: {}, seed: 4 });
  eq3('3 meals planned', p.entries.length, 3);
  eq3('on the cook days', p.entries.map((e) => e.date), cookDates(START, 7, 3));
  check('three different recipes', new Set(p.entries.map((e) => e.recipeId)).size === 3);
  check('each makes at least 5', p.entries.every((e) => e.servingsMade >= 5), p.entries.map((e) => e.servingsMade).join(' '));

  // A weekly rhythm still lands once in a 3-meal week.
  const lib = [...LIBRARY, recipe({ id: 'tacos', cadenceDays: 7 })];
  const t = buildPlan(lib, { start: START, days: 7, meals: 3, house: fam, prefs: {}, seed: 9 });
  eq3('weekly tacos are in a 3-meal week once', t.entries.filter((e) => e.recipeId === 'tacos').length, 1);
  eq3('and still only 3 meals', t.entries.length, 3);

  // Neighbouring cook days avoid the same protein, as neighbouring nights do.
  let runs = 0;
  const byId = new Map(LIBRARY.map((r) => [r.id, r]));
  for (let s2 = 0; s2 < 20; s2++) {
    const q = buildPlan(LIBRARY, { start: START, days: 7, meals: 3, house: fam, prefs: {}, seed: s2 });
    for (let i = 1; i < q.entries.length; i++) {
      if (byId.get(q.entries[i].recipeId)!.kinds[0] === byId.get(q.entries[i - 1].recipeId)!.kinds[0]) runs++;
    }
  }
  check('back-to-back cook days rarely share a protein', runs <= 6, `${runs} in 40 pairs`);
}

console.log('\n════════ preferences hold everywhere ════════\n');
{
  // The bug: "Mix in something new" brought prawns to someone who said no
  // seafood. A blog recipe whose name does not say so, prawns in the list.
  const blog = {
    name: 'Garlic Butter Linguine',
    ingredients: ['12 oz linguine', '1 lb large prawns, peeled', '4 tbsp butter', '4 cloves garlic'],
  };
  const noSeafood: Prefs = { Seafood: 'skip' };
  const kinds = inferKinds({ ...blog, tags: [], minutes: null });
  check('prawns in the ingredients make it seafood', kinds.includes('Seafood'), kinds.join());
  check('and "no seafood" turns it away', !allowedRecipe({ kinds, meat: meatStatus(blog) }, noSeafood));
  for (const word of ['squid', 'calamari', 'scampi', 'oysters', 'trout']) {
    check(`${word} is seafood`, inferKinds({ name: `${word} dinner`, ingredients: [], tags: [], minutes: null }).includes('Seafood'));
  }

  // Preferences beat rhythms: a monthly shrimp dish stays out.
  const lib = [...LIBRARY, recipe({ id: 'shrimp', cadenceDays: 30, kinds: ['Seafood'] })];
  const p = buildPlan(lib, { start: START, days: 30, house: HOUSE, prefs: noSeafood, seed: 3 });
  check('a monthly seafood recipe is not planned under "no seafood"', !p.entries.some((e) => e.recipeId === 'shrimp'));
}

console.log('\n════════ mostly vegetarian ════════\n');
{
  const m = (name: string, ingredients: string[] = []) => meatStatus({ name, ingredients });
  check('no meat is none', m('Lentil soup', ['1 cup lentils', '4 cups chicken broth']) === 'none');
  check('ground beef swaps', m('Taco Lasagna', ['1 lb ground beef', '9 tortillas']) === 'swappable');
  check('diced chicken swaps', m('Curry', ['2 lb chicken thighs, boneless, cut into bite-size pieces']) === 'swappable');
  check('chicken tenderloins swap', m('Strips', ['1 lb chicken tenderloins']) === 'swappable');
  check('bacon and sausage swap', m('Pasta', ['4 slices bacon', '1 lb Italian sausage']) === 'swappable');
  check('flank steak does not', m('Mongolian Beef', ['1 pound flank steak, thinly sliced']) === 'fixed');
  check('wings do not', m('Wings', ['2 lb chicken wings']) === 'fixed');
  check('seafood does not', m('Shrimp tacos', ['1 lb shrimp']) === 'fixed');
  check("Quorn chik'n is no meat at all", m('Bowl', ["1 package Quorn chik'n filet"]) === 'none');
  check('Vegan Sesame Chicken is vegetarian', inferKinds({ name: 'Vegan Sesame Chicken', ingredients: ['1 block tofu'], tags: [], minutes: null }).includes('Vegetarian'));

  const veg: Prefs = { diet: 'mostlyVeg' };
  const lib = [
    ...Array.from({ length: 8 }, (_, i) => recipe({ id: `veg${i}`, kinds: ['Vegetarian'], meat: 'none' })),
    ...Array.from({ length: 8 }, (_, i) => recipe({ id: `swap${i}`, kinds: ['Chicken'], meat: 'swappable' })),
    ...Array.from({ length: 8 }, (_, i) => recipe({ id: `steak${i}`, kinds: ['Beef'], meat: 'fixed' })),
  ];
  let vegCount = 0;
  let swapCount = 0;
  let steak = 0;
  for (let s2 = 0; s2 < 20; s2++) {
    const q = buildPlan(lib, { start: START, days: 7, meals: 3, house: HOUSE, prefs: veg, seed: s2 });
    for (const e of q.entries) {
      if (e.recipeId.startsWith('veg')) vegCount++;
      else if (e.recipeId.startsWith('swap')) swapCount++;
      else steak++;
    }
  }
  check('steak never makes a mostly-vegetarian plan', steak === 0, `${steak}`);
  check('swappable meat still can', swapCount > 0, `${swapCount}`);
  check('vegetarian is most of it', vegCount > swapCount * 1.5, `${vegCount} veg vs ${swapCount} swappable`);
}

console.log('\n════════ not a meal, and sides ════════\n');
{
  const k = (name: string, ingredients: string[] = ['1 cup something'], tags: string[] = []) => inferKinds({ name, ingredients, tags, minutes: null });
  // From a real plan: "Mix in something new" brought hot honey as a dinner.
  check('hot honey is a condiment', k('Hot Honey', ['1 cup honey', '2 tsp red pepper flakes']).includes('Sauces & dressings'));
  check('hot honey chicken is a meal', !k('Hot Honey Chicken', ['2 lb chicken thighs', '½ cup honey']).includes('Sauces & dressings'));
  check('honey garlic tofu is a meal', !k('Honey Garlic Tofu', ['1 block tofu', 'honey']).includes('Sauces & dressings'));
  check("the site's Condiment course counts", k('Spicy Drizzle', ['honey'], ['Condiment']).includes('Sauces & dressings'));
  check("the site's Main Course beats a salad name", !k('Big Salad', ['lettuce'], ['Main Course']).includes('Sides'));
  check("the site's Side Dish counts", k('Cheesy Thing', ['cheddar'], ['Side Dish']).includes('Sides'));

  // From the real library.
  for (const name of ['Miso Roasted Carrots', 'Oven Roasted Vegetables', 'Cucumber Salad', 'Roasted Brussel Sprouts And Sweet Potatoes', 'Patatas Bravas with Two Sauces: Smoky Romesco and Garlic Aioli']) {
    check(`${name} is a side`, k(name, ['1 lb vegetables', '2 tbsp olive oil']).includes('Sides'));
  }
  check('bacon on a broccoli salad is a garnish', k('Creamy Broccoli Salad', ['1 head broccoli', '4 slices bacon']).includes('Sides'));
  check('a salad with chicken is a meal', !k('Chicken Caesar Salad', ['2 chicken breasts', 'romaine']).includes('Sides'));
  check('beans and greens is a meal', !k('Mediterranean White Beans & Greens', ['2 cans white beans', 'kale']).includes('Sides'));
  check('halloumi and broccolini is a meal', !k('Sheet-Pan Roasted Halloumi & Broccolini', ['8 oz halloumi', 'broccolini']).includes('Sides'));
  check('a corn and pepper empanada is a meal', !k('Corn and Pepper Empanada with Avocado and Red Pepper Cream', ['corn', 'peppers', 'dough']).includes('Sides'));

  const mains = Array.from({ length: 8 }, (_, i) => recipe({ id: `main${i}`, kinds: ['Vegetarian'] }));
  const sides = Array.from({ length: 4 }, (_, i) => recipe({ id: `side${i}`, kinds: ['Vegetarian', 'Sides'] }));
  const lib = [...mains, ...sides];

  const plain = buildPlan(lib, { start: START, days: 7, meals: 3, house: HOUSE, prefs: {}, seed: 2 });
  check('a side is never the meal', !plain.entries.some((e) => e.recipeId.startsWith('side')));
  check('no sides unless asked', plain.entries.every((e) => !e.side));

  const withSides = buildPlan(lib, { start: START, days: 7, meals: 3, house: HOUSE, prefs: { withSides: true }, seed: 2 });
  check('every meal gets a side', withSides.entries.every((e) => e.side?.recipeId.startsWith('side')));
  check('three different sides for three meals', new Set(withSides.entries.map((e) => e.side!.recipeId)).size === 3);
  check('a side is made for the same people', withSides.entries.every((e) => e.side!.servingsMade >= servingsPerCook(HOUSE)));

  const d = withSides.entries[0].date;
  const swapped = swapSide(withSides, d, lib, { withSides: true }, HOUSE, 7);
  check('swap side changes the side', swapped.entries[0].side!.recipeId !== withSides.entries[0].side!.recipeId);
  check('and keeps the meal', swapped.entries[0].recipeId === withSides.entries[0].recipeId);
  const changed = setDay(withSides, d, mains[7], HOUSE);
  check('changing the meal keeps its side', changed.entries.find((e) => e.date === d)!.side?.recipeId === withSides.entries[0].side!.recipeId);
  check('no side drops it', !dropSide(withSides, d).entries.find((e) => e.date === d)!.side);

  const noSideRecipes = buildPlan(mains, { start: START, days: 7, meals: 3, house: HOUSE, prefs: { withSides: true }, seed: 2 });
  check('no side recipes, no sides — and the meals still plan', noSideRecipes.entries.length === 3 && noSideRecipes.entries.every((e) => !e.side));

  const seafoodSide = [...mains, recipe({ id: 'shrimpside', kinds: ['Seafood', 'Sides'] })];
  const s2 = buildPlan(seafoodSide, { start: START, days: 7, meals: 3, house: HOUSE, prefs: { withSides: true, Seafood: 'skip' }, seed: 2 });
  check('sides follow Preferences too', s2.entries.every((e) => !e.side));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
