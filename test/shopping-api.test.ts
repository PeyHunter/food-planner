import { expect, test } from "vitest";
import type { RecipeInput } from "../src/shared/recipes.ts";
import type { ShoppingView } from "../src/shared/shopping.ts";
import type { WeekView } from "../src/shared/week.ts";
import { createTestApp, startingUsers } from "./support/test-app.ts";

// The test clock says 2026-03-01, a Sunday.
const monday = "2026-03-02";
const week = ["2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06", "2026-03-07", "2026-03-08"];

const recipe = (title: string, lines: RecipeInput["lines"], feeds = 4): RecipeInput => ({
  title,
  feeds,
  types: ["Vegetables"],
  tags: [],
  ageFromMonths: null,
  ageToMonths: null,
  lines,
  steps: [],
});
const line = (amount: number | null, unit: RecipeInput["lines"][number]["unit"], ingredient: string) => ({ amount, unit, ingredient, note: "" });

async function loggedIn() {
  const app = await createTestApp();
  const as = async (index: number) => {
    const { cookie } = await app.logIn(startingUsers[index]!.username, startingUsers[index]!.password);
    return (path: string, method = "GET", body?: unknown) =>
      app.request(path, {
        method,
        headers: { cookie: cookie!, ...(body === undefined ? {} : { "content-type": "application/json" }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
  };
  const call = await as(0);
  const create = async (input: RecipeInput) => ((await (await call("/api/recipes", "POST", input)).json()) as { id: string }).id;
  const list = async (query = `?days=${week.join(",")}`, caller = call) => {
    const response = await caller(`/api/shopping/${monday}${query}`);
    expect(response.status).toBe(200);
    return (await response.json()) as ShoppingView;
  };
  return { app, as, call, create, list };
}

const names = (view: ShoppingView) => view.sections.flatMap((section) => section.lines.map((line) => line.ingredient.name));

test("the list needs a login, a Monday and days in that week", async () => {
  const { app, call } = await loggedIn();
  expect((await app.request(`/api/shopping/${monday}`)).status).toBe(401);
  expect((await call("/api/shopping/2026-03-03")).status).toBe(400);
  expect((await call(`/api/shopping/${monday}?days=2026-03-09`)).status).toBe(400);
});

test("builds from the planned days, people, Runi's mash and her own recipe", async () => {
  const { call, create, list } = await loggedIn();
  const soup = await create(recipe("Carrot soup", [line(800, "g", "Carrots"), line(5, "ml", "Salt")]));
  const mash = await create(recipe("Carrot mash", [line(200, "g", "Carrots")], 2));
  const ingredients = (await (await call("/api/ingredients?all=1")).json()) as { id: string; name: string }[];
  const salt = ingredients.find((one) => one.name === "Salt")!;
  await call(`/api/ingredients/${salt.id}`, "PUT", { shopSection: "Dry goods", packAmount: null, packUnit: null, alwaysAtHome: true });

  await call("/api/plan/days/2026-03-02", "PUT", { dinnerRecipeId: soup, people: 3 });
  const view = (await (await call(`/api/plan/weeks/${monday}`)).json()) as WeekView;
  const runi = view.children[0]!.id;
  await call(`/api/plan/days/2026-03-02/children/${runi}`, "PUT", { kind: "same-as-dinner" });
  await call(`/api/plan/days/2026-03-03/children/${runi}`, "PUT", { kind: "recipe", recipeId: mash });

  const shopping = await list();
  // Soup: 800 g for 4, eaten by 3.5 = 700 g. Mash: 200 g for 2, one serving for Runi = 100 g.
  expect(shopping.sections).toHaveLength(1);
  expect(shopping.sections[0]!.lines[0]).toMatchObject({ amount: 800, unit: "g", ticked: false, meals: ["Mon: Carrot soup", "Tue: Carrot mash for Runi Lee"] });
  expect(names(shopping)).not.toContain("Salt");

  const tuesdayOnly = await list("?days=2026-03-03");
  expect(tuesdayOnly.sections[0]!.lines[0]!.amount).toBe(100);
  expect((await list("?days=")).sections).toEqual([]);
});

test("without days it lists the rest of the week from today", async () => {
  const { list } = await loggedIn();
  expect((await list("?today=2026-03-05")).days).toEqual(["2026-03-05", "2026-03-06", "2026-03-07", "2026-03-08"]);
  // Another week than today's lists all of it.
  expect((await list("?today=2026-02-20")).days).toEqual(week);
});

test("ticks are shared, set rather than flipped, and Clear ticked hides them", async () => {
  const { as, call, create, list } = await loggedIn();
  const ronja = await as(1);
  const soup = await create(recipe("Soup", [line(400, "g", "Carrots"), line(2, "pcs", "Onion")]));
  await call("/api/plan/days/2026-03-02", "PUT", { dinnerRecipeId: soup });
  const key = (await list()).sections[0]!.lines[0]!.key;

  for (let tap = 0; tap < 2; tap++) expect((await call(`/api/shopping/${monday}/ticks`, "PUT", { key, ticked: true })).status).toBe(204);
  expect((await list(undefined, ronja)).sections[0]!.lines.find((one) => one.key === key)!.ticked).toBe(true);
  await ronja(`/api/shopping/${monday}/ticks`, "PUT", { key, ticked: false });
  expect((await list()).sections[0]!.lines.find((one) => one.key === key)!.ticked).toBe(false);
  expect((await call(`/api/shopping/${monday}/ticks`, "PUT", { key })).status).toBe(400);

  expect((await call(`/api/shopping/${monday}/extras`, "POST", { name: "  Milk " })).status).toBe(201);
  await call(`/api/shopping/${monday}/extras`, "POST", { name: "Bread" });
  expect((await call(`/api/shopping/${monday}/extras`, "POST", { name: " " })).status).toBe(400);
  const extras = (await list(undefined, ronja)).extras;
  expect(extras.map((extra) => extra.name)).toEqual(["Milk", "Bread"]);

  await call(`/api/shopping/${monday}/ticks`, "PUT", { key, ticked: true });
  await call(`/api/shopping/${monday}/ticks`, "PUT", { key: extras[0]!.key, ticked: true });
  expect((await call(`/api/shopping/${monday}/clear`, "POST")).status).toBe(204);
  const cleared = await list();
  expect(names(cleared)).toEqual(["Onion"]);
  expect(cleared.extras.map((extra) => extra.name)).toEqual(["Bread"]);
  expect(cleared.cleared).toBe(1);

  await call(`/api/shopping/${monday}/bring-back`, "POST");
  const back = await list();
  expect(names(back)).toEqual(["Carrots", "Onion"]);
  expect(back.sections[0]!.lines.every((one) => !one.ticked)).toBe(true);

  expect((await call(`/api/shopping/${monday}/extras/${extras[1]!.id}`, "DELETE")).status).toBe(204);
  expect((await call(`/api/shopping/${monday}/extras/${extras[1]!.id}`, "DELETE")).status).toBe(404);
  expect((await list()).extras).toEqual([]);
  // Another week has its own list.
  expect((await call("/api/shopping/2026-03-09?days=")).status).toBe(200);
});

test("a pack size set on the ingredient rounds the list up to packs", async () => {
  const { call, create, list } = await loggedIn();
  const soup = await create(recipe("Soup", [line(800, "g", "Carrots")]));
  await call("/api/plan/days/2026-03-02", "PUT", { dinnerRecipeId: soup });
  const before = (await list()).sections[0]!.lines[0]!;
  expect(before).toMatchObject({ amount: 400, needsPackSize: true, packs: null });
  await call(`/api/ingredients/${before.ingredient.id}`, "PUT", { shopSection: "Vegetables", packAmount: 1, packUnit: "kg", alwaysAtHome: false });
  expect((await list()).sections[0]!.lines[0]).toMatchObject({ packs: 1, leftover: "600 g carrots left", needsPackSize: false });
});

test("perf: the list for 7 planned days builds in 200 ms or less", async () => {
  const { call, create, list } = await loggedIn();
  for (const [index, date] of week.entries()) {
    const lines = Array.from({ length: 15 }, (_, n) => line(100 + n * 10, n % 3 === 0 ? "pcs" : "g", `Thing ${(index * 7 + n) % 40}`));
    const id = await create(recipe(`Dinner ${index}`, lines));
    await call(`/api/plan/days/${date}`, "PUT", { dinnerRecipeId: id, people: 2 + (index % 3) });
  }
  await list(); // warm up
  const runs: number[] = [];
  for (let run = 0; run < 5; run++) {
    const started = performance.now();
    const view = await list();
    runs.push(performance.now() - started);
    expect(names(view).length).toBeGreaterThan(20);
  }
  runs.sort((a, b) => a - b);
  expect(runs[2]).toBeLessThanOrEqual(200);
});

test("Bought it all clears every item at once, and Bring back shows them again", async () => {
  const { call, create, list } = await loggedIn();
  const soup = await create(recipe("Soup", [line(400, "g", "Carrots"), line(2, "pcs", "Onion")]));
  await call("/api/plan/days/2026-03-02", "PUT", { dinnerRecipeId: soup });
  await call(`/api/shopping/${monday}/extras`, "POST", { name: "Milk" });
  const before = await list();
  const keys = [...before.sections.flatMap((section) => section.lines.map((one) => one.key)), ...before.extras.map((extra) => extra.key)];
  expect((await call(`/api/shopping/${monday}/bought`, "POST", { keys })).status).toBe(204);
  const after = await list();
  expect([after.sections, after.extras, after.cleared]).toEqual([[], [], 2]);
  expect((await call(`/api/shopping/${monday}/bought`, "POST", { keys: [42] })).status).toBe(400);
  await call(`/api/shopping/${monday}/bring-back`, "POST");
  expect(names(await list())).toEqual(["Carrots", "Onion"]);
});

test("one thing under a Danish and an English name is one line: løg on Wednesday, onions on Thursday", async () => {
  const { call, create, list } = await loggedIn();
  const danish = await create(recipe("Frikadeller", [line(1, "pcs", "Løg"), line(500, "g", "Hakket svinekød")]));
  const english = await create(recipe("Chili", [line(2, "pcs", "Onions"), line(400, "g", "Chopped tomatoes")]));
  await call("/api/plan/days/2026-03-04", "PUT", { dinnerRecipeId: danish, people: 4 });
  await call("/api/plan/days/2026-03-05", "PUT", { dinnerRecipeId: english, people: 4 });

  const shopping = await list();
  const onions = shopping.sections.flatMap((section) => section.lines).filter((one) => /løg|onion/i.test(one.ingredient.name));
  expect(onions).toHaveLength(1);
  expect(onions[0]!.meals).toEqual(["Wed: Frikadeller", "Thu: Chili"]);
  // The key is the first name's, so a tick stays put when only Thursday is picked.
  const thursdayOnly = await list("?days=2026-03-05");
  expect(thursdayOnly.sections.flatMap((section) => section.lines).find((one) => /løg|onion/i.test(one.ingredient.name))!.key).toBe(onions[0]!.key);
});

test("red onion and onion stay two lines", async () => {
  const { call, create, list } = await loggedIn();
  const salad = await create(recipe("Salad", [line(1, "pcs", "Red onion"), line(1, "pcs", "Onion")]));
  await call("/api/plan/days/2026-03-04", "PUT", { dinnerRecipeId: salad, people: 4 });
  expect(names(await list()).filter((name) => /onion/i.test(name)).sort()).toEqual(["Onion", "Red onion"]);
});
