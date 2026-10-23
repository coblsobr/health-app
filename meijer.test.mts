// @ts-nocheck — testing a plain .mjs module
import { parseList, hasList, pickProduct } from './tools/meijer-lib.mjs';

let pass = 0;
let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log('  ok  ', name); }
  else { fail++; console.log('  FAIL', name, `\n        got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
};

console.log('\n════════ the shared list ════════\n');
{
  const text = 'Hey!\nMEIJER LIST · 3 items\n1 | cherry tomatoes | Tomatoes, red (2 cup)\n3 | avocado | Avocados (3)\n9 | onion | Onions (9)\nsent from my phone';
  eq('reads the items, ignores the rest', parseList(text).map((i) => i.search), ['cherry tomatoes', 'avocado', 'onion']);
  eq('keeps the count', parseList(text)[1].qty, 3);
  eq('caps a silly count at 6', parseList(text)[2].qty, 6);
  eq('recognises a list', hasList(text), true);
  eq('and something that is not one', hasList('hello'), false);
}

console.log('\n════════ choosing a product ════════\n');
{
  // From a real search for "yellow onion" on meijer.com.
  const onions = [
    { name: 'Sweet Onion', href: '/sweet-onion/4166', sponsored: false, canAdd: true },
    { name: 'Organic Yellow Onion', href: '/organic-yellow-onion/1', sponsored: false, canAdd: true },
    { name: 'Yellow Onions, 3 lb', href: '/yellow-onions-3-lb/2', sponsored: false, canAdd: true },
    { name: 'Spanish Onion', href: '/spanish-onion/4093', sponsored: false, canAdd: true },
  ];
  eq('every word searched for beats the first result, and not organic', pickProduct('yellow onion', onions)?.href, '/yellow-onions-3-lb/2');
  eq('organic when asked for', pickProduct('organic yellow onion', onions)?.href, '/organic-yellow-onion/1');
  eq('a remembered product wins', pickProduct('yellow onion', onions, { remembered: '/spanish-onion/4093' })?.href, '/spanish-onion/4093');

  const beans = [
    { name: 'Westbrae Organic Garbanzo Beans 15 oz', href: '/w', sponsored: true, canAdd: true },
    { name: 'Meijer Garbanzo Beans, 15.5 oz', href: '/m', sponsored: false, canAdd: true },
    { name: 'Biena Sea Salt Chickpea Snacks, 5 oz', href: '/b', sponsored: false, canAdd: true },
  ];
  eq('not the ad, and the store brand', pickProduct('garbanzo beans', beans)?.href, '/m');
  eq('nothing close enough is nothing', pickProduct('japanese curry roux', beans), null);
  eq('out of stock is skipped', pickProduct('garbanzo beans', [{ ...beans[1], canAdd: false }]), null);
  // The four wrong picks from the first dry run against meijer.com.
  eq('chickpeas are garbanzo beans, not a snack',
    pickProduct('chickpeas', [{ name: 'Biena Sea Salt Chickpea Snacks, 5 oz', href: '/b', canAdd: true }, { name: 'Meijer Garbanzo Beans, 15.5 oz', href: '/m', canAdd: true }])?.href, '/m');
  eq('cornstarch is not bath powder',
    pickProduct('cornstarch', [{ name: 'MEIJER BABY CORNSTARCH POWDER COMMODITY BATH 22 OZ', href: '/x', canAdd: true }, { name: 'Argo Corn Starch 16 oz', href: '/a', canAdd: true }, { name: 'Meijer Cornstarch, 16 oz', href: '/c', canAdd: true }])?.href, '/c');
  eq('fresh ginger is not ground ginger',
    pickProduct('fresh ginger', [{ name: 'Meijer Ground Ginger, .7 oz', href: '/g', canAdd: true }, { name: 'Ginger Root', href: '/r', canAdd: true }])?.href, '/r');
  eq('vegan parmesan does not settle for mozzarella',
    pickProduct('vegan parmesan cheese', [{ name: 'Violife Just Like Mozzarella Shreds Shredded Cheese, Dairy-Free Vegan 8 oz', href: '/v', canAdd: true }]), null);
  eq('ground chipotle chile still finds the chile',
    pickProduct('ground chipotle chile', [{ name: 'McCormick Gourmet Chipotle Chile Pepper, 2.0 oz', href: '/p', canAdd: true }])?.href, '/p');
  eq('plural and singular match',pickProduct('tomatoes', [{ name: 'Roma Tomato', href: '/t', sponsored: false, canAdd: true }])?.href, '/t');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
