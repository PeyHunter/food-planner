import { and, asc, between, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { isBabyOnly, suggestSwaps } from "../shared/rule-swaps.ts";
import { checkRules, ruleOps, ruleSentence, type ChildMeal, type PlanDay, type Rule, type RuleOp } from "../shared/rules.ts";
import { childRecipeTag, defaultPeople, isDate, maxPeople, mondayOf, sameAsDinnerPortion, weekDates, type Child, type ChildDayKind, type WeekView } from "../shared/week.ts";
import type { AppDependencies } from "./app.ts";
import { kitchenMember, recipeSummaries, type MemberEnv } from "./recipes.ts";
import { childDays, children, planDays, recipes, rules } from "./schema.ts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const childKinds: ChildDayKind[] = ["empty", "same-as-dinner", "recipe"];

type Body = Record<string, unknown>;
const readBody = async (request: { json(): Promise<unknown> }): Promise<Body> => {
  const body = await request.json().catch(() => undefined);
  return body && typeof body === "object" ? (body as Body) : {};
};

export function createWeekRoutes({ database, now }: AppDependencies) {
  const { db } = database;
  const routes = new Hono<MemberEnv>();
  const member = kitchenMember({ database, now });
  const serverToday = () => now().toISOString().slice(0, 10);
  const todayFrom = (value: unknown) => (typeof value === "string" && isDate(value) ? value : serverToday());

  async function ownRecipeId(kitchenId: string, id: unknown) {
    if (typeof id !== "string" || !uuidPattern.test(id)) return undefined;
    const [row] = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(and(eq(recipes.id, id), eq(recipes.kitchenId, kitchenId)));
    return row?.id;
  }

  async function ownChildId(kitchenId: string, id: unknown) {
    if (typeof id !== "string" || !uuidPattern.test(id)) return undefined;
    const [row] = await db
      .select({ id: children.id })
      .from(children)
      .where(and(eq(children.id, id), eq(children.kitchenId, kitchenId)));
    return row?.id;
  }

  async function loadWeek(kitchenId: string, monday: string, today: string): Promise<WeekView> {
    const dates = weekDates(monday);
    const sunday = dates[6]!;
    const [kids, recipeRows, dayRows, ruleRows] = await Promise.all([
      db
        .select({ id: children.id, name: children.name, birthday: children.birthday })
        .from(children)
        .where(eq(children.kitchenId, kitchenId))
        .orderBy(asc(children.createdAt), asc(children.id)),
      db
        .select({ id: recipes.id, title: recipes.title, feeds: recipes.feeds, ageFrom: recipes.ageFromMonths, ageTo: recipes.ageToMonths })
        .from(recipes)
        .where(eq(recipes.kitchenId, kitchenId)),
      db
        .select()
        .from(planDays)
        .where(and(eq(planDays.kitchenId, kitchenId), between(planDays.date, monday, sunday))),
      db
        .select({ id: rules.id, childId: rules.childId, op: rules.op, n: rules.n, what: rules.what, createdAt: rules.createdAt })
        .from(rules)
        .where(eq(rules.kitchenId, kitchenId)),
    ]);
    const childRows = kids.length
      ? await db
          .select()
          .from(childDays)
          .where(
            and(
              inArray(
                childDays.childId,
                kids.map((kid) => kid.id),
              ),
              between(childDays.date, monday, sunday),
            ),
          )
      : [];
    const summaries = await recipeSummaries(
      database,
      recipeRows.map(({ id, title, feeds }) => ({ id, title, feeds })),
    );
    const byId = new Map(summaries.map((summary) => [summary.id, summary]));
    const forChildren = new Set(recipeRows.filter((row) => row.ageFrom !== null || row.ageTo !== null).map((row) => row.id));
    for (const summary of summaries) if (summary.tags.includes(childRecipeTag)) forChildren.add(summary.id);
    const babyOnly = new Set(recipeRows.filter((row) => isBabyOnly(row.ageTo)).map((row) => row.id));

    const days = dates.map((date) => {
      const row = dayRows.find((day) => day.date === date);
      const dinner = (row?.dinnerRecipeId && byId.get(row.dinnerRecipeId)) || null;
      const meals = kids.map((kid) => {
        const childRow = childRows.find((day) => day.childId === kid.id && day.date === date);
        const recipe = (childRow?.recipeId && byId.get(childRow.recipeId)) || null;
        const kind: ChildDayKind = childRow?.kind === "same-as-dinner" ? "same-as-dinner" : recipe ? "recipe" : "empty";
        return { childId: kid.id, kind, recipe };
      });
      return { date, people: row?.people ?? defaultPeople, dinner, extraPortions: meals.filter((meal) => meal.kind === "same-as-dinner").length * sameAsDinnerPortion, children: meals };
    });

    const plan: PlanDay[] = days.map((day) => ({
      date: day.date,
      dinner: day.dinner,
      children: Object.fromEntries(
        day.children.map((meal): [string, ChildMeal] => [meal.childId, meal.kind === "recipe" ? { kind: "recipe", dish: meal.recipe! } : { kind: meal.kind as "empty" | "same-as-dinner" }]),
      ),
    }));
    const ordered: Rule[] = ruleRows
      .filter((rule) => rule.childId === null || kids.some((kid) => kid.id === rule.childId))
      .sort(
        (a, b) =>
          Number(a.childId !== null) - Number(b.childId !== null) ||
          kids.findIndex((kid) => kid.id === a.childId) - kids.findIndex((kid) => kid.id === b.childId) ||
          a.createdAt.getTime() - b.createdAt.getTime() ||
          a.what.localeCompare(b.what),
      )
      .map(({ id, childId, op, n, what }) => ({ id, childId, op: op as RuleOp, n, what }));
    const childNames = Object.fromEntries(kids.map((kid) => [kid.id, kid.name]));
    const statuses = checkRules(ordered, plan);

    return {
      monday,
      days,
      children: kids as Child[],
      rules: statuses.map((status) => ({ ...status, sentence: ruleSentence(status, status.childId ? childNames[status.childId]! : "Adults") })),
      suggestions: suggestSwaps({
        rules: ordered,
        days: plan,
        recipes: summaries.map((summary) => ({ ...summary, forChildren: forChildren.has(summary.id), babyOnly: babyOnly.has(summary.id) })),
        childNames,
        today,
      }),
      childRecipes: summaries.filter((summary) => forChildren.has(summary.id)).sort((a, b) => a.title.localeCompare(b.title)),
    };
  }

  async function setDinner(kitchenId: string, date: string, change: { dinnerRecipeId?: string | null; people?: number }) {
    await db
      .insert(planDays)
      .values({ kitchenId, date, people: change.people ?? defaultPeople, dinnerRecipeId: change.dinnerRecipeId ?? null })
      .onConflictDoUpdate({ target: [planDays.kitchenId, planDays.date], set: change });
  }

  async function setChildDay(childId: string, date: string, kind: ChildDayKind, recipeId: string | null) {
    if (kind === "empty") {
      await db.delete(childDays).where(and(eq(childDays.childId, childId), eq(childDays.date, date)));
      return;
    }
    await db
      .insert(childDays)
      .values({ childId, date, kind, recipeId })
      .onConflictDoUpdate({ target: [childDays.childId, childDays.date], set: { kind, recipeId } });
  }

  routes.get("/api/plan/weeks/:monday", member, async (c) => {
    const monday = c.req.param("monday");
    if (!isDate(monday) || mondayOf(monday) !== monday) return c.json({ error: "A week starts on a Monday (YYYY-MM-DD)." }, 400);
    return c.json(await loadWeek(c.get("member").kitchenId, monday, todayFrom(c.req.query("today"))));
  });

  routes.put("/api/plan/days/:date", member, async (c) => {
    const date = c.req.param("date");
    if (!isDate(date)) return c.json({ error: "Pick a date." }, 400);
    const { kitchenId } = c.get("member");
    const body = await readBody(c.req);
    const change: { dinnerRecipeId?: string | null; people?: number } = {};
    if ("dinnerRecipeId" in body) {
      if (body.dinnerRecipeId === null) change.dinnerRecipeId = null;
      else {
        const id = await ownRecipeId(kitchenId, body.dinnerRecipeId);
        if (!id) return c.json({ error: "No such recipe." }, 404);
        change.dinnerRecipeId = id;
      }
    }
    if ("people" in body) {
      const people = body.people;
      if (!Number.isInteger(people) || (people as number) < 1 || (people as number) > maxPeople) return c.json({ error: `People must be a whole number from 1 to ${maxPeople}.` }, 400);
      change.people = people as number;
    }
    if (!Object.keys(change).length) return c.json({ error: "Send a dinner or a people count." }, 400);
    await setDinner(kitchenId, date, change);
    return c.body(null, 204);
  });

  routes.put("/api/plan/days/:date/children/:childId", member, async (c) => {
    const date = c.req.param("date");
    if (!isDate(date)) return c.json({ error: "Pick a date." }, 400);
    const { kitchenId } = c.get("member");
    const childId = await ownChildId(kitchenId, c.req.param("childId"));
    if (!childId) return c.json({ error: "No such child." }, 404);
    const body = await readBody(c.req);
    const kind = body.kind as ChildDayKind;
    if (!childKinds.includes(kind)) return c.json({ error: "Pick a recipe, same as dinner, or nothing." }, 400);
    let recipeId: string | null = null;
    if (kind === "recipe") {
      recipeId = (await ownRecipeId(kitchenId, body.recipeId)) ?? null;
      if (!recipeId) return c.json({ error: "No such recipe." }, 404);
    }
    await setChildDay(childId, date, kind, recipeId);
    return c.body(null, 204);
  });

  routes.post("/api/plan/suggestions/accept", member, async (c) => {
    const { kitchenId } = c.get("member");
    const body = await readBody(c.req);
    const id = typeof body.id === "string" ? body.id : "";
    const date = id.split(":")[1] ?? "";
    if (!isDate(date)) return c.json({ error: "No such suggestion." }, 404);
    const week = await loadWeek(kitchenId, mondayOf(date), todayFrom(body.today));
    const suggestion = week.suggestions.find((candidate) => candidate.id === id);
    if (!suggestion) return c.json({ error: "That swap no longer fits the week. Have another look." }, 409);
    if (suggestion.childId) await setChildDay(suggestion.childId, suggestion.date, "recipe", suggestion.recipeId);
    else await setDinner(kitchenId, suggestion.date, { dinnerRecipeId: suggestion.recipeId });
    return c.body(null, 204);
  });

  async function parseRule(kitchenId: string, body: Body) {
    const childId = body.childId === null || body.childId === undefined ? null : await ownChildId(kitchenId, body.childId);
    if (childId === undefined) return { error: "No such child." };
    const op = body.op as RuleOp;
    if (!ruleOps.includes(op)) return { error: "Pick at least or at most." };
    const n = body.n;
    if (!Number.isInteger(n) || (n as number) < 0 || (n as number) > 7) return { error: "The number must be from 0 to 7." };
    const what = typeof body.what === "string" ? body.what.trim() : "";
    if (!what || what.length > 40) return { error: "Pick a main type or a tag." };
    return { childId, op, n: n as number, what };
  }

  routes.post("/api/rules", member, async (c) => {
    const { kitchenId } = c.get("member");
    const rule = await parseRule(kitchenId, await readBody(c.req));
    if ("error" in rule) return c.json(rule, 400);
    const [row] = await db
      .insert(rules)
      .values({ kitchenId, ...rule })
      .returning({ id: rules.id });
    return c.json({ id: row!.id }, 201);
  });

  routes.put("/api/rules/:id", member, async (c) => {
    const { kitchenId } = c.get("member");
    const id = c.req.param("id");
    if (!uuidPattern.test(id)) return c.json({ error: "No such rule." }, 404);
    const rule = await parseRule(kitchenId, await readBody(c.req));
    if ("error" in rule) return c.json(rule, 400);
    const [row] = await db
      .update(rules)
      .set(rule)
      .where(and(eq(rules.id, id), eq(rules.kitchenId, kitchenId)))
      .returning({ id: rules.id });
    if (!row) return c.json({ error: "No such rule." }, 404);
    return c.json({ id });
  });

  routes.delete("/api/rules/:id", member, async (c) => {
    const id = c.req.param("id");
    if (!uuidPattern.test(id)) return c.json({ error: "No such rule." }, 404);
    const [row] = await db
      .delete(rules)
      .where(and(eq(rules.id, id), eq(rules.kitchenId, c.get("member").kitchenId)))
      .returning({ id: rules.id });
    if (!row) return c.json({ error: "No such rule." }, 404);
    return c.body(null, 204);
  });

  return routes;
}
