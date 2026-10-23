import { readFileSync, existsSync } from 'node:fs';
import { zipSync, gzipSync, strToU8 } from 'fflate';
import {
  readPaprikaArchive, parsePaprikaRecipe, parseServings, parseMinutes,
  cleanIngredients, cleanSteps, parseNutrition,
} from './lib/paprika.ts';

/**
 * Every case here is copied from a real Paprika 3 export (122 recipes).
 * Set PAPRIKA_EXPORT to a .paprikarecipes file to also run the whole thing —
 * the export itself is personal and is not committed.
 */

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log('  ok  ', name); }
  else { fail++; console.log('  FAIL', name, detail && '\n        ' + detail); }
};
const eq = (name: string, got: unknown, want: unknown) =>
  check(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

console.log('\n════════ servings ════════\n');
eq('plain', parseServings('6'), 6);
eq('Yields: 4 - 6 takes the low end', parseServings('Yields: 4 - 6'), 4);
eq('Servings: 20 cookies', parseServings('Servings: 20 cookies'), 20);
eq('Serves 9-10', parseServings('Serves 9-10'), 9);
eq('Servings: 6 – 4 people', parseServings('Servings: 6 – 4 people'), 6);
eq('blank', parseServings(''), null);

console.log('\n════════ times ════════\n');
eq('20 mins', parseMinutes('20 mins'), 20);
eq('2 hr, 30 min', parseMinutes('2 hr, 30 min'), 150);
eq('1 hour', parseMinutes('1 hour'), 60);
eq('20-25 mins takes the low end', parseMinutes('20-25 mins'), 20);
eq('total time: 25 minutes', parseMinutes('total time: 25 minutes'), 25);
eq('bare number', parseMinutes('45'), 45);
eq('blank', parseMinutes(''), null);
{
  const r = parsePaprikaRecipe({ name: 'x', prep_time: '5 minutes', cook_time: 'total time: 25 minutes' })!;
  eq('"total time" under cook time has prep taken off', r.cookMin, 20);
  const t = parsePaprikaRecipe({ name: 'x', prep_time: '20 mins', cook_time: '', total_time: '55 min' })!;
  eq('cook time falls back to total minus prep', t.cookMin, 35);
}

console.log('\n════════ ingredients and steps ════════\n');
eq('page furniture and headers go',
  cleanIngredients('PRINT\nUS METRIC\nSCALE 1X 2X 3X\n1X 2X 3X\nFOR THE DRESSING:\nDRESSING\nRavioli: \n1 cup barley\n▢ 2 eggs'),
  ['1 cup barley', '2 eggs']);
eq('an ingredient in capitals with a number stays', cleanIngredients('2 CUPS FLOUR'), ['2 CUPS FLOUR']);
eq('steps lose numbering and headers',
  cleanSteps('Instructions\n1. Heat oil.\n\nTHE BOWLS\nStep 2: Add onion.'),
  ['Heat oil.', 'Add onion.']);

console.log('\n════════ nutrition ════════\n');
eq('one per line', parseNutrition('Serving Size: 1\nCalories: 123\nSugar: 2\nSodium: 108\nFat: 2\nSaturated Fat: 1\nCarbohydrates: 21\nFiber: 1\nProtein: 5'),
  { kcal: 123, protein: 5, carbs: 21, fat: 2, fiber: 1, sugar: 2, sodium: 108 });
eq('pipes, saturated fat first is not fat',
  parseNutrition('Calories: 1414kcal | Carbohydrates: 133g | Protein: 88g | Saturated Fat: 31g | Fat: 57g | Sodium: 1284mg'),
  { kcal: 1414, protein: 88, carbs: 133, fat: 57, fiber: null, sugar: null, sodium: 1284 });
eq('spaces only, with percentages',
  parseNutrition('Serving: 524g Calories: 768cal (38%) Carbohydrates: 75g (25%) Protein: 44g (88%) Fat: 35g (54%) Saturated Fat: 14g (88%) Sodium: 1630mg (71%) Fiber: 11g (46%) Sugar: 12g'),
  { kcal: 768, protein: 44, carbs: 75, fat: 35, fiber: 11, sugar: 12, sodium: 1630 });
eq('Calories Per Serving', parseNutrition('Calories Per Serving: 560 kcal')?.kcal, 560);
eq('value first',
  parseNutrition('3 wedges: 281 calories, 12g fat (6g saturated fat), 24mg cholesterol, 585mg sodium, 30g carbohydrate (3g sugars, 4g fiber), 14g protein.'),
  { kcal: 281, protein: 14, carbs: 30, fat: 12, fiber: 4, sugar: 3, sodium: 585 });
eq('prose is not nutrition', parseNutrition('White beans are packed with potassium and calcium, and high in fiber.'), null);
eq('no calories is nothing', parseNutrition('Saturated Fat 2g\nSodium 200mg\nProtein 2g'), null);

console.log('\n════════ a whole recipe ════════\n');
{
  const r = parsePaprikaRecipe({
    uid: 'U1', name: 'Chicken Tzatziki Bowls.', rating: 4, servings: 'Yields: 4',
    ingredients: '1 lb chicken\nPRINT', directions: 'Cook it.\n\nEat it.',
    description: 'Fresh.', notes: 'Good cold.', source_url: 'https://x.com/a',
    categories: ['Dinner'], photo_data: '', photos: [{ data: 'QUJD' }],
  })!;
  eq('trailing full stop off the name', r.name, 'Chicken Tzatziki Bowls');
  eq('4 stars is 8 out of 10', r.rating, 8);
  eq('description and notes together', r.notes, 'Fresh.\n\nGood cold.');
  eq('photo from the photos list when photo_data is empty', r.photoBase64, 'QUJD');
  eq('categories become tags', r.tags, ['Dinner']);
  eq('0 stars is unrated', parsePaprikaRecipe({ name: 'x', rating: 0 })!.rating, null);
  eq('no name is no recipe', parsePaprikaRecipe({ name: '  ' }), null);
}

console.log('\n════════ the archive ════════\n');
{
  const entry = (o: object) => gzipSync(strToU8(JSON.stringify(o)));
  const zip = zipSync({
    'B.paprikarecipe': entry({ name: 'B', ingredients: '1 egg' }),
    'A.paprikarecipe': entry({ name: 'A', ingredients: '1 egg' }),
    'broken.paprikarecipe': strToU8('not gzip'),
    'readme.txt': strToU8('ignored'),
  });
  const a = readPaprikaArchive(zip);
  eq('reads every recipe, sorted', a.recipes.map((r) => r.name), ['A', 'B']);
  eq('reports the broken one', a.failed, ['broken.paprikarecipe']);
}

const real = process.env.PAPRIKA_EXPORT;
if (real && existsSync(real)) {
  console.log('\n════════ the real export ════════\n');
  const { recipes, failed } = readPaprikaArchive(new Uint8Array(readFileSync(real)));
  check('every recipe reads', failed.length === 0, failed.join(', '));
  check('every recipe has ingredients', recipes.every((r) => r.ingredients.length > 0),
    recipes.filter((r) => !r.ingredients.length).map((r) => r.name).join(', '));
  check('no "PRINT" or scale buttons left', !recipes.some((r) => r.ingredients.some((l) => /^(print|\dx)/i.test(l))));
  console.log(`        ${recipes.length} recipes, ${recipes.filter((r) => r.photoBase64).length} photos, ` +
    `${recipes.filter((r) => r.nutrition).length} with nutrition, ${recipes.filter((r) => r.rating).length} rated`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
