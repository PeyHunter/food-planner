import { sameIngredient } from "./ingredient-names.ts";
import type { RecipeSummary } from "./recipes.ts";

/** A recipe the kitchen could cook, with the ingredients it matches and the ones still missing. */
export type CanMake = { recipe: RecipeSummary; have: string[]; missing: string[] };

/** Recipes ranked by fewest missing ingredients, then most ingredients already at home, then title.
 * Recipes with no ingredient lines are left out: there is nothing to check against. */
export function canMake(items: { recipe: RecipeSummary; ingredients: string[] }[], have: string[]): CanMake[] {
  const owned = have.map((name) => name.trim()).filter(Boolean);
  const found: CanMake[] = [];
  for (const { recipe, ingredients } of items) {
    const needed = ingredients.map((name) => name.trim()).filter(Boolean);
    if (!needed.length) continue;
    const missing = needed.filter((name) => !owned.some((mine) => sameIngredient(name, mine)));
    const matches = owned.filter((mine) => needed.some((name) => sameIngredient(name, mine)));
    found.push({ recipe, have: matches, missing });
  }
  return found.sort((a, b) => a.missing.length - b.missing.length || b.have.length - a.have.length || a.recipe.title.localeCompare(b.recipe.title));
}
