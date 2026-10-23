import { applySwaps, inPantry, readPreferences, describePeople, DEFAULT_PANTRY } from './lib/prefs.ts';

let pass = 0;
let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log('  ok  ', name); }
  else { fail++; console.log('  FAIL', name, `\n        got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
};

console.log('\n════════ swaps ════════\n');
{
  const swaps = [
    { from: 'chicken', to: "Quorn chik'n pieces" },
    { from: 'chicken broth', to: 'vegetable broth' },
    { from: 'bacon', to: 'fake bacon' },
  ];
  eq('a swap replaces the word', applySwaps('1 lb chicken thighs', swaps), "1 lb Quorn chik'n pieces thighs");
  eq('the longer rule wins', applySwaps('4 cups chicken broth', swaps), '4 cups vegetable broth');
  eq('case does not matter', applySwaps('2 Chicken breasts', swaps), "2 Quorn chik'n pieces breasts");
  eq('only whole words', applySwaps('1 cup chickpeas', swaps), '1 cup chickpeas');
  eq("a swap's output is not swapped again", applySwaps('4 slices bacon', [...swaps, { from: 'fake bacon', to: 'x' }]), '4 slices fake bacon');
  eq('no swaps, no change', applySwaps('1 onion', []), '1 onion');
}

console.log('\n════════ pantry ════════\n');
{
  const p = DEFAULT_PANTRY;
  eq('salt is pantry', inPantry({ name: 'Salt', search: 'kosher salt' }, p), true);
  eq('black pepper is pantry', inPantry({ name: 'Spices, pepper', search: 'ground black pepper' }, p), true);
  eq('red bell peppers are not', inPantry({ name: 'Peppers, sweet, red', search: 'red bell peppers' }, p), false);
  eq('olive oil is pantry', inPantry({ name: 'Oil, olive', search: 'olive oil' }, p), true);
  eq('olives are not', inPantry({ name: 'Olives, ripe', search: 'kalamata olives' }, p), false);
  eq('cumin by the search words', inPantry({ name: 'Spices, cumin seed', search: 'ground cumin' }, p), true);
  eq('chicken is not', inPantry({ name: 'Chicken, broilers or fryers', search: 'chicken breasts' }, p), false);
}

console.log('\n════════ saved preferences ════════\n');
{
  const d = readPreferences({});
  eq('defaults: two adults and a toddler with lunch leftovers', d.people, { adults: 2, kids: 1, leftoverLunch: true, extraDinner: false });
  const old = readPreferences({ household: JSON.stringify({ perMeal: 2.5, leftoverLunch: false }) });
  eq('the old shape keeps its leftovers choice', old.people.leftoverLunch, false);
  eq('broken JSON falls back', readPreferences({ swaps: '{oops' }).swaps, []);
  eq('half-filled swaps are dropped', readPreferences({ swaps: JSON.stringify([{ from: 'a', to: '' }, { from: 'b', to: 'c' }]) }).swaps, [{ from: 'b', to: 'c' }]);
  eq('described', describePeople(d.people), '2 adults + 1 little one, with lunch leftovers');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
