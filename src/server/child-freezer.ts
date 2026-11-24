import { and, asc, eq, gt, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { FreezerItem } from "../shared/week.ts";
import type { AppDependencies } from "./app.ts";
import type { Database } from "./db.ts";
import type { Queries } from "./freezer.ts";
import { kitchenMember, recipeSummaries, type MemberEnv } from "./recipes.ts";
import { childFreezerPortions, children, recipes } from "./schema.ts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const maxStep = 50;

type Db = Database["db"];

/** Adds (or with a negative number takes out) portions; the count never goes below 0. Returns the new count. */
export async function addChildPortions(db: Queries, childId: string, recipeId: string, add: number, by: string | null) {
  const [row] = await db
    .insert(childFreezerPortions)
    .values({ childId, recipeId, count: Math.max(add, 0), updatedBy: by })
    .onConflictDoUpdate({
      target: [childFreezerPortions.childId, childFreezerPortions.recipeId],
      set: { count: sql`greatest(${childFreezerPortions.count} + ${add}, 0)`, updatedBy: by, updatedAt: sql`now()` },
    })
    .returning({ count: childFreezerPortions.count });
  return row!.count;
}

/** Takes one portion out. False when there is none left. */
export async function takeChildPortion(db: Queries, childId: string, recipeId: string, by: string | null) {
  const rows = await db
    .update(childFreezerPortions)
    .set({ count: sql`${childFreezerPortions.count} - 1`, updatedBy: by, updatedAt: sql`now()` })
    .where(and(eq(childFreezerPortions.childId, childId), eq(childFreezerPortions.recipeId, recipeId), gt(childFreezerPortions.count, 0)))
    .returning({ count: childFreezerPortions.count });
  return rows.length > 0;
}

export const childFreezerCounts = (db: Db, childId: string) =>
  db
    .select({ recipeId: childFreezerPortions.recipeId, count: childFreezerPortions.count })
    .from(childFreezerPortions)
    .where(and(eq(childFreezerPortions.childId, childId), gt(childFreezerPortions.count, 0)));

export function createChildFreezerRoutes({ database, now }: AppDependencies) {
  const { db } = database;
  const routes = new Hono<MemberEnv>();
  const member = kitchenMember({ database, now });

  async function ownChild(kitchenId: string, id: string) {
    if (!uuidPattern.test(id)) return undefined;
    const [row] = await db
      .select({ id: children.id })
      .from(children)
      .where(and(eq(children.id, id), eq(children.kitchenId, kitchenId)));
    return row?.id;
  }

  routes.get("/api/children/:childId/freezer", member, async (c) => {
    const childId = await ownChild(c.get("member").kitchenId, c.req.param("childId"));
    if (!childId) return c.json({ error: "No such child." }, 404);
    const rows = await db
      .select({ id: recipes.id, title: recipes.title, feeds: recipes.feeds, count: childFreezerPortions.count })
      .from(childFreezerPortions)
      .innerJoin(recipes, eq(recipes.id, childFreezerPortions.recipeId))
      .where(and(eq(childFreezerPortions.childId, childId), gt(childFreezerPortions.count, 0)))
      .orderBy(asc(recipes.title), asc(recipes.id));
    const counts = new Map(rows.map((row) => [row.id, row.count]));
    const summaries = await recipeSummaries(
      database,
      rows.map(({ id, title, feeds }) => ({ id, title, feeds })),
    );
    const items: FreezerItem[] = summaries.map((recipe) => ({ recipe, count: counts.get(recipe.id)! }));
    return c.json(items);
  });

  // { add: 1 } / { add: -1 } from the + / − buttons.
  routes.post("/api/children/:childId/freezer/:recipeId", member, async (c) => {
    const { kitchenId, userId } = c.get("member");
    const childId = await ownChild(kitchenId, c.req.param("childId"));
    if (!childId) return c.json({ error: "No such child." }, 404);
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
    return c.json({ count: await addChildPortions(db, childId, recipeId, add, userId) });
  });

  return routes;
}
