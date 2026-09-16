import { readFileSync } from 'fs';
import { parseScanPage, normalizeQuantity } from './lib/scanParse.ts';
import type { ScanPage } from './lib/ocr.ts';

type Raw = Record<string, { w: number; h: number; lines: [string, number, number, number, number][] }>;
const pages: Raw = {
  ...(JSON.parse(readFileSync('fixtures/scans/batch1.json', 'utf8')).pages as Raw),
  ...(JSON.parse(readFileSync('fixtures/scans/batch2.json', 'utf8')).pages as Raw),
};

const load = (k: string): ScanPage => ({
  w: pages[k].w,
  h: pages[k].h,
  lines: pages[k].lines.map(([t, x, y, w, h]) => ({ t, x, y, w, h })),
});

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log('  ok  ', name); }
  else { fail++; console.log('  FAIL', name, detail && '\n        ' + detail); }
};

if (process.argv.includes('--dump')) {
  for (const key of Object.keys(pages)) {
    const r = parseScanPage(load(key));
    console.log(`\n═══ ${key} ═══`);
    console.log('  name     :', JSON.stringify(r.name));
    console.log('  servings :', r.servings);
    console.log(`  ingredients (${r.ingredients.length}):`);
    r.ingredients.forEach((i) => console.log('    ·', i));
    console.log(`  steps (${r.steps.length}):`);
    r.steps.forEach((s) => console.log('    ·', s.length > 96 ? s.slice(0, 93) + '…' : s));
    if (r.warnings.length) console.log('  warnings :', r.warnings);
  }
}

console.log('\n════════ side by side: ingredients left, method right ════════');

{
  const r = parseScanPage(load('beets'));
  console.log('\n— beets —');
  check('title', r.name === 'Cider Vinaigrete-Glazed Bets', String(r.name));
  check('servings 6', r.servings === 6, String(r.servings));
  check('9 ingredients', r.ingredients.length === 9, `got ${r.ingredients.length}`);
  check('wrapped name joined', r.ingredients[0] === '6 medium red and/or golden beets (about 3 pounds)', r.ingredients[0]);
  check('1 cup water recovered', r.ingredients.some((i) => i === '1 cup water'), r.ingredients.join(' | '));
  check('no method in ingredients', !r.ingredients.some((i) => /Cut tops off|Secure lid/.test(i)));
  check('5 steps', r.steps.length === 5, `got ${r.steps.length}`);
  check('step 1 whole', r.steps[0].startsWith('Cut tops off beets') && r.steps[0].endsWith('hold beets).'), r.steps[0]);
  check('no ingredients in steps', !r.steps.some((s) => /crumbled blue/.test(s)));
}

{
  const r = parseScanPage(load('chicken'));
  console.log('\n— chicken —');
  check('title', r.name === 'Autumn Chicken and Vegetabies', String(r.name));
  check('servings 6', r.servings === 6, String(r.servings));
  check('12 ingredients', r.ingredients.length === 12, `got ${r.ingredients.length}`);
  check('thighs joined', r.ingredients[0] === '3 to 4 pounds bone-in chicken thighs', r.ingredients[0]);
  check('squash joined', r.ingredients.some((i) => i.includes('butternut squash') && i.includes('(3 to 4 cups)')), r.ingredients.join(' | '));
  check('basil optional joined', r.ingredients[r.ingredients.length - 1].includes('(optional)'), r.ingredients[r.ingredients.length - 1]);
  check('6 steps', r.steps.length === 6, `got ${r.steps.length}`);
  check('step 1 whole', r.steps[0].endsWith('into liquid.'), r.steps[0]);
}

{
  const r = parseScanPage(load('ribs'));
  console.log('\n— ribs —');
  check('title', r.name === 'Honey Ginger Ribs', String(r.name));
  check('servings 4', r.servings === 4, String(r.servings));
  check('footnote excluded', !r.ingredients.some((i) => /blend of cinnamon|supermarkets/.test(i)), r.ingredients.join(' | '));
  check('folio excluded', !r.ingredients.some((i) => /^56/.test(i)));
  check('ribs joined', r.ingredients[0] === '2 pounds pork baby back ribs, trimmed and cut into 2-rib pieces', r.ingredients[0]);
  check('5 steps', r.steps.length === 5, `got ${r.steps.length}`);
}

{
  const r = parseScanPage(load('beanbake'));
  console.log('\n— beanbake —');
  check('title', r.name === 'CRUNCHy-CHEESy BEAN BAKE', String(r.name));
  check('servings not the folio', r.servings !== 143, String(r.servings));
  check('intro prose not ingredients', !r.ingredients.some((i) => /melty mozzarella|crusty bread/.test(i)), r.ingredients.join(' | '));
  check('beans joined', r.ingredients.some((i) => i.includes('gigantes') && i.includes('drained')), r.ingredients.join(' | '));
  check('salt kept', r.ingredients.some((i) => /^Kosher salt/.test(i)));
  check('thyme kept separate', r.ingredients.some((i) => /^Leaves from 3 fresh thyme/.test(i)), r.ingredients.join(' | '));
  check('several prose steps', r.steps.length >= 4, `got ${r.steps.length}`);
  check('step 1 is the preheat', r.steps[0].startsWith('Preheat the oven'), r.steps[0]);
  check('no step is the whole column', r.steps.every((s) => s.length < 700), JSON.stringify(r.steps.map((s) => s.length)));
}

{
  const r = parseScanPage(load('tofu'));
  console.log('\n— tofu —');
  check('servings 4', r.servings === 4, String(r.servings));
  check('tofu block joined', r.ingredients.some((i) => i.includes('extra-firm tofu') && i.includes('have extra tofu')), r.ingredients.join(' | '));
  check('intro not ingredients', !r.ingredients.some((i) => /Project Plant-Based|chicken cutlet/.test(i)));
  check('rolls kept', r.ingredients.some((i) => /^4 potato rolls/.test(i)));
  check('several steps', r.steps.length >= 4, `got ${r.steps.length}`);
}

{
  const r = parseScanPage(load('maitake'));
  console.log('\n— maitake —');
  check('servings 4', r.servings === 4, String(r.servings));
  check('mushrooms joined', r.ingredients.some((i) => i.includes('maitake') && i.includes('per person')), r.ingredients.join(' | '));
  check('intro not ingredients', !r.ingredients.some((i) => /hen-of-the-woods|arrest you/.test(i)));
  check('several steps', r.steps.length >= 3, `got ${r.steps.length}`);
  check('step 1 is the preheat', r.steps[0].startsWith('Preheat the oven'), r.steps[0]);
}

{
  const r = parseScanPage(load('choppedtomatoes'));
  console.log('\n— choppedtomatoes —');
  check('5 ingredients', r.ingredients.length === 5, `got ${r.ingredients.length}`);
  check('tomatoes joined', r.ingredients[0] === '2 cups chopped fresh tomatoes (any kind)', r.ingredients[0]);
  check('method not in ingredients', !r.ingredients.some((i) => /béchamel|baking/.test(i)), r.ingredients.join(' | '));
}

console.log('\n════════ stacked: ingredients top, method full-width below ════════');

{
  const r = parseScanPage(load('shakshuka'));
  console.log('\n— shakshuka (two ingredient sub-columns) —');
  check('title', r.name === 'Slow-Cooked Shakshuka', String(r.name));
  check('servings 6 despite MAKES6', r.servings === 6, String(r.servings));
  check('no method in ingredients', !r.ingredients.some((i) => /Spray inside|CROCK-POT/.test(i)), r.ingredients.join(' | '));
  check('left sub-column first', r.ingredients[0] === '¼ cup extra virgin olive oil', r.ingredients[0]);
  check('right sub-column included', r.ingredients.some((i) => /crumbled feta/.test(i)), r.ingredients.join(' | '));
  check('garnishes are separate', r.ingredients.some((i) => /^Black pepper/.test(i)), r.ingredients.join(' | '));
  check('bell pepper joined', r.ingredients.some((i) => i === '1 large red bell pepper, chopped'), r.ingredients.join(' | '));
  check('2 steps', r.steps.length === 2, `got ${r.steps.length}`);
  check('step 1 whole', r.steps[0].endsWith('between each.'), r.steps[0]);
}

{
  const r = parseScanPage(load('waldorf'));
  console.log('\n— waldorf (DRESSING + SALAD sub-lists) —');
  check('title', r.name === 'CHICKEN WALDORF SALAD', String(r.name));
  check('servings 4', r.servings === 4, String(r.servings));
  check('dressing first', /balsamic vinegar/.test(r.ingredients[0]), r.ingredients[0]);
  check('salad included', r.ingredients.some((i) => /mixed greens/.test(i)), r.ingredients.join(' | '));
  check('apple joined', r.ingredients.some((i) => /Granny Smith/.test(i) && /pieces/.test(i)), r.ingredients.join(' | '));
  check('chicken joined', r.ingredients.some((i) => /12 to 16 ounces sliced grilled chicken breasts/.test(i)), r.ingredients.join(' | '));
  check('no method in ingredients', !r.ingredients.some((i) => /For dressing|whisking/.test(i)), r.ingredients.join(' | '));
  check('2 steps', r.steps.length === 2, `got ${r.steps.length}`);
  check('blended. kept in step 1', r.steps[0].endsWith('blended.'), r.steps[0]);
  check('quarter tsp pepper recovered', r.ingredients.some((i) => i === '¼ teaspoon black pepper'), r.ingredients.join(' | '));
}

{
  const r = parseScanPage(load('minipizza'));
  console.log('\n— minipizza (single column) —');
  check('title', r.name === 'MINI PIZZA PIES', String(r.name));
  check('servings 2', r.servings === 2, String(r.servings));
  check('5 ingredients', r.ingredients.length === 5, `got ${r.ingredients.length}`);
  check('full-width ingredient kept', r.ingredients.some((i) => /Shredded Parmesan/.test(i)), r.ingredients.join(' | '));
  check('no method in ingredients', !r.ingredients.some((i) => /Preheat|ramekins/.test(i)), r.ingredients.join(' | '));
  check('4 steps', r.steps.length === 4, `got ${r.steps.length}`);
  check('step 1 whole', r.steps[0].endsWith('cooking spray.'), r.steps[0]);
}

console.log('\n════════ magazine pages: the facing page bleeds in ════════');

{
  const r = parseScanPage(load('campbells'));
  console.log('\n— campbells —');
  check('title', r.name === 'SAVORY CHICKEN AND MUSHROOMS', String(r.name));
  check('servings 4', r.servings === 4, String(r.servings));
  check('margin bleed gone', !r.ingredients.some((i) => /linner|inging|Aleu|2546/.test(i)), r.ingredients.join(' | '));
  check('soup joined', r.ingredients.some((i) => /Condensed Cream of Chicken/.test(i)), r.ingredients.join(' | '));
  check('quarter cup milk recovered', r.ingredients.some((i) => i === '¼ Cup milk'), r.ingredients.join(' | '));
  check('chicken kept', r.ingredients.some((i) => /4 skinless, boneless chicken/.test(i)), r.ingredients.join(' | '));
  check('method found', r.steps.length >= 1 && /10-inch skillet/.test(r.steps[0]), JSON.stringify(r.steps).slice(0, 120));
  check('yield line not a step', !r.steps.some((s) => /^MAKES 4 MAIN/.test(s)), JSON.stringify(r.steps).slice(0, 160));
}

{
  const r = parseScanPage(load('spicecake'));
  console.log('\n— spicecake —');
  check('title', r.name === 'TOMATo SOUP-SPICE CAKE', String(r.name));
  check('servings 8', r.servings === 8, String(r.servings));
  check('margin bleed gone', !r.ingredients.some((i) => /Anazing|omatoes|Campo/.test(i)), r.ingredients.join(' | '));
  check('half tsp cloves recovered', r.ingredients.some((i) => i === '½ teaspoon ground cloves'), r.ingredients.join(' | '));
  check('4 teaspoons left alone', r.ingredients.some((i) => i === '4 teaspoons baking powder'), r.ingredients.join(' | '));
  check('frosting separate', r.ingredients.some((i) => /^Cream cheese frosting/.test(i)), r.ingredients.join(' | '));
  check('method found', r.steps.length >= 1 && /Preheat oven/.test(r.steps[0]), JSON.stringify(r.steps).slice(0, 120));
  check('timing lines not steps', !r.steps.some((s) => /^PREP TIME|^BAKE/.test(s)), JSON.stringify(r.steps).slice(0, 160));
}

console.log('\n════════ quantities ════════\n');
{
  const q = normalizeQuantity;
  check('4 teaspoon -> quarter', q('4 teaspoon black pepper') === '¼ teaspoon black pepper', q('4 teaspoon black pepper'));
  check('4 teaspoons untouched', q('4 teaspoons baking powder') === '4 teaspoons baking powder', q('4 teaspoons baking powder'));
  check('2 teaspoon -> half', q('2 teaspoon ground cloves') === '½ teaspoon ground cloves');
  check('2 teaspoons untouched', q('2 teaspoons paprika') === '2 teaspoons paprika');
  check('Ya cup -> quarter', q('Ya cup extra virgin olive oil') === '¼ cup extra virgin olive oil');
  check('VA teaspoon -> quarter', q('VA teaspoon red pepper flakes') === '¼ teaspoon red pepper flakes');
  check('A cup -> quarter', q('A cup crumbled feta cheese') === '¼ cup crumbled feta cheese');
  check('l cup -> 1', q('l cup water') === '1 cup water');
  check('8 cups untouched', q('8 cups mixed greens') === '8 cups mixed greens');
  check('3 cloves untouched', q('3 cloves garlic, sliced') === '3 cloves garlic, sliced');
  check('1 can untouched', q('1 can (28 ounces) crushed') === '1 can (28 ounces) crushed');
  check('6 eggs untouched', q('6 eggs') === '6 eggs');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
