import {
  listPlan, getIngredientsFor, replacePlanGrocery, setSetting, getSetting,
} from './db';
import { buildGroceryList, servingsByRecipe } from './grocery';
import { applySwaps, effectiveSwaps, inPantry } from './prefs';
import { loadPreferences } from './preferences';

/**
 * Plan → shopping list, in one place, because two screens have the button:
 * Plan ("Save & make grocery list") and Groceries ("Build from plan").
 */

export type Selection = { id: string; servings: number; name: string };

/** The range of the plan last saved, so the list covers that plan and no more. */
export type PlanRange = { from: string; to: string };

export async function getPlanRange(): Promise<PlanRange | null> {
  const raw = await getSetting('plan_range').catch(() => null);
  return raw ? (JSON.parse(raw) as PlanRange) : null;
}

export async function setPlanRange(r: PlanRange): Promise<void> {
  await setSetting('plan_range', JSON.stringify(r));
}

/**
 * Turn a selection of recipes into shopping lines and store it. Returns a
 * note to show when nothing could be built, or null.
 */
export async function groceriesFromSelection(sel: Selection[]): Promise<string | null> {
  await setSetting('grocery_recipes', JSON.stringify(sel));
  if (sel.length === 0) {
    await replacePlanGrocery([]);
    return null;
  }
  const [details, prefs] = await Promise.all([getIngredientsFor(sel.map((s) => s.id)), loadPreferences()]);
  // Yours, plus the stand-ins "mostly vegetarian" buys.
  const swaps = effectiveSwaps(prefs);
  const planned = sel.flatMap((s) => {
    const d = details.get(s.id);
    if (!d || d.lines.length === 0) return [];
    return [{
      recipeId: s.id, name: d.name, recipeServings: d.servings, neededServings: s.servings,
      // Swaps from Preferences ("chicken → Quorn chik'n") change what is bought,
      // not the recipe.
      ingredientLines: d.lines.map((l) => applySwaps(l, swaps)),
    }];
  });
  if (planned.length === 0) return 'Those recipes have no ingredients recorded yet.';
  const lines = buildGroceryList(planned).map((l) =>
    inPantry(l, prefs.pantry) ? { ...l, aisle: 'Check the pantry' as const } : l
  );
  await replacePlanGrocery(lines);
  return null;
}

/** Every dinner between two dates, added up per recipe, onto the list. */
export async function groceriesFromPlan(from: string, to: string): Promise<{ selection: Selection[]; note: string | null }> {
  const entries = await listPlan(from, to);
  if (entries.length === 0) {
    return { selection: [], note: 'Nothing is planned yet. Build a plan first and come back.' };
  }
  const needed = servingsByRecipe(entries);
  const names = new Map(entries.map((e) => [e.recipe_id, e.name]));
  const selection: Selection[] = [...needed.entries()].map(([id, servings]) => ({
    id, servings, name: names.get(id) ?? 'Recipe',
  }));
  const note = await groceriesFromSelection(selection);
  return { selection, note };
}

/* ── Meijer ─────────────────────────────────────────────────── */

/**
 * The list as text for the Meijer cart script (tools/meijer-cart.mjs), one
 * item a line: `qty | what to search | what the list called it`. Ticked items
 * and the pantry are left out — the cart is for what still needs buying.
 *
 * Quantity is how many to add: a bare count ("3" avocados) when there is one,
 * otherwise 1 — "2 cups spinach" is one bag, and the cart is easier to
 * adjust than to guess.
 */
export function meijerListText(items: { name: string; qty_text: string | null; search: string | null; aisle: string; is_purchased: number }[]): string {
  const want = items.filter((i) => !i.is_purchased && i.aisle !== 'Check the pantry');
  const lines = want.map((i) => {
    // "4" basil means four leaves, not four packs: herbs are always one.
    const herb = /basil|cilantro|coriander|parsley|mint|thyme|rosemary|sage|dill|oregano|chive|leaves?\b/i.test(`${i.name} ${i.search ?? ''}`);
    const n = !herb && i.qty_text && /^\d+$/.test(i.qty_text.trim()) ? Math.min(6, parseInt(i.qty_text, 10)) : 1;
    const search = (i.search || i.name).replace(/\|/g, ' ');
    return `${n} | ${search} | ${i.name.replace(/\|/g, ' ')}${i.qty_text ? ` (${i.qty_text})` : ''}`;
  });
  return [`MEIJER LIST · ${want.length} items`, ...lines].join('\n');
}
