import type { Language } from "../shared/profile.ts";
import { and, asc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { maxWord, nemligLink, type Remembered } from "../shared/nemlig.ts";
import type { ShopSection } from "../shared/recipes.ts";
import { buildShoppingList, restOfWeek, type ShoppingDay, type ShoppingRecipe, type ShoppingView } from "../shared/shopping.ts";
import type { Unit } from "../shared/units.ts";
import { defaultPeople, isDate, mondayOf, weekDates } from "../shared/week.ts";
import type { AppDependencies } from "./app.ts";
import { kitchenMember, type MemberEnv } from "./recipes.ts";
import { sameGroceryAs } from "./same-grocery.ts";
import { childDays, children, ingredients, planDays, planSides, recipeLines, recipes, shoppingExtras, shoppingTicks } from "./schema.ts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const maxKey = 120;
const maxName = 80;
const extraKey = (id: string) => `extra:${id}`;

type Body = Record<string, unknown>;
const readBody = async (request: { json(): Promise<unknown> }): Promise<Body> => {
  const body = await request.json().catch(() => undefined);
  return body && typeof body === "object" ? (body as Body) : {};
};

export function createShoppingRoutes({ database, now }: AppDependencies) {
  const { db } = database;
  const routes = new Hono<MemberEnv>();
  const member = kitchenMember({ database, now });

  /** The planned days, each with its dinner and child meals, ready for the list builder. */
  async function loadDays(kitchenId: string, dates: string[]): Promise<ShoppingDay[]> {
    if (!dates.length) return [];
    const [dayRows, childRows, sideRows, kids] = await Promise.all([
      db
        .select()
        .from(planDays)
        .where(and(eq(planDays.kitchenId, kitchenId), inArray(planDays.date, dates))),
      db
        .select({ childId: childDays.childId, date: childDays.date, kind: childDays.kind, recipeId: childDays.recipeId, name: children.name })
        .from(childDays)
        .innerJoin(children, eq(children.id, childDays.childId))
        .where(and(eq(children.kitchenId, kitchenId), inArray(childDays.date, dates)))
        .orderBy(asc(children.createdAt), asc(children.id)),
      db
        .select()
        .from(planSides)
        .where(and(eq(planSides.kitchenId, kitchenId), inArray(planSides.date, dates)))
        .orderBy(asc(planSides.position)),
      db
        .select({ id: children.id, sameAsDinnerByDefault: children.sameAsDinnerByDefault })
        .from(children)
        .where(eq(children.kitchenId, kitchenId)),
    ]);
    const recipeIds = [...new Set([...dayRows.map((row) => (row.fromFreezer ? null : row.dinnerRecipeId)), ...sideRows.map((row) => row.recipeId), ...childRows.map((row) => (row.kind === "recipe" ? row.recipeId : null))].filter((id) => id !== null))];
    const [recipeRows, lineRows] = recipeIds.length
      ? await Promise.all([
          db
            .select({ id: recipes.id, title: recipes.title, feeds: recipes.feeds })
            .from(recipes)
            .where(and(eq(recipes.kitchenId, kitchenId), inArray(recipes.id, recipeIds))),
          db
            .select({
              recipeId: recipeLines.recipeId,
              amount: recipeLines.amount,
              unit: recipeLines.unit,
              ingredient: {
                id: ingredients.id,
                name: ingredients.name,
                shopSection: ingredients.shopSection,
                packAmount: ingredients.packAmount,
                packUnit: ingredients.packUnit,
                pieceGrams: ingredients.pieceGrams,
                alwaysAtHome: ingredients.alwaysAtHome,
              },
            })
            .from(recipeLines)
            .innerJoin(ingredients, eq(ingredients.id, recipeLines.ingredientId))
            .where(inArray(recipeLines.recipeId, recipeIds))
            .orderBy(asc(recipeLines.recipeId), asc(recipeLines.position)),
        ])
      : [[], []];
    const byId = new Map<string, ShoppingRecipe>(recipeRows.map((row) => [row.id, { title: row.title, feeds: row.feeds, lines: [] }]));
    const aliases = lineRows.length ? await sameGroceryAs(database, kitchenId) : new Map();
    for (const { recipeId, amount, unit, ingredient } of lineRows) {
      byId.get(recipeId)?.lines.push({
        amount,
        unit: unit as Unit | null,
        ingredient: aliases.get(ingredient.id) ?? { ...ingredient, shopSection: ingredient.shopSection as ShopSection, packUnit: ingredient.packUnit as Unit | null },
      });
    }
    return dates.map((date) => {
      const row = dayRows.find((day) => day.date === date);
      const meals = childRows.filter((meal) => meal.date === date);
      // A child who eats the dinner by default does so on any day with a dinner and nothing else planned for them.
      const byDefault = row?.dinnerRecipeId ? kids.filter((kid) => kid.sameAsDinnerByDefault && !meals.some((meal) => meal.childId === kid.id)).length : 0;
      return {
        date,
        people: row?.people ?? defaultPeople,
        // A dinner from the freezer is already cooked, so it needs nothing from the shop.
        dinner: (row?.dinnerRecipeId && !row.fromFreezer && byId.get(row.dinnerRecipeId)) || null,
        // Side dishes only count next to a dinner; one from the freezer still needs its salad bought.
        sides: row?.dinnerRecipeId ? sideRows.filter((side) => side.date === date).flatMap((side) => byId.get(side.recipeId) ?? []) : [],
        sameAsDinner: meals.filter((meal) => meal.kind === "same-as-dinner").length + byDefault,
        childMeals: meals.flatMap((meal) => {
          const recipe = meal.kind === "recipe" && meal.recipeId ? byId.get(meal.recipeId) : undefined;
          return recipe ? [{ childName: meal.name, recipe }] : [];
        }),
      };
    });
  }

  async function loadView(kitchenId: string, monday: string, dates: string[], language: Language = "en"): Promise<ShoppingView> {
    const [days, tickRows, extraRows] = await Promise.all([
      loadDays(kitchenId, dates),
      db
        .select({ key: shoppingTicks.itemKey, cleared: shoppingTicks.cleared })
        .from(shoppingTicks)
        .where(and(eq(shoppingTicks.kitchenId, kitchenId), eq(shoppingTicks.monday, monday))),
      db
        .select({ id: shoppingExtras.id, name: shoppingExtras.name })
        .from(shoppingExtras)
        .where(and(eq(shoppingExtras.kitchenId, kitchenId), eq(shoppingExtras.monday, monday)))
        .orderBy(asc(shoppingExtras.createdAt), asc(shoppingExtras.id)),
    ]);
    const ticked = new Set(tickRows.filter((row) => !row.cleared).map((row) => row.key));
    const cleared = new Set(tickRows.filter((row) => row.cleared).map((row) => row.key));
    const sections = buildShoppingList(days, language)
      .map(({ section, lines }) => ({ section, lines: lines.filter((line) => !cleared.has(line.key)).map((line) => ({ ...line, ticked: ticked.has(line.key) })) }))
      .filter((section) => section.lines.length > 0);
    return {
      monday,
      days: dates,
      sections,
      extras: extraRows.map((row) => ({ key: extraKey(row.id), id: row.id, name: row.name, ticked: ticked.has(extraKey(row.id)) })),
      cleared: cleared.size,
    };
  }

  const weekOf = (monday: string) => (isDate(monday) && mondayOf(monday) === monday ? monday : undefined);

  // ?days=2026-03-04,2026-03-05 picks days of that week; without it, the rest of the week from ?today.
  routes.get("/api/shopping/:monday", member, async (c) => {
    const monday = weekOf(c.req.param("monday"));
    if (!monday) return c.json({ error: "A week starts on a Monday (YYYY-MM-DD)." }, 400);
    const week = weekDates(monday);
    const asked = c.req.query("days");
    let dates: string[];
    if (asked === undefined) {
      const today = c.req.query("today");
      const from = today && isDate(today) ? today : now().toISOString().slice(0, 10);
      dates = mondayOf(from) === monday ? restOfWeek(from) : week;
    } else {
      dates = asked ? [...new Set(asked.split(","))].sort() : [];
      if (dates.some((date) => !week.includes(date))) return c.json({ error: "Pick days in that week." }, 400);
    }
    const { kitchenId, language } = c.get("member");
    return c.json(await loadView(kitchenId, monday, dates, language));
  });

  // Sets a tick to the given state rather than flipping it, so two phones tapping at once agree.
  routes.put("/api/shopping/:monday/ticks", member, async (c) => {
    const monday = weekOf(c.req.param("monday"));
    if (!monday) return c.json({ error: "A week starts on a Monday (YYYY-MM-DD)." }, 400);
    const { kitchenId, userId } = c.get("member");
    const body = await readBody(c.req);
    const key = typeof body.key === "string" ? body.key : "";
    if (!key || key.length > maxKey || typeof body.ticked !== "boolean") return c.json({ error: "Send an item and whether it is ticked." }, 400);
    if (body.ticked) {
      await db
        .insert(shoppingTicks)
        .values({ kitchenId, monday, itemKey: key, tickedBy: userId })
        .onConflictDoUpdate({ target: [shoppingTicks.kitchenId, shoppingTicks.monday, shoppingTicks.itemKey], set: { cleared: false } });
    } else {
      await db.delete(shoppingTicks).where(and(eq(shoppingTicks.kitchenId, kitchenId), eq(shoppingTicks.monday, monday), eq(shoppingTicks.itemKey, key)));
    }
    return c.body(null, 204);
  });

  // "Bought it all": ticks every item sent, then clears the ticked ones like "Clear ticked".
  routes.post("/api/shopping/:monday/bought", member, async (c) => {
    const monday = weekOf(c.req.param("monday"));
    if (!monday) return c.json({ error: "A week starts on a Monday (YYYY-MM-DD)." }, 400);
    const { kitchenId, userId } = c.get("member");
    const body = await readBody(c.req);
    const keys = Array.isArray(body.keys) ? [...new Set(body.keys)] : [];
    if (keys.length > 500 || keys.some((key) => typeof key !== "string" || !key || key.length > maxKey)) return c.json({ error: "Send the items you bought." }, 400);
    if (keys.length) {
      await db
        .insert(shoppingTicks)
        .values((keys as string[]).map((itemKey) => ({ kitchenId, monday, itemKey, tickedBy: userId })))
        .onConflictDoUpdate({ target: [shoppingTicks.kitchenId, shoppingTicks.monday, shoppingTicks.itemKey], set: { cleared: false } });
    }
    await clearTicked(kitchenId, monday);
    return c.body(null, 204);
  });

  routes.post("/api/shopping/:monday/extras", member, async (c) => {
    const monday = weekOf(c.req.param("monday"));
    if (!monday) return c.json({ error: "A week starts on a Monday (YYYY-MM-DD)." }, 400);
    const { kitchenId, userId } = c.get("member");
    const body = await readBody(c.req);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return c.json({ error: "Write what to buy." }, 400);
    if (name.length > maxName) return c.json({ error: "That is too long. Keep it short." }, 400);
    const [row] = await db.insert(shoppingExtras).values({ kitchenId, monday, name, createdBy: userId }).returning({ id: shoppingExtras.id });
    return c.json({ id: row!.id }, 201);
  });

  routes.delete("/api/shopping/:monday/extras/:id", member, async (c) => {
    const monday = weekOf(c.req.param("monday"));
    const id = c.req.param("id");
    if (!monday || !uuidPattern.test(id)) return c.json({ error: "No such item." }, 404);
    const { kitchenId } = c.get("member");
    const [row] = await db
      .delete(shoppingExtras)
      .where(and(eq(shoppingExtras.id, id), eq(shoppingExtras.kitchenId, kitchenId), eq(shoppingExtras.monday, monday)))
      .returning({ id: shoppingExtras.id });
    if (!row) return c.json({ error: "No such item." }, 404);
    await db.delete(shoppingTicks).where(and(eq(shoppingTicks.kitchenId, kitchenId), eq(shoppingTicks.monday, monday), eq(shoppingTicks.itemKey, extraKey(id))));
    return c.body(null, 204);
  });

  // Ticked extras go away; ticked list lines are hidden until "Bring back".
  routes.post("/api/shopping/:monday/clear", member, async (c) => {
    const monday = weekOf(c.req.param("monday"));
    if (!monday) return c.json({ error: "A week starts on a Monday (YYYY-MM-DD)." }, 400);
    await clearTicked(c.get("member").kitchenId, monday);
    return c.body(null, 204);
  });

  async function clearTicked(kitchenId: string, monday: string) {
    const thisWeek = and(eq(shoppingTicks.kitchenId, kitchenId), eq(shoppingTicks.monday, monday));
    await db.transaction(async (tx) => {
      const gone = await tx
        .delete(shoppingExtras)
        .where(
          and(
            eq(shoppingExtras.kitchenId, kitchenId),
            eq(shoppingExtras.monday, monday),
            sql`'extra:' || ${shoppingExtras.id} in (select ${shoppingTicks.itemKey} from ${shoppingTicks} where ${thisWeek} and not ${shoppingTicks.cleared})`,
          ),
        )
        .returning({ id: shoppingExtras.id });
      if (gone.length) await tx.delete(shoppingTicks).where(and(thisWeek, inArray(shoppingTicks.itemKey, gone.map((row) => extraKey(row.id)))));
      await tx.update(shoppingTicks).set({ cleared: true }).where(thisWeek);
    });
  }

  routes.post("/api/shopping/:monday/bring-back", member, async (c) => {
    const monday = weekOf(c.req.param("monday"));
    if (!monday) return c.json({ error: "A week starts on a Monday (YYYY-MM-DD)." }, 400);
    const { kitchenId } = c.get("member");
    await db.delete(shoppingTicks).where(and(eq(shoppingTicks.kitchenId, kitchenId), eq(shoppingTicks.monday, monday), eq(shoppingTicks.cleared, true)));
    return c.body(null, 204);
  });

  // The nemlig.com words and product links the kitchen picked, by ingredient id. The app never calls nemlig.com itself.
  routes.get("/api/nemlig/remembered", member, async (c) => {
    const rows = await db
      .select({ id: ingredients.id, word: ingredients.nemligWord, link: ingredients.nemligLink })
      .from(ingredients)
      .where(and(eq(ingredients.kitchenId, c.get("member").kitchenId), or(isNotNull(ingredients.nemligWord), isNotNull(ingredients.nemligLink))));
    return c.json(Object.fromEntries(rows.map(({ id, word, link }) => [id, { word, link } satisfies Remembered])));
  });

  // Null forgets the word or link, so the next send uses the usual search word again.
  routes.put("/api/nemlig/ingredients/:id", member, async (c) => {
    const id = c.req.param("id");
    if (!uuidPattern.test(id)) return c.json({ error: "No such ingredient." }, 404);
    const body = await readBody(c.req);
    const change: { nemligWord?: string | null; nemligLink?: string | null } = {};
    if ("word" in body) {
      const word = typeof body.word === "string" ? body.word.trim() : body.word;
      if (word !== null && (typeof word !== "string" || word.length > maxWord)) return c.json({ error: "Write a short search word." }, 400);
      change.nemligWord = word || null;
    }
    if ("link" in body) {
      const link = body.link === null || body.link === "" ? null : typeof body.link === "string" ? nemligLink(body.link) : undefined;
      if (link === undefined) return c.json({ error: "Paste a link to a nemlig.com page." }, 400);
      change.nemligLink = link;
    }
    if (!Object.keys(change).length) return c.json({ error: "Send a word or a link." }, 400);
    const [row] = await db
      .update(ingredients)
      .set(change)
      .where(and(eq(ingredients.id, id), eq(ingredients.kitchenId, c.get("member").kitchenId)))
      .returning({ word: ingredients.nemligWord, link: ingredients.nemligLink });
    if (!row) return c.json({ error: "No such ingredient." }, 404);
    return c.json(row satisfies Remembered);
  });

  return routes;
}
