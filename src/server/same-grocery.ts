import { asc, eq } from "drizzle-orm";
import { groceryOf } from "../shared/groceries.ts";
import type { ShopSection } from "../shared/recipes.ts";
import type { ShoppingIngredient } from "../shared/shopping.ts";
import type { Unit } from "../shared/units.ts";
import type { Database } from "./db.ts";
import { ingredients } from "./schema.ts";

/**
 * A kitchen can hold one thing under two names ("Løg" from a Danish recipe, "Onion" from an English one).
 * This maps each later name to the kitchen's oldest ingredient for the same grocery, so the shopping list buys it once.
 * The oldest one wins so the line's key, and its tick, stays the same whichever days are picked.
 */
export async function sameGroceryAs({ db }: Database, kitchenId: string): Promise<Map<string, ShoppingIngredient>> {
  const rows = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      shopSection: ingredients.shopSection,
      packAmount: ingredients.packAmount,
      packUnit: ingredients.packUnit,
      pieceGrams: ingredients.pieceGrams,
      alwaysAtHome: ingredients.alwaysAtHome,
    })
    .from(ingredients)
    .where(eq(ingredients.kitchenId, kitchenId))
    .orderBy(asc(ingredients.createdAt), asc(ingredients.id));
  const first = new Map<object, ShoppingIngredient>();
  const aliases = new Map<string, ShoppingIngredient>();
  for (const row of rows) {
    const grocery = groceryOf(row.name);
    if (!grocery) continue;
    const kept = first.get(grocery);
    if (kept) aliases.set(row.id, kept);
    else first.set(grocery, { ...row, shopSection: row.shopSection as ShopSection, packUnit: row.packUnit as Unit | null });
  }
  return aliases;
}
