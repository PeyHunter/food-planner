import { expect, test } from "vitest";
import type { RecipeInput } from "../src/shared/recipes.ts";
import type { ShoppingView } from "../src/shared/shopping.ts";
import type { FreezerItem, WeekView } from "../src/shared/week.ts";
import { createTestApp, startingUsers } from "./support/test-app.ts";

// The test clock says 2026-03-01, a Sunday.
const monday = "2026-03-02";
const tuesday = "2026-03-03";
const wednesday = "2026-03-04";
const week = ["2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06", "2026-03-07", "2026-03-08"];

const recipe = (title: string, extra: Partial<RecipeInput> = {}): RecipeInput => ({
  title,
  feeds: 4,
  types: ["Fish"],
  tags: ["freezable"],
  ageFromMonths: null,
  ageToMonths: null,
  lines: [{ amount: 600, unit: "g", ingredient: "Cod", note: "" }],
  steps: [],
  ...extra,
});

async function loggedIn() {
  const app = await createTestApp();
  const { cookie } = await app.logIn(startingUsers[0]!.username, startingUsers[0]!.password);
  const call = (path: string, method = "GET", body?: unknown) =>
    app.request(path, {
      method,
      headers: { cookie: cookie!, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const create = async (input: RecipeInput) => ((await (await call("/api/recipes", "POST", input)).json()) as { id: string }).id;
  const freezer = async () => (await (await call("/api/freezer")).json()) as FreezerItem[];
  const countOf = async (id: string) => (await freezer()).find((item) => item.recipe.id === id)?.count ?? 0;
  const weekView = async () => (await (await call(`/api/plan/weeks/${monday}`)).json()) as WeekView;
  const shopping = async () => (await (await call(`/api/shopping/${monday}?days=${week.join(",")}`)).json()) as ShoppingView;
  return { app, call, create, freezer, countOf, weekView, shopping };
}

test("the freezer needs a login and a whole number", async () => {
  const { app, call, create } = await loggedIn();
  const pie = await create(recipe("Fish pie"));
  expect((await app.request("/api/freezer")).status).toBe(401);
  for (const add of [0, 1.5, "6", 51]) expect((await call(`/api/freezer/${pie}`, "POST", { add })).status).toBe(400);
  expect((await call("/api/freezer/00000000-0000-0000-0000-000000000000", "POST", { add: 1 })).status).toBe(404);
});

test("log portions, then − and + correct them, never below 0", async () => {
  const { call, create, freezer, countOf } = await loggedIn();
  const pie = await create(recipe("Fish pie"));
  expect(await freezer()).toEqual([]);
  expect(await (await call(`/api/freezer/${pie}`, "POST", { add: 6 })).json()).toEqual({ count: 6 });
  expect(await (await call(`/api/freezer/${pie}`, "POST", { add: -1 })).json()).toEqual({ count: 5 });
  expect(await (await call(`/api/freezer/${pie}`, "POST", { add: 1 })).json()).toEqual({ count: 6 });
  const [item] = await freezer();
  expect(item).toMatchObject({ count: 6, recipe: { id: pie, title: "Fish pie", tags: ["freezable"] } });
  expect(await (await call(`/api/freezer/${pie}`, "POST", { add: -50 })).json()).toEqual({ count: 0 });
  // An empty dish drops off the list.
  expect(await freezer()).toEqual([]);
  expect(await countOf(pie)).toBe(0);
});

test("a night from the freezer takes a portion, gives it back when changed, and adds nothing to the list", async () => {
  const { call, create, countOf, weekView, shopping } = await loggedIn();
  const pie = await create(recipe("Fish pie"));
  const pasta = await create(recipe("Pasta", { types: ["Vegetarian"], tags: [], lines: [{ amount: 500, unit: "g", ingredient: "Spaghetti", note: "" }] }));
  await call(`/api/freezer/${pie}`, "POST", { add: 6 });
  await call(`/api/plan/days/${monday}`, "PUT", { dinnerRecipeId: pasta });
  const before = await shopping();

  expect((await call(`/api/plan/days/${tuesday}`, "PUT", { dinnerRecipeId: pie, fromFreezer: true })).status).toBe(204);
  expect(await countOf(pie)).toBe(5);
  expect((await shopping()).sections).toEqual(before.sections);

  const view = await weekView();
  const day = view.days.find((one) => one.date === tuesday)!;
  expect(day).toMatchObject({ fromFreezer: true, dinner: { id: pie } });
  expect(view.freezer).toMatchObject([{ recipe: { id: pie }, count: 5 }]);
  // It still counts for the rules: the default rules ask for fish.
  expect(view.rules.find((rule) => rule.childId === null && rule.what === "Fish")?.count).toBe(1);

  // Choosing it again changes nothing; a people change leaves it alone.
  await call(`/api/plan/days/${tuesday}`, "PUT", { dinnerRecipeId: pie, fromFreezer: true });
  await call(`/api/plan/days/${tuesday}`, "PUT", { people: 3 });
  expect(await countOf(pie)).toBe(5);
  expect((await weekView()).days.find((one) => one.date === tuesday)!.fromFreezer).toBe(true);

  // Cooking it fresh puts the portion back and the list now needs cod.
  await call(`/api/plan/days/${tuesday}`, "PUT", { dinnerRecipeId: pie });
  expect(await countOf(pie)).toBe(6);
  expect(JSON.stringify((await shopping()).sections)).toContain("Cod");

  await call(`/api/plan/days/${wednesday}`, "PUT", { dinnerRecipeId: pie, fromFreezer: true });
  expect(await countOf(pie)).toBe(5);
  await call(`/api/plan/days/${wednesday}`, "PUT", { dinnerRecipeId: null });
  expect(await countOf(pie)).toBe(6);
  await call(`/api/plan/days/${wednesday}`, "PUT", { dinnerRecipeId: pie, fromFreezer: true });
  await call(`/api/plan/days/${wednesday}`, "PUT", { dinnerRecipeId: pasta });
  expect(await countOf(pie)).toBe(6);
});

test("an empty freezer says so and changes nothing", async () => {
  const { call, create, countOf, weekView } = await loggedIn();
  const pie = await create(recipe("Fish pie"));
  const response = await call(`/api/plan/days/${tuesday}`, "PUT", { dinnerRecipeId: pie, fromFreezer: true });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "None of that dish is left in the freezer." });
  expect((await weekView()).days.find((one) => one.date === tuesday)!.dinner).toBeNull();
  expect(await countOf(pie)).toBe(0);
});

test("Create week leaves a freezer night alone", async () => {
  const { call, create, countOf, weekView } = await loggedIn();
  const pie = await create(recipe("Fish pie"));
  await create(recipe("Other dish", { tags: [] }));
  await call(`/api/freezer/${pie}`, "POST", { add: 2 });
  await call(`/api/plan/days/${tuesday}`, "PUT", { dinnerRecipeId: pie, fromFreezer: true });
  const created = await (await call(`/api/plan/weeks/${monday}/create`, "POST", {})).json();
  await call(`/api/plan/weeks/${monday}/undo-create`, "POST", created);
  expect((await weekView()).days.find((one) => one.date === tuesday)).toMatchObject({ fromFreezer: true, dinner: { id: pie } });
  expect(await countOf(pie)).toBe(1);
});
