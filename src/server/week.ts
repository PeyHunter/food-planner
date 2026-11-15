import { and, asc, between, eq, inArray, isNull, TransactionRollbackError } from "drizzle-orm";
import { Hono } from "hono";
import { monthsOld } from "../shared/child-age.ts";
import { createWeek, type CreateWeekInput } from "../shared/create-week.ts";
import { reduceWaste, type ReduceWaste } from "../shared/reduce-waste.ts";
import type { ShopSection } from "../shared/recipes.ts";
import { isBabyOnly, suggestSwaps } from "../shared/rule-swaps.ts";
import { checkRules, ruleOps, ruleSentence, type ChildMeal, type PlanDay, type Rule, type RuleOp } from "../shared/rules.ts";
import { childRecipeTag, defaultPeople, isDate, maxPeople, mondayOf, sameAsDinnerPortion, weekDates, type Child, type ChildDayKind, type CreatedWeek, type WeekView } from "../shared/week.ts";
import type { Unit } from "../shared/units.ts";
import type { AppDependencies } from "./app.ts";
import { addPortions, freezerCounts, takePortion, type Queries } from "./freezer.ts";
import { kitchenMember, recipeSummaries, type MemberEnv } from "./recipes.ts";
import { kidFoodWarnings } from "../shared/kid-food.ts";
import { kitchenLines } from "./kid-food-lines.ts";
import { childDays, children, ingredients, planDays, recipeLines, recipes, rules } from "./schema.ts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const childKinds: ChildDayKind[] = ["empty", "same-as-dinner", "recipe"];

type Body = Record<string, unknown>;
type DinnerChange = { dinnerRecipeId?: string | null; people?: number; fromFreezer?: boolean };
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

  /** The week's plan and everything the rules and the planner need, before it becomes a WeekView. */
  async function loadPlan(kitchenId: string, monday: string) {
    const dates = weekDates(monday);
    const sunday = dates[6]!;
    const [kids, recipeRows, dayRows, ruleRows, freezerRows, lines] = await Promise.all([
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
      freezerCounts(db, kitchenId),
      kitchenLines(database, kitchenId),
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
      return {
        date,
        people: row?.people ?? defaultPeople,
        dinner,
        fromFreezer: dinner !== null && row!.fromFreezer,
        extraPortions: meals.filter((meal) => meal.kind === "same-as-dinner").length * sameAsDinnerPortion, children: meals };
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
    const freezer = freezerRows
      .flatMap((row) => {
        const recipe = byId.get(row.recipeId);
        return recipe ? [{ recipe, count: row.count }] : [];
      })
      .sort((a, b) => a.recipe.title.localeCompare(b.recipe.title));
    // Ages on the week's Monday: close enough for "not before 1 year".
    const kidWarnings: WeekView["kidWarnings"] = {};
    for (const kid of kids) {
      const age = kid.birthday ? monthsOld(kid.birthday, monday) : null;
      const found = Object.fromEntries(
        summaries.flatMap((summary) => {
          const warnings = kidFoodWarnings(lines.get(summary.id) ?? [], age);
          return warnings.length ? [[summary.id, warnings]] : [];
        }),
      );
      if (Object.keys(found).length) kidWarnings[kid.id] = found;
    }
    return { kids, recipeRows, summaries, forChildren, babyOnly, days, plan, ordered, childNames, freezer, kidWarnings };
  }

  async function loadWeek(kitchenId: string, monday: string, today: string): Promise<WeekView> {
    const { kids, summaries, forChildren, babyOnly, days, plan, ordered, childNames, freezer, kidWarnings } = await loadPlan(kitchenId, monday);
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
      freezer,
      kidWarnings,
    };
  }

  /**
   * A dinner from the freezer takes a portion out; changing or clearing it puts the portion back.
   * Returns false, changing nothing, when the freezer has none of that dish left.
   */
  async function setDinner(kitchenId: string, date: string, change: DinnerChange, by: string | null) {
    if (!("dinnerRecipeId" in change)) {
      await upsertDay(db, kitchenId, date, change);
      return true;
    }
    const fromFreezer = change.dinnerRecipeId !== null && change.dinnerRecipeId !== undefined && change.fromFreezer === true;
    return db.transaction(async (tx) => {
      const [old] = await tx
        .select({ dinnerRecipeId: planDays.dinnerRecipeId, fromFreezer: planDays.fromFreezer })
        .from(planDays)
        .where(and(eq(planDays.kitchenId, kitchenId), eq(planDays.date, date)))
        .for("update");
      const unchanged = old?.fromFreezer && fromFreezer && old.dinnerRecipeId === change.dinnerRecipeId;
      if (!unchanged) {
        if (old?.fromFreezer && old.dinnerRecipeId) await addPortions(tx, kitchenId, old.dinnerRecipeId, 1, by);
        if (fromFreezer && !(await takePortion(tx, kitchenId, change.dinnerRecipeId!, by))) {
          tx.rollback();
        }
      }
      await upsertDay(tx, kitchenId, date, { ...change, fromFreezer });
      return true;
    }).catch((error: unknown) => {
      if (error instanceof TransactionRollbackError) return false;
      throw error;
    });
  }

  async function upsertDay(queries: Queries, kitchenId: string, date: string, change: DinnerChange) {
    await queries
      .insert(planDays)
      .values({ kitchenId, date, people: change.people ?? defaultPeople, dinnerRecipeId: change.dinnerRecipeId ?? null, fromFreezer: change.fromFreezer ?? false })
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
    const change: DinnerChange = {};
    if ("dinnerRecipeId" in body) {
      if (body.dinnerRecipeId === null) change.dinnerRecipeId = null;
      else {
        const id = await ownRecipeId(kitchenId, body.dinnerRecipeId);
        if (!id) return c.json({ error: "No such recipe." }, 404);
        change.dinnerRecipeId = id;
        change.fromFreezer = body.fromFreezer === true;
      }
    }
    if ("people" in body) {
      const people = body.people;
      if (!Number.isInteger(people) || (people as number) < 1 || (people as number) > maxPeople) return c.json({ error: `People must be a whole number from 1 to ${maxPeople}.` }, 400);
      change.people = people as number;
    }
    if (!Object.keys(change).length) return c.json({ error: "Send a dinner or a people count." }, 400);
    if (!(await setDinner(kitchenId, date, change, c.get("member").userId))) return c.json({ error: "None of that dish is left in the freezer." }, 409);
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
    if (!suggestion || suggestion.kind === "note") return c.json({ error: "That swap no longer fits the week. Have another look." }, 409);
    if (suggestion.kind === "same-as-dinner") await setChildDay(suggestion.childId!, suggestion.date, "same-as-dinner", null);
    else if (suggestion.childId) await setChildDay(suggestion.childId, suggestion.date, "recipe", suggestion.recipeId);
    else await setDinner(kitchenId, suggestion.date, { dinnerRecipeId: suggestion.recipeId }, c.get("member").userId);
    return c.body(null, 204);
  });

  const mondayError = { error: "A week starts on a Monday (YYYY-MM-DD)." };

  /** Everything Create week and Reduce waste need: the plan, the rules, and each recipe with its lines. */
  async function plannerInput(kitchenId: string, monday: string, today: string): Promise<CreateWeekInput> {
    const lineQuery = db
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
          alwaysAtHome: ingredients.alwaysAtHome,
        },
      })
      .from(recipeLines)
      .innerJoin(ingredients, eq(ingredients.id, recipeLines.ingredientId))
      .innerJoin(recipes, eq(recipes.id, recipeLines.recipeId))
      .where(eq(recipes.kitchenId, kitchenId))
      .orderBy(asc(recipeLines.recipeId), asc(recipeLines.position));
    const [{ kids, recipeRows, summaries, days, plan, ordered }, lineRows] = await Promise.all([loadPlan(kitchenId, monday), lineQuery]);
    const ranges = new Map(recipeRows.map((row) => [row.id, row]));
    const linesOf = Map.groupBy(lineRows, (line) => line.recipeId);
    return {
      rules: ordered,
      days: plan.map((day, index) => ({ ...day, people: days[index]!.people })),
      recipes: summaries.map((summary) => ({
        ...summary,
        ageFromMonths: ranges.get(summary.id)!.ageFrom,
        ageToMonths: ranges.get(summary.id)!.ageTo,
        lines: (linesOf.get(summary.id) ?? []).map(({ amount, unit, ingredient }) => ({
          amount,
          unit: unit as Unit | null,
          ingredient: { ...ingredient, shopSection: ingredient.shopSection as ShopSection, packUnit: ingredient.packUnit as Unit | null },
        })),
      })),
      children: kids.map((kid) => ({ id: kid.id, name: kid.name, ageMonths: kid.birthday ? monthsOld(kid.birthday, today) : null })),
      today,
    };
  }

  // Fills the week's empty days and says which, so the phone can undo just those.
  routes.post("/api/plan/weeks/:monday/create", member, async (c) => {
    const monday = c.req.param("monday");
    if (!isDate(monday) || mondayOf(monday) !== monday) return c.json(mondayError, 400);
    const { kitchenId } = c.get("member");
    const today = todayFrom((await readBody(c.req)).today);
    const result = createWeek(await plannerInput(kitchenId, monday, today));
    await db.transaction(async (tx) => {
      for (const fill of result.fills) {
        // Only an empty day is filled, even if someone planned it a moment ago.
        if (fill.childId) {
          const row = fill.sameAsDinner ? { kind: "same-as-dinner", recipeId: null } : { kind: "recipe", recipeId: fill.recipeId };
          await tx
            .insert(childDays)
            .values({ childId: fill.childId, date: fill.date, ...row })
            .onConflictDoNothing();
        } else {
          await tx
            .insert(planDays)
            .values({ kitchenId, date: fill.date, people: defaultPeople, dinnerRecipeId: fill.recipeId })
            .onConflictDoUpdate({ target: [planDays.kitchenId, planDays.date], set: { dinnerRecipeId: fill.recipeId }, setWhere: isNull(planDays.dinnerRecipeId) });
        }
      }
    });
    const created: CreatedWeek = { fills: result.fills, note: result.note };
    return c.json(created);
  });

  // One gentle swap that uses up a leftover. Accepting it is a plain dinner change, and so is undoing it.
  routes.post("/api/plan/weeks/:monday/reduce-waste", member, async (c) => {
    const monday = c.req.param("monday");
    if (!isDate(monday) || mondayOf(monday) !== monday) return c.json(mondayError, 400);
    const today = todayFrom((await readBody(c.req)).today);
    const result: ReduceWaste = reduceWaste(await plannerInput(c.get("member").kitchenId, monday, today));
    return c.json(result);
  });

  // Takes back what Create week put in, leaving any day changed since then as it is.
  routes.post("/api/plan/weeks/:monday/undo-create", member, async (c) => {
    const monday = c.req.param("monday");
    if (!isDate(monday) || mondayOf(monday) !== monday) return c.json(mondayError, 400);
    const { kitchenId } = c.get("member");
    const body = await readBody(c.req);
    const dates = weekDates(monday);
    const fills: unknown[] = Array.isArray(body.fills) ? body.fills : [];
    const valid = fills.every((fill) => {
      const { date, childId, recipeId } = (fill ?? {}) as Body;
      return (
        typeof date === "string" && dates.includes(date) && typeof recipeId === "string" && uuidPattern.test(recipeId) && (childId === null || typeof childId === "string")
      );
    });
    if (!valid || fills.length > 7 * 8) return c.json({ error: "That is not what Create week did." }, 400);
    for (const fill of fills as CreatedWeek["fills"]) {
      if (fill.childId === null) {
        await db
          .update(planDays)
          .set({ dinnerRecipeId: null })
          .where(and(eq(planDays.kitchenId, kitchenId), eq(planDays.date, fill.date), eq(planDays.dinnerRecipeId, fill.recipeId), eq(planDays.fromFreezer, false)));
        continue;
      }
      const childId = await ownChildId(kitchenId, fill.childId);
      if (!childId) continue;
      const what = fill.sameAsDinner ? eq(childDays.kind, "same-as-dinner") : and(eq(childDays.kind, "recipe"), eq(childDays.recipeId, fill.recipeId));
      await db.delete(childDays).where(and(eq(childDays.childId, childId), eq(childDays.date, fill.date), what));
    }
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
