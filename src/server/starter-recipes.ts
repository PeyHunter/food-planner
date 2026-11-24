import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Language } from "../shared/profile.ts";
import type { RecipeInput } from "../shared/recipes.ts";
import { starterRecipeInputs } from "../shared/starter-recipes.ts";
import type { AppDependencies } from "./app.ts";
import type { Database } from "./db.ts";
import { insertRecipe, kitchenMember, type MemberEnv, type Tx } from "./recipes.ts";
import { kitchens, recipes } from "./schema.ts";

/** Locks the kitchen row so two adds at once can't both go in. */
async function lockKitchen(tx: Tx, kitchenId: string) {
  const [row] = await tx.select({ kids: kitchens.kids, starterAddedAt: kitchens.starterAddedAt }).from(kitchens).where(eq(kitchens.id, kitchenId)).for("update");
  return row!;
}

async function addAll(tx: Tx, kitchenId: string, userId: string | null, language: Language, kids: boolean, extras: RecipeInput[] = []) {
  for (const input of [...starterRecipeInputs(language, kids), ...extras]) await insertRecipe(tx, kitchenId, userId, input);
  await tx.update(kitchens).set({ starterAddedAt: sql`coalesce(${kitchens.starterAddedAt}, now())` }).where(eq(kitchens.id, kitchenId));
}

/** Gives a new kitchen the starter recipes (and any extras for this kitchen) the first time; later calls do nothing. */
export async function addStarterRecipesOnce({ db }: Database, kitchenId: string, language: Language, extras: RecipeInput[] = []) {
  return db.transaction(async (tx) => {
    const kitchen = await lockKitchen(tx, kitchenId);
    if (kitchen.starterAddedAt) return false;
    await addAll(tx, kitchenId, null, language, kitchen.kids, extras);
    return true;
  });
}

/** The "Add 15 starter recipes" button on an empty recipe list. */
export function createStarterRoutes({ database, now }: AppDependencies) {
  const routes = new Hono<MemberEnv>();
  const member = kitchenMember({ database, now });

  routes.post("/api/recipes/starter", member, async (c) => {
    const { kitchenId, userId, language } = c.get("member");
    const added = await database.db.transaction(async (tx) => {
      const kitchen = await lockKitchen(tx, kitchenId);
      const [some] = await tx.select({ id: recipes.id }).from(recipes).where(eq(recipes.kitchenId, kitchenId)).limit(1);
      if (some) return false;
      await addAll(tx, kitchenId, userId, language, kitchen.kids);
      return true;
    });
    if (!added) return c.json({ error: "Your kitchen already has recipes." }, 409);
    return c.json({ added: starterRecipeInputs(language, true).length }, 201);
  });

  return routes;
}
