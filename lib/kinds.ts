/**
 * What kind of meal a recipe is — chicken, pasta, soup — worked out from what
 * is already there: its name, its ingredients, its tags and its timings.
 *
 * Inferred rather than asked for, because a preference like "more chicken" is
 * useless if it only applies to the three recipes someone remembered to tag.
 * Pure, so it is tested in node alongside the planner.
 */

export const KINDS = [
  'Chicken', 'Beef', 'Pork', 'Seafood', 'Vegetarian',
  'Pasta', 'Soup & stew', 'Tacos & Mexican', 'Bowls & rice', 'Quick',
  'Breakfast', 'Sweets & baking', 'Drinks', 'Sauces & dressings', 'Sides',
] as const;
export type MealKind = (typeof KINDS)[number];

/**
 * Things in a recipe library that are not a dinner. A real imported library
 * had muffins, cookies, a latte and four dressings in it, and a planner that
 * does not know that puts a mango lassi on a Tuesday. These stay out of the
 * plan unless asked for ("more" on the chip), rather than in unless skipped.
 */
export const NOT_DINNER: MealKind[] = ['Breakfast', 'Sweets & baking', 'Drinks', 'Sauces & dressings', 'Sides'];

const PROTEIN_WORDS: [MealKind, RegExp][] = [
  ['Chicken', /\b(chicken|turkey)\b/],
  ['Beef', /\b(beef|steak|brisket|chuck|sirloin|meatballs?|burgers?)\b/],
  ['Pork', /\b(pork|bacon|ham|sausages?|chorizo|prosciutto|pancetta|carnitas)\b/],
  ['Seafood', /\b(seafood|salmon|shrimps?|prawns?|scampi|fish|cod|tuna|tilapia|scallops?|crabs?|halibut|mahi|lobsters?|mussels|clams|oysters?|squid|calamari|octopus|crawfish|crayfish|sardines?|trout|snapper|swordfish|haddock|pollock|catfish|mackerel|anchov(?:y|ies))\b/],
];

const DISH_WORDS: [MealKind, RegExp][] = [
  ['Pasta', /\b(pasta|spaghetti|penne|noodles?|linguine|fettuccine|macaroni|mac|lasagna|orzo|rigatoni|gnocchi|ziti|tortellini|ravioli|lo mein|ramen)\b/],
  ['Soup & stew', /\b(soup|stew|chili|chowder|bisque|pho)\b/],
  ['Tacos & Mexican', /\b(tacos?|burritos?|enchiladas?|quesadillas?|fajitas?|nachos|tostadas?|taquitos)\b/],
  ['Bowls & rice', /\b(bowls?|fried rice|risotto|stir[- ]?fry|rice|paella|jambalaya|jumbalaya|biryani)\b/],
  ['Breakfast', /\b(breakfast|pancakes?|crepes?|waffles?|eggs benedict|eggs florentine|egg muffins|oatmeal|granola|french toast)\b/],
  ['Sweets & baking', /\b(cookies?|muffins?|cakes?|cupcakes?|brownies?|cinnamon rolls?|bars?|bark|oatbar|scones?|fudge|dessert|cheesecake|pudding)\b/],
  ['Drinks', /\b(lassi|latte|smoothie|coffee|lemonade|cocktail|mocha|shake)\b/],
  // End of the name only: "Chipotle Ranch Dressing" is a dressing, "Barley
  // Bowl With … Avocado Dressing" is a bowl. Condiments too — "Hot Honey" was
  // planned as a dinner — but "Honey Garlic Tofu" is not honey.
  ['Sauces & dressings', /\b(dressing|vinaigrette|vinegarette|sauce|aioli|dip|marinade|salsa|gravy|honey|butter|jam|jelly|syrup|glaze|pesto|chutney|relish|pickles|pickled onions|seasoning|spice (?:blend|mix|rub)|rub|hummus|guacamole|ketchup|mayo|mayonnaise|crema|chili oil|chile oil|chili crisp|compote|croutons)$/],
];

/**
 * What a side looks like by name — vegetables, salads, potatoes, bread, rice —
 * judged on the part before any "with" ("Roasted Carrots with Tahini" is
 * carrots). Only a side when nothing filling is in it; see FILLING.
 */
const SIDE_WORDS = /\b(side|salad|slaw|coleslaw|vegetables|veggies|potatoes|potato wedges|fries|mash|bravas|sprouts|carrots|broccoli|broccolini|cauliflower|asparagus|green beans|corn|elote|rice|pilaf|bread|rolls|biscuits|cornbread|zucchini|squash|greens|kale|cucumbers?|beets|parsnips|mushrooms|peas)$/;

/** What makes a dish a meal rather than a side: a protein. Bacon on a salad is a garnish. */
const FILLING = /\b(tofu|tempeh|seitan|beans?|chickpeas?|garbanzo|lentils|eggs?|halloumi|paneer|edamame|crumbles|chik['’]?n)\b/;

/** The course a recipe site publishes (schema.org recipeCategory), read from tags. */
const COURSE_SAUCE = /^(condiments?|sauces?|dressings?|dips?|spreads?|seasonings?|spice (?:blends?|mix(?:es)?)|marinades?|toppings?|preserves|canning)$/;
const COURSE_SIDE = /^(sides?|side dish(?:es)?|sides? dish)$/;
const COURSE_MAIN = /^(main|mains|main course|main dish|main dishes|dinner|dinners|entr[eé]es?|supper)$/;

/**
 * Broth and stock say nothing about the dish — a lentil soup made with
 * chicken stock is still a lentil soup — so those lines are ignored when
 * looking for the protein.
 */
const NOT_A_PROTEIN = /\b(broth|stock|bouillon|base|fish sauce|anchov)/;

/** Words that make "chicken" or "bacon" a vegetarian product. */
const MEAT_FREE = /\b(vegan|vegetarian|veggie|plant[- ]based|meatless|meat[- ]free|quorn|impossible|beyond|gardein|morningstar|tofurky|fake|faux|chik['’]?n)\b/;

/**
 * How much meat a recipe has, for "mostly vegetarian".
 *
 *   'none'       — vegetarian already.
 *   'swappable'  — only meat with an easy vegetarian stand-in: ground beef or
 *                  turkey, crumbles, meatballs, sausage, bacon, and chicken
 *                  that is diced, shredded or boneless. The grocery list
 *                  buys the stand-in instead.
 *   'fixed'      — meat the dish is built around: steak, roasts, chops,
 *                  ribs, wings and drumsticks, lamb, ham, and all seafood.
 *
 * The user's words: "mostly vegetarian, but if it contains beef crumbles or
 * diced chicken, I can replace it with a vegetarian equivalent".
 */
export type MeatStatus = 'none' | 'swappable' | 'fixed';

const SEAFOOD = PROTEIN_WORDS.find(([k]) => k === 'Seafood')![1];
const FIXED_CUT = /\b(steaks?|roast|brisket|ribs?|chops?|loin|tenderloin|wings?|drumsticks?|legs?|whole chicken|bone[- ]in|lamb|veal|ham|prosciutto|pancetta|duck|venison)\b/;
const SWAPPABLE = /\b(ground (?:beef|turkey|chicken|pork)|crumbles|meatballs?|sausages?|chorizo|bacon|hot dogs?)\b/;
const ANY_MEAT = /\b(beef|steak|chicken|turkey|pork|bacon|ham|sausages?|chorizo|lamb|veal|meatballs?|prosciutto|pancetta|duck|brisket|crumbles)\b/;

export function meatStatus(r: { name: string; ingredients: string[] }): MeatStatus {
  const lines = (r.ingredients.length ? r.ingredients : [r.name])
    .map((l) => l.toLowerCase())
    .filter((l) => !NOT_A_PROTEIN.test(l) && !MEAT_FREE.test(l));
  let swappable = false;
  for (const l of lines) {
    if (SEAFOOD.test(l)) return 'fixed';
    if (!ANY_MEAT.test(l)) continue;
    // Boneless chicken in any form swaps; a bone-in cut does not. Chicken
    // tenderloins are the boneless strips, not a "loin".
    if (/\bchicken\b/.test(l) && !/\b(wings?|drumsticks?|legs?|whole|bone[- ]in|skin[- ]on)\b/.test(l)) { swappable = true; continue; }
    if (SWAPPABLE.test(l)) { swappable = true; continue; }
    if (FIXED_CUT.test(l) || /\b(beef|pork|lamb|veal|turkey|duck)\b/.test(l)) return 'fixed';
    swappable = true;
  }
  return swappable ? 'swappable' : 'none';
}

export function inferKinds(r: {
  name: string;
  ingredients: string[];
  tags: string[];
  minutes: number | null;
}): MealKind[] {
  const name = r.name.toLowerCase();
  // A stand-in is not the meat it stands in for: "Vegan Sesame Chicken" and
  // "1 package Quorn chik'n" are vegetarian.
  const lines = r.ingredients.map((l) => l.toLowerCase()).filter((l) => !NOT_A_PROTEIN.test(l) && !MEAT_FREE.test(l));
  const tags = r.tags.map((t) => t.toLowerCase());
  const out = new Set<MealKind>();

  // The name wins: "Chicken tortilla soup" is chicken even if it also lists
  // bacon for the garnish.
  let proteins = MEAT_FREE.test(name) ? [] : PROTEIN_WORDS.filter(([, re]) => re.test(name)).map(([k]) => k);
  // …but only when the ingredients agree. "Copycat P.F. Chang's Chicken
  // Lettuce Wraps" made with "1 lb chikn crumbles" is not chicken.
  if (proteins.length && r.ingredients.length) {
    proteins = proteins.filter((k) => lines.some((l) => PROTEIN_WORDS.find(([p]) => p === k)![1].test(l)));
  }
  if (proteins.length === 0) {
    proteins = PROTEIN_WORDS.filter(([, re]) => lines.some((l) => re.test(l))).map(([k]) => k);
  }
  proteins.forEach((k) => out.add(k));

  const meatless = tags.includes('vegetarian') || tags.includes('vegan');
  // Only call it vegetarian when there were ingredients to look through; a
  // recipe with none recorded is unknown, not meatless.
  if (meatless || (proteins.length === 0 && r.ingredients.length > 0)) out.add('Vegetarian');

  const bare = name.replace(/[^a-z]+$/, '');
  for (const [k, re] of DISH_WORDS) if (re.test(bare)) out.add(k);
  // "… with Avocado Dressing" is a dish that comes with a sauce, not a sauce.
  if (/\bwith\b/.test(name)) out.delete('Sauces & dressings');

  // Sides: named like one, and nothing filling in it.
  // Not split at "and": "Corn and Pepper Empanada" is an empanada.
  const head = name.split(/\s+with\s+/)[0].replace(/[^a-z]+$/, '');
  const filling = proteins.some((k) => k !== 'Pork' || lines.some((l) => /\b(pork|sausages?|chorizo|ham|carnitas)\b/.test(l)))
    || lines.some((l) => FILLING.test(l));
  if (!filling && SIDE_WORDS.test(head)) out.add('Sides');

  // The course the site published beats any guess from the name.
  if (tags.some((t) => COURSE_SAUCE.test(t))) out.add('Sauces & dressings');
  if (tags.some((t) => COURSE_SIDE.test(t))) out.add('Sides');
  if (tags.some((t) => COURSE_MAIN.test(t))) { out.delete('Sides'); out.delete('Sauces & dressings'); }
  if (out.has('Sauces & dressings')) out.delete('Sides');

  if (tags.includes('breakfast')) out.add('Breakfast');
  if (tags.some((t) => /dessert|baking|sweets?/.test(t))) out.add('Sweets & baking');
  if (tags.some((t) => /drinks?|beverages?/.test(t))) out.add('Drinks');

  if (tags.includes('quick') || (r.minutes != null && r.minutes > 0 && r.minutes <= 30)) out.add('Quick');

  return KINDS.filter((k) => out.has(k));
}

/**
 * The tags worth keeping from a recipe site: its course ("Main Course",
 * "Side Dish", "Condiment", "Dessert"…). Sites publish dozens of loose
 * keywords and the form drops them, but the course is what tells a dinner
 * from hot honey, so it is kept.
 */
export function courseTags(tags: string[]): string[] {
  return tags.filter((t) => {
    const l = t.trim().toLowerCase();
    return COURSE_SAUCE.test(l) || COURSE_SIDE.test(l) || COURSE_MAIN.test(l)
      || /^(breakfast|brunch|desserts?|baking|drinks?|beverages?|snacks?|appetizers?)$/.test(l);
  });
}
