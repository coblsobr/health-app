import {
  listPlan, getIngredientsFor, replacePlanGrocery, setSetting, getSetting,
} from './db';
import { buildGroceryList, servingsByRecipe } from './grocery';

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
  const details = await getIngredientsFor(sel.map((s) => s.id));
  const planned = sel.flatMap((s) => {
    const d = details.get(s.id);
    if (!d || d.lines.length === 0) return [];
    return [{
      recipeId: s.id, name: d.name, recipeServings: d.servings,
      neededServings: s.servings, ingredientLines: d.lines,
    }];
  });
  if (planned.length === 0) return 'Those recipes have no ingredients recorded yet.';
  await replacePlanGrocery(buildGroceryList(planned));
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
