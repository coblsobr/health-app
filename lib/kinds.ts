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
  'Breakfast', 'Sweets & baking', 'Drinks', 'Sauces & dressings',
] as const;
export type MealKind = (typeof KINDS)[number];

/**
 * Things in a recipe library that are not a dinner. A real imported library
 * had muffins, cookies, a latte and four dressings in it, and a planner that
 * does not know that puts a mango lassi on a Tuesday. These stay out of the
 * plan unless asked for ("more" on the chip), rather than in unless skipped.
 */
export const NOT_DINNER: MealKind[] = ['Breakfast', 'Sweets & baking', 'Drinks', 'Sauces & dressings'];

const PROTEIN_WORDS: [MealKind, RegExp][] = [
  ['Chicken', /\b(chicken|turkey)\b/],
  ['Beef', /\b(beef|steak|brisket|chuck|sirloin|meatballs?|burgers?)\b/],
  ['Pork', /\b(pork|bacon|ham|sausages?|chorizo|prosciutto|pancetta|carnitas)\b/],
  ['Seafood', /\b(salmon|shrimp|prawns?|fish|cod|tuna|tilapia|scallops?|crab|halibut|mahi|lobster|mussels|clams)\b/],
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
  // Bowl With … Avocado Dressing" is a bowl.
  ['Sauces & dressings', /\b(dressing|vinaigrette|vinegarette|sauce|aioli|dip|marinade|salsa|gravy)$/],
];

/**
 * Broth and stock say nothing about the dish — a lentil soup made with
 * chicken stock is still a lentil soup — so those lines are ignored when
 * looking for the protein.
 */
const NOT_A_PROTEIN = /\b(broth|stock|bouillon|base|fish sauce|anchov)/;

export function inferKinds(r: {
  name: string;
  ingredients: string[];
  tags: string[];
  minutes: number | null;
}): MealKind[] {
  const name = r.name.toLowerCase();
  const lines = r.ingredients.map((l) => l.toLowerCase()).filter((l) => !NOT_A_PROTEIN.test(l));
  const tags = r.tags.map((t) => t.toLowerCase());
  const out = new Set<MealKind>();

  // The name wins: "Chicken tortilla soup" is chicken even if it also lists
  // bacon for the garnish.
  let proteins = PROTEIN_WORDS.filter(([, re]) => re.test(name)).map(([k]) => k);
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
  if (tags.includes('breakfast')) out.add('Breakfast');
  if (tags.some((t) => /dessert|baking|sweets?/.test(t))) out.add('Sweets & baking');
  if (tags.some((t) => /drinks?|beverages?/.test(t))) out.add('Drinks');

  if (tags.includes('quick') || (r.minutes != null && r.minutes > 0 && r.minutes <= 30)) out.add('Quick');

  return KINDS.filter((k) => out.has(k));
}
