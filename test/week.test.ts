import { expect, test } from "vitest";
import type { RecipeInput } from "../src/shared/recipes.ts";
import type { ReduceWaste } from "../src/shared/reduce-waste.ts";
import type { CreatedWeek, WeekView } from "../src/shared/week.ts";
import { createTestApp, startingUsers } from "./support/test-app.ts";

// The test clock says 2026-03-01 (a Sunday), so this whole week is still ahead.
const monday = "2026-03-02";
const wednesday = "2026-03-04";

const recipe = (title: string, types: RecipeInput["types"], extra: Partial<RecipeInput> = {}): RecipeInput => ({
  title,
  feeds: 4,
  types,
  tags: [],
  ageFromMonths: null,
  ageToMonths: null,
  lines: [],
  steps: [],
  ...extra,
});

async function loggedIn() {
  const app = await createTestApp();
  const { cookie } = await app.logIn("peyton", startingUsers[0]!.password);
  const call = (path: string, method = "GET", body?: unknown) =>
    app.request(path, {
      method,
      headers: { cookie: cookie!, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const create = async (input: RecipeInput) => ((await (await call("/api/recipes", "POST", input)).json()) as { id: string }).id;
  const week = async (date = monday) => {
    const response = await call(`/api/plan/weeks/${date}`);
    expect(response.status).toBe(200);
    return (await response.json()) as WeekView;
  };
  return { app, call, create, week };
}

test("the week needs a login and a Monday", async () => {
  const { app, call } = await loggedIn();
  expect((await app.request(`/api/plan/weeks/${monday}`)).status).toBe(401);
  expect((await call("/api/plan/weeks/2026-03-03")).status).toBe(400);
  expect((await call("/api/plan/weeks/nope")).status).toBe(400);
});

test("a new kitchen has Runi Lee, the default rules and an empty week", async () => {
  const { week } = await loggedIn();
  const view = await week();
  expect(view.children.map((child) => child.name)).toEqual(["Runi Lee"]);
  expect(view.days.map((day) => day.date)).toEqual(["2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06", "2026-03-07", "2026-03-08"]);
  expect(view.days.every((day) => day.people === 2 && day.dinner === null && day.children[0]!.kind === "empty")).toBe(true);
  expect(view.rules.map((rule) => [rule.sentence, rule.count, rule.met])).toEqual([
    ["Adults: Fish at least 1 a week", 0, false],
    ["Adults: Freezable at least 1 a week", 0, false],
    ["Runi Lee: Fish at least 2 a week", 0, false],
    ["Runi Lee: Meat at most 1 a week", 0, true],
    ["Runi Lee: Vegetables at least 5 a week", 0, false],
  ]);
});

test("plan a fish dinner and set Wednesday to 5: the fish rule ticks", async () => {
  const { call, create, week } = await loggedIn();
  const salmon = await create(recipe("Salmon", ["Fish"], { tags: ["freezable"] }));

  expect((await call(`/api/plan/days/${wednesday}`, "PUT", { dinnerRecipeId: salmon })).status).toBe(204);
  expect((await call(`/api/plan/days/${wednesday}`, "PUT", { people: 5 })).status).toBe(204);

  const view = await week();
  const day = view.days[2]!;
  expect(day).toMatchObject({ date: wednesday, people: 5, dinner: { id: salmon, title: "Salmon", types: ["Fish"] } });
  expect(view.rules.slice(0, 2).map((rule) => [rule.count, rule.met])).toEqual([
    [1, true],
    [1, true],
  ]);

  expect((await call(`/api/plan/days/${wednesday}`, "PUT", { dinnerRecipeId: null })).status).toBe(204);
  expect((await week()).days[2]).toMatchObject({ people: 5, dinner: null });
});

test("bad day changes are refused", async () => {
  const { call } = await loggedIn();
  expect((await call(`/api/plan/days/${wednesday}`, "PUT", { people: 0 })).status).toBe(400);
  expect((await call(`/api/plan/days/${wednesday}`, "PUT", {})).status).toBe(400);
  expect((await call(`/api/plan/days/${wednesday}`, "PUT", { dinnerRecipeId: "00000000-0000-0000-0000-000000000000" })).status).toBe(404);
  expect((await call("/api/plan/days/2026-02-30", "PUT", { people: 3 })).status).toBe(400);
});

test("Runi Lee's same as dinner counts the dinner for her and adds half a portion", async () => {
  const { call, create, week } = await loggedIn();
  const salmon = await create(recipe("Salmon", ["Fish"]));
  const mash = await create(recipe("Cod mash", ["Fish"], { tags: ["for Runi"] }));
  const runi = (await week()).children[0]!.id;

  await call(`/api/plan/days/${monday}`, "PUT", { dinnerRecipeId: salmon });
  expect((await call(`/api/plan/days/${monday}/children/${runi}`, "PUT", { kind: "same-as-dinner" })).status).toBe(204);
  expect((await call(`/api/plan/days/${wednesday}/children/${runi}`, "PUT", { kind: "recipe", recipeId: mash })).status).toBe(204);

  const view = await week();
  expect(view.days[0]).toMatchObject({ extraPortions: 0.5, children: [{ kind: "same-as-dinner", recipe: null }] });
  expect(view.days[2]!.children[0]).toMatchObject({ kind: "recipe", recipe: { title: "Cod mash" } });
  expect(view.rules.find((rule) => rule.sentence.startsWith("Runi Lee: Fish"))).toMatchObject({ count: 2, met: true });
  expect(view.childRecipes.map((r) => r.title)).toEqual(["Cod mash"]);

  expect((await call(`/api/plan/days/${wednesday}/children/${runi}`, "PUT", { kind: "empty" })).status).toBe(204);
  expect((await week()).days[2]!.children[0]!.kind).toBe("empty");
  expect((await call(`/api/plan/days/${monday}/children/${runi}`, "PUT", { kind: "recipe" })).status).toBe(404);
  expect((await call(`/api/plan/days/${monday}/children/${runi}`, "PUT", { kind: "soup" })).status).toBe(400);
});

test("a missed rule comes with a swap that one call accepts", async () => {
  const { call, create, week } = await loggedIn();
  await create(recipe("Salmon", ["Fish"]));
  await create(recipe("Fish fingers", ["Fish"], { ageFromMonths: 10, ageToMonths: 36 }));

  const before = await week();
  const adults = before.suggestions.find((s) => s.childId === null)!;
  expect(adults.text).toBe("Add Salmon on Monday to get fish 1/1");
  const runi = before.suggestions.find((s) => s.childId !== null)!;
  expect(runi.text).toBe("Add Fish fingers on Runi Lee's Monday to get fish 1/2");

  expect((await call("/api/plan/suggestions/accept", "POST", { id: adults.id })).status).toBe(204);
  const after = await week();
  expect(after.days[0]!.dinner?.title).toBe("Salmon");
  expect(after.rules[0]).toMatchObject({ count: 1, met: true });
  expect((await call("/api/plan/suggestions/accept", "POST", { id: adults.id })).status).toBe(409);
});

test("Create week fills only the empty days, and undo takes back just those", async () => {
  const { call, create, week } = await loggedIn();
  const pie = await create(recipe("Planned pie", ["Meat"]));
  const salmon = await create(recipe("Salmon", ["Fish"], { tags: ["freezable"] }));
  await create(recipe("Dal", ["Vegetarian"]));
  await create(recipe("Cod mash", ["Fish", "Vegetables"], { tags: ["for Runi"] }));
  await create(recipe("Pea mash", ["Fish", "Vegetables"], { ageFromMonths: 6, ageToMonths: null }));
  await call(`/api/plan/days/${wednesday}`, "PUT", { dinnerRecipeId: pie, people: 4 });

  const response = await call(`/api/plan/weeks/${monday}/create`, "POST", {});
  expect(response.status).toBe(200);
  const created = (await response.json()) as CreatedWeek;
  // Runi Lee has no birthday yet, so only the "for Runi" recipe fits her.
  // Monday's salmon also goes to Runi Lee mashed, since she needs fish.
  expect(created.note).toBe(
    "Filled 2 dinners and 2 meals for Runi Lee. 5 days still empty: add more recipes to fill them. Fish 1/1 ✓ · Freezable 1/1 ✓ · Fish 2/2 for Runi Lee ✓ · Vegetables 1/5 for Runi Lee not met yet",
  );
  expect(created.fills[0]).toEqual({ date: monday, childId: null, recipeId: salmon });

  const filled = await week();
  expect(filled.days[2]).toMatchObject({ people: 4, dinner: { id: pie } });
  expect(filled.days.filter((day) => day.dinner).map((day) => day.dinner!.title)).toEqual(["Salmon", "Dal", "Planned pie"]);
  expect(filled.days[0]!.children[0]).toMatchObject({ kind: "same-as-dinner" });
  expect(filled.days[1]!.children[0]).toMatchObject({ kind: "recipe", recipe: { title: "Cod mash" } });

  // Someone changes Tuesday before pressing undo: that day stays.
  await call(`/api/plan/days/2026-03-03`, "PUT", { dinnerRecipeId: pie });
  expect((await call(`/api/plan/weeks/${monday}/undo-create`, "POST", { fills: created.fills })).status).toBe(204);
  const undone = await week();
  expect(undone.days.map((day) => day.dinner?.title ?? null)).toEqual([null, "Planned pie", "Planned pie", null, null, null, null]);
  expect(undone.days.map((day) => day.children[0]!.kind)).toEqual(Array(7).fill("empty"));

  expect((await call(`/api/plan/weeks/${monday}/undo-create`, "POST", { fills: [{ date: "2026-04-01", childId: null, recipeId: pie }] })).status).toBe(400);
  expect((await call(`/api/plan/weeks/2026-03-03/create`, "POST", {})).status).toBe(400);
});

test("rules can be added, changed and removed", async () => {
  const { call, week } = await loggedIn();
  const runi = (await week()).children[0]!.id;

  const added = await call("/api/rules", "POST", { childId: runi, op: "at-most", n: 2, what: "Chicken" });
  expect(added.status).toBe(201);
  const { id } = (await added.json()) as { id: string };
  expect((await week()).rules.map((rule) => rule.sentence)).toContain("Runi Lee: Chicken at most 2 a week");

  expect((await call(`/api/rules/${id}`, "PUT", { childId: null, op: "at-least", n: 3, what: "Vegetarian" })).status).toBe(200);
  expect((await week()).rules.map((rule) => rule.sentence)).toContain("Adults: Vegetarian at least 3 a week");

  expect((await call("/api/rules", "POST", { childId: null, op: "about", n: 1, what: "Fish" })).status).toBe(400);
  expect((await call("/api/rules", "POST", { childId: null, op: "at-least", n: 9, what: "Fish" })).status).toBe(400);
  expect((await call(`/api/rules/${id}`, "DELETE")).status).toBe(204);
  expect((await week()).rules).toHaveLength(5);
});

test("the week answers fast", async () => {
  const { call, create, week } = await loggedIn();
  const ids: string[] = [];
  for (let index = 0; index < 30; index++) ids.push(await create(recipe(`Dish ${index}`, index % 2 ? ["Fish"] : ["Meat"], { tags: index % 3 ? [] : ["for Runi"] })));
  const runi = (await week()).children[0]!.id;
  for (let day = 0; day < 7; day++) {
    const date = `2026-03-0${day + 2}`;
    await call(`/api/plan/days/${date}`, "PUT", { dinnerRecipeId: ids[day] });
    await call(`/api/plan/days/${date}/children/${runi}`, "PUT", day % 2 ? { kind: "same-as-dinner" } : { kind: "recipe", recipeId: ids[day * 3] });
  }
  await week();
  const times: number[] = [];
  for (let run = 0; run < 15; run++) {
    const start = performance.now();
    await week();
    times.push(performance.now() - start);
  }
  const median = times.sort((a, b) => a - b)[7]!;
  console.log(`GET week: median ${median.toFixed(1)} ms over 15 calls`);
  // The aim is under 50 ms (about 25 ms on a laptop); the bound leaves room for slow CI machines.
  expect(median).toBeLessThan(100);
});

test("Reduce waste suggests one dish that uses the leftover carrots, within 200 ms with 200 recipes", async () => {
  const { call, create } = await loggedIn();
  const carrots = (amount: number) => ({ feeds: 2, lines: [{ amount, unit: "g" as const, ingredient: "Carrots", note: "" }] });
  const cake = await create(recipe("Carrot cake", ["Vegetarian"], carrots(400)));
  const soup = await create(recipe("Carrot soup", ["Vegetarian"], carrots(300)));
  const [carrot] = (await (await call("/api/ingredients?q=Carrots")).json()) as { id: string }[];
  await call(`/api/ingredients/${carrot!.id}`, "PUT", { shopSection: "Vegetables", packAmount: 1, packUnit: "kg", alwaysAtHome: false });
  await call(`/api/plan/days/${monday}`, "PUT", { dinnerRecipeId: cake, people: 2 });

  const suggest = async () => {
    const response = await call(`/api/plan/weeks/${monday}/reduce-waste`, "POST", { today: monday });
    expect(response.status).toBe(200);
    return (await response.json()) as ReduceWaste;
  };
  expect((await suggest()).swap).toEqual({ date: "2026-03-03", recipeId: soup, replaces: null, text: "Add Carrot soup on Tuesday to use the 600 g carrots left from Monday." });
  expect((await call("/api/plan/weeks/2026-03-03/reduce-waste", "POST", {})).status).toBe(400);

  // Many more recipes, each with eight lines from one small pantry, so most of them use a leftover.
  const pantry = Array.from({ length: 30 }, (_, index) => `Thing ${index}`);
  for (let index = 0; index < 198; index++) {
    await create(
      recipe(`Dish ${index}`, [(["Fish", "Meat", "Vegetarian"] as const)[index % 3]!], {
        lines: Array.from({ length: 8 }, (_, line) => ({ amount: 70 + line * 30, unit: "g" as const, ingredient: pantry[(index * 3 + line) % 30]!, note: "" })),
      }),
    );
  }
  for (const name of pantry) {
    const [thing] = (await (await call(`/api/ingredients?q=${encodeURIComponent(name)}`)).json()) as { id: string }[];
    await call(`/api/ingredients/${thing!.id}`, "PUT", { shopSection: "Other", packAmount: 500, packUnit: "g", alwaysAtHome: false });
  }
  await suggest();
  const times: number[] = [];
  for (let run = 0; run < 7; run++) {
    const start = performance.now();
    expect((await suggest()).swap).not.toBeNull();
    times.push(performance.now() - start);
  }
  const median = times.sort((a, b) => a - b)[3]!;
  console.log(`POST reduce-waste: median ${median.toFixed(1)} ms over 7 calls`);
  expect(median).toBeLessThanOrEqual(200);
});

test("a dinner out or takeout needs no recipe, is skipped by Create week, and buys nothing", async () => {
  const { call, create, week } = await loggedIn();
  await create(recipe("Fish soup", ["Fish"], { tags: ["freezable"] }));
  expect((await call(`/api/plan/days/${wednesday}`, "PUT", { away: { kind: "out", note: "At Isabel's" } })).status).toBe(204);
  expect((await call(`/api/plan/days/${monday}`, "PUT", { away: { kind: "nope" } })).status).toBe(400);
  let view = await week();
  expect(view.days[2]).toMatchObject({ dinner: null, away: { kind: "out", note: "At Isabel's" } });

  const created = (await (await call(`/api/plan/weeks/${monday}/create`, "POST", {})).json()) as CreatedWeek;
  expect(created.fills.some((fill) => fill.childId === null && fill.date === wednesday)).toBe(false);
  view = await week();
  expect(view.days[2]!.away?.kind).toBe("out");

  const shopping = (await (await call(`/api/shopping/${monday}?days=${wednesday}`)).json()) as { sections: unknown[] };
  expect(shopping.sections).toEqual([]);

  // Picking a recipe clears the away note.
  const soup = view.days.find((day) => day.dinner)!.dinner!.id;
  await call(`/api/plan/days/${wednesday}`, "PUT", { dinnerRecipeId: soup });
  expect((await week()).days[2]).toMatchObject({ away: null, dinner: { id: soup } });
});

test("a dinner can have extra dishes that go on the shopping list for the same people", async () => {
  const { call, create, week } = await loggedIn();
  const salmon = await create(recipe("Salmon", ["Fish"]));
  const salad = await create(recipe("Green salad", ["Vegetables"], { feeds: 2, lines: [{ amount: 1, unit: "bag", ingredient: "Spinach", note: "" }] }));
  await call(`/api/plan/days/${wednesday}`, "PUT", { dinnerRecipeId: salmon, people: 4 });
  expect((await call(`/api/plan/days/${wednesday}/sides`, "POST", { recipeId: salad })).status).toBe(204);
  let view = await week();
  expect(view.days[2]!.sides.map((side) => side.recipe.title)).toEqual(["Green salad"]);

  const shopping = (await (await call(`/api/shopping/${monday}?days=${wednesday}`)).json()) as { sections: { lines: { amount: number; unit: string; meals: string[] }[] }[] };
  const spinach = shopping.sections.flatMap((section) => section.lines)[0]!;
  expect([spinach.amount, spinach.unit, spinach.meals]).toEqual([2, "bag", ["Wed: Green salad"]]);

  const position = view.days[2]!.sides[0]!.position;
  expect((await call(`/api/plan/days/${wednesday}/sides/${position}`, "DELETE")).status).toBe(204);
  view = await week();
  expect(view.days[2]!.sides).toEqual([]);
});

test("a child who eats the dinner by default gets it on every day with a dinner, unless set otherwise", async () => {
  const { call, create, week } = await loggedIn();
  const fish = await create(recipe("Fish cakes", ["Fish"]));
  const runi = (await week()).children[0]!;
  expect((await call(`/api/children/${runi.id}`, "PUT", { name: runi.name, birthday: null, sameAsDinnerByDefault: true })).status).toBe(200);
  await call(`/api/plan/days/${monday}`, "PUT", { dinnerRecipeId: fish });
  await call(`/api/plan/days/${wednesday}`, "PUT", { dinnerRecipeId: fish });
  await call(`/api/plan/days/${wednesday}/children/${runi.id}`, "PUT", { kind: "empty" });
  const view = await week();
  expect(view.children[0]!.sameAsDinnerByDefault).toBe(true);
  expect(view.days.map((day) => day.children[0]!.kind)).toEqual(["same-as-dinner", "empty", "empty", "empty", "empty", "empty", "empty"]);
  expect(view.days[0]!.extraPortions).toBe(0.5);
  expect(view.rules.find((rule) => rule.childId === runi.id && rule.what === "Fish")!.count).toBe(1);
});
