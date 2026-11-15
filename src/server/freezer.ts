import { and, asc, eq, gt, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { FreezerItem } from "../shared/week.ts";
import type { AppDependencies } from "./app.ts";
import type { Database } from "./db.ts";
import { kitchenMember, recipeSummaries, type MemberEnv } from "./recipes.ts";
import { freezerPortions, recipes } from "./schema.ts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const maxStep = 50;

type Db = Database["db"];
export type Queries = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Adds (or with a negative number takes out) portions; the count never goes below 0. Returns the new count. */
export async function addPortions(db: Queries, kitchenId: string, recipeId: string, add: number, by: string | null) {
  const [row] = await db
    .insert(freezerPortions)
    .values({ kitchenId, recipeId, count: Math.max(add, 0), updatedBy: by })
    .onConflictDoUpdate({
      target: [freezerPortions.kitchenId, freezerPortions.recipeId],
      set: { count: sql`greatest(${freezerPortions.count} + ${add}, 0)`, updatedBy: by, updatedAt: sql`now()` },
    })
    .returning({ count: freezerPortions.count });
  return row!.count;
}

/** Takes one portion out. False when there is none left. */
export async function takePortion(db: Queries, kitchenId: string, recipeId: string, by: string | null) {
  const rows = await db
    .update(freezerPortions)
    .set({ count: sql`${freezerPortions.count} - 1`, updatedBy: by, updatedAt: sql`now()` })
    .where(and(eq(freezerPortions.kitchenId, kitchenId), eq(freezerPortions.recipeId, recipeId), gt(freezerPortions.count, 0)))
    .returning({ count: freezerPortions.count });
  return rows.length > 0;
}

export const freezerCounts = (db: Db, kitchenId: string) =>
  db
    .select({ recipeId: freezerPortions.recipeId, count: freezerPortions.count })
    .from(freezerPortions)
    .where(and(eq(freezerPortions.kitchenId, kitchenId), gt(freezerPortions.count, 0)));

export function createFreezerRoutes({ database, now }: AppDependencies) {
  const { db } = database;
  const routes = new Hono<MemberEnv>();
  const member = kitchenMember({ database, now });

  routes.get("/api/freezer", member, async (c) => {
    const { kitchenId } = c.get("member");
    const rows = await db
      .select({ id: recipes.id, title: recipes.title, feeds: recipes.feeds, count: freezerPortions.count })
      .from(freezerPortions)
      .innerJoin(recipes, eq(recipes.id, freezerPortions.recipeId))
      .where(and(eq(freezerPortions.kitchenId, kitchenId), gt(freezerPortions.count, 0)))
      .orderBy(asc(recipes.title), asc(recipes.id));
    const counts = new Map(rows.map((row) => [row.id, row.count]));
    const summaries = await recipeSummaries(
      database,
      rows.map(({ id, title, feeds }) => ({ id, title, feeds })),
    );
    const items: FreezerItem[] = summaries.map((recipe) => ({ recipe, count: counts.get(recipe.id)! }));
    return c.json(items);
  });

  // { add: 6 } after a cook, or { add: 1 } / { add: -1 } from the + / − buttons.
  routes.post("/api/freezer/:recipeId", member, async (c) => {
    const { kitchenId, userId } = c.get("member");
    const recipeId = c.req.param("recipeId");
    const body = (await c.req.json().catch(() => ({}))) as { add?: unknown };
    const add = body.add;
    if (typeof add !== "number" || !Number.isInteger(add) || add === 0 || Math.abs(add) > maxStep) return c.json({ error: `Send a whole number of portions, up to ${maxStep}.` }, 400);
    if (!uuidPattern.test(recipeId)) return c.json({ error: "No such recipe." }, 404);
    const [own] = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(and(eq(recipes.id, recipeId), eq(recipes.kitchenId, kitchenId)));
    if (!own) return c.json({ error: "No such recipe." }, 404);
    return c.json({ count: await addPortions(db, kitchenId, recipeId, add, userId) });
  });

  return routes;
}
