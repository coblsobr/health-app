import { readFileSync } from 'fs';
import { parseScanPage } from './lib/scanParse.ts';
import type { ScanPage } from './lib/ocr.ts';

const raw = JSON.parse(readFileSync('fixtures/scans/batch1.json', 'utf8'));
const pages: Record<string, { w: number; h: number; lines: [string, number, number, number, number][] }> =
  raw.pages;

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

console.log('\n\n════════ assertions ════════');

/* ── beets: numbered method, two clean columns ── */
{
  const r = parseScanPage(load('beets'));
  console.log('\n— beets —');
  check('title', r.name === 'Cider Vinaigrete-Glazed Bets', String(r.name));
  check('servings 6', r.servings === 6, String(r.servings));
  check('9 ingredients', r.ingredients.length === 9, `got ${r.ingredients.length}`);
  check('wrapped name joined', r.ingredients[0] === '6 medium red and/or golden beets (about 3 pounds)', r.ingredients[0]);
  check('fraction misread kept', r.ingredients.some((i) => /teaspoon salt$/.test(i)), r.ingredients.join(' | '));
  check('no method in ingredients', !r.ingredients.some((i) => /Cut tops off|Secure lid/.test(i)));
  check('5 steps', r.steps.length === 5, `got ${r.steps.length}`);
  check('step 1 whole', r.steps[0].startsWith('Cut tops off beets') && r.steps[0].endsWith('hold beets).'), r.steps[0]);
  check('no ingredients in steps', !r.steps.some((s) => /crumbled blue/.test(s)));
}

/* ── chicken: same shape, different wrap points ── */
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

/* ── ribs: has a starred footnote that reads like ingredients ── */
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

/* ── bean bake: unnumbered prose method, full-width intro ── */
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

/* ── tofu: long intro, a digit that is NOT a new ingredient ── */
{
  const r = parseScanPage(load('tofu'));
  console.log('\n— tofu —');
  check('servings 4', r.servings === 4, String(r.servings));
  check('tofu block joined', r.ingredients.some((i) => i.includes('extra-firm tofu') && i.includes('have extra tofu')), r.ingredients.join(' | '));
  check('intro not ingredients', !r.ingredients.some((i) => /Project Plant-Based|chicken cutlet/.test(i)));
  check('rolls kept', r.ingredients.some((i) => /^4 potato rolls/.test(i)));
  check('several steps', r.steps.length >= 4, `got ${r.steps.length}`);
}

/* ── maitake: unnumbered, ingredients have a SERVING sub-heading ── */
{
  const r = parseScanPage(load('maitake'));
  console.log('\n— maitake —');
  check('servings 4', r.servings === 4, String(r.servings));
  check('mushrooms joined', r.ingredients.some((i) => i.includes('maitake') && i.includes('per person')), r.ingredients.join(' | '));
  check('intro not ingredients', !r.ingredients.some((i) => /hen-of-the-woods|arrest you/.test(i)));
  check('several steps', r.steps.length >= 3, `got ${r.steps.length}`);
  check('step 1 is the preheat', r.steps[0].startsWith('Preheat the oven'), r.steps[0]);
}

/* ── chopped tomatoes: a sidebar, not a full recipe ── */
{
  const r = parseScanPage(load('choppedtomatoes'));
  console.log('\n— choppedtomatoes —');
  check('5 ingredients', r.ingredients.length === 5, `got ${r.ingredients.length}`);
  check('tomatoes joined', r.ingredients[0] === '2 cups chopped fresh tomatoes (any kind)', r.ingredients[0]);
  check('method not in ingredients', !r.ingredients.some((i) => /béchamel|baking/.test(i)), r.ingredients.join(' | '));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
