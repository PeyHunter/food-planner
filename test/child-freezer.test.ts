import { expect, test } from "vitest";
import type { RecipeInput } from "../src/shared/recipes.ts";
import type { FreezerItem, WeekView } from "../src/shared/week.ts";
import { createTestApp, startingUsers } from "./support/test-app.ts";

// The test clock says 2026-03-01, a Sunday.
const monday = "2026-03-02";

const recipe = (title: string, extra: Partial<RecipeInput> = {}): RecipeInput => ({
  title,
  feeds: 4,
  types: ["Fish"],
  tags: ["freezable"],
  ageFromMonths: null,
  ageToMonths: null,
  lines: [],
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
  const weekView = async () => (await (await call(`/api/plan/weeks/${monday}`)).json()) as WeekView;
  const childFreezer = async (childId: string) => (await (await call(`/api/children/${childId}/freezer`)).json()) as FreezerItem[];
  const countOf = async (childId: string, recipeId: string) => (await childFreezer(childId)).find((item) => item.recipe.id === recipeId)?.count ?? 0;
  return { app, call, create, weekView, childFreezer, countOf };
}

test("her freezer holds portions, the week plans a meal from it, and clearing gives the portion back", async () => {
  const { call, create, weekView, childFreezer, countOf } = await loggedIn();
  const mash = await create(recipe("Runi mash"));
  const runi = (await weekView()).children[0]!.id;

  expect(await (await call(`/api/children/${runi}/freezer/${mash}`, "POST", { add: 2 })).json()).toEqual({ count: 2 });
  expect(await childFreezer(runi)).toMatchObject([{ recipe: { id: mash, title: "Runi mash", tags: ["freezable"] }, count: 2 }]);

  expect((await call(`/api/plan/days/${monday}/children/${runi}`, "PUT", { kind: "recipe", recipeId: mash, fromFreezer: true })).status).toBe(204);
  expect(await countOf(runi, mash)).toBe(1);
  let view = await weekView();
  expect(view.days[0]!.children[0]).toMatchObject({ kind: "recipe", fromFreezer: true, recipe: { id: mash } });
  expect(view.childFreezer[runi]).toMatchObject([{ recipe: { id: mash }, count: 1 }]);

  expect((await call(`/api/plan/days/${monday}/children/${runi}`, "PUT", { kind: "empty" })).status).toBe(204);
  expect(await countOf(runi, mash)).toBe(2);
  view = await weekView();
  expect(view.days[0]!.children[0]).toMatchObject({ kind: "empty", fromFreezer: false });

  // Empty it, then planning from it changes nothing and says so.
  await call(`/api/children/${runi}/freezer/${mash}`, "POST", { add: -2 });
  const response = await call(`/api/plan/days/${monday}/children/${runi}`, "PUT", { kind: "recipe", recipeId: mash, fromFreezer: true });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "None of that dish is left in her freezer." });
  expect((await weekView()).days[0]!.children[0]!.kind).toBe("empty");
  expect(await countOf(runi, mash)).toBe(0);
});

test("a child freezer only takes this kitchen's child and recipes", async () => {
  const { app, call, create, weekView } = await loggedIn();
  const mash = await create(recipe("Mash"));
  const runi = (await weekView()).children[0]!.id;
  const [kitchen] = await app.query<{ id: string }>("insert into kitchens (name) values ('Other kitchen') returning id");
  const [other] = await app.query<{ id: string }>("insert into recipes (kitchen_id, title, feeds) values ($1, 'Other pie', 4) returning id", [kitchen!.id]);
  const [otherChild] = await app.query<{ id: string }>("insert into children (kitchen_id, name) values ($1, 'Other kid') returning id", [kitchen!.id]);

  expect((await call(`/api/children/${runi}/freezer/${other!.id}`, "POST", { add: 1 })).status).toBe(404);
  expect((await call(`/api/children/${otherChild!.id}/freezer`)).status).toBe(404);
  expect((await call(`/api/plan/days/${monday}/children/${runi}`, "PUT", { kind: "recipe", recipeId: other!.id })).status).toBe(404);

  for (const add of [0, 1.5, 51]) expect((await call(`/api/children/${runi}/freezer/${mash}`, "POST", { add })).status).toBe(400);
});
