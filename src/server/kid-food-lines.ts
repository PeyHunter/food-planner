import { asc, eq } from "drizzle-orm";
import type { Database } from "./db.ts";
import { ingredients, recipeLines, recipes } from "./schema.ts";

/** Each of the kitchen's recipes' ingredient names and notes, for the kid food warnings. */
export async function kitchenLines({ db }: Database, kitchenId: string) {
  const rows = await db
    .select({ recipeId: recipeLines.recipeId, ingredient: ingredients.name, note: recipeLines.note })
    .from(recipeLines)
    .innerJoin(ingredients, eq(ingredients.id, recipeLines.ingredientId))
    .innerJoin(recipes, eq(recipes.id, recipeLines.recipeId))
    .where(eq(recipes.kitchenId, kitchenId))
    .orderBy(asc(recipeLines.recipeId), asc(recipeLines.position));
  const byRecipe = new Map<string, { ingredient: string; note: string }[]>();
  for (const { recipeId, ingredient, note } of rows) {
    const list = byRecipe.get(recipeId) ?? [];
    list.push({ ingredient, note });
    byRecipe.set(recipeId, list);
  }
  return byRecipe;
}
