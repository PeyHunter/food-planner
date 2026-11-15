import { expect, test } from "vitest";
import type { ChildRecipes, ChildView } from "../src/shared/children.ts";
import type { RecipeInput } from "../src/shared/recipes.ts";
import { createTestApp, startingUsers } from "./support/test-app.ts";

// The test clock says 2026-03-01.
const recipe = (title: string, extra: Partial<RecipeInput> = {}): RecipeInput => ({
  title,
  feeds: 4,
  types: ["Vegetables"],
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
  const kids = async (today = "2026-03-01") => (await (await call(`/api/children?today=${today}`)).json()) as ChildView[];
  const create = async (input: RecipeInput) => ((await (await call("/api/recipes", "POST", input)).json()) as { id: string }).id;
  const recipesFor = async (id: string, today = "2026-03-01") => (await (await call(`/api/children/${id}/recipes?today=${today}`)).json()) as ChildRecipes;
  return { app, call, kids, create, recipesFor };
}

test("children need a login", async () => {
  const { app } = await loggedIn();
  expect((await app.request("/api/children")).status).toBe(401);
});

test("Runi Lee is there first, with no birthday yet; setting it gives her age", async () => {
  const { call, kids } = await loggedIn();
  const [runi] = await kids();
  expect(runi).toMatchObject({ name: "Runi Lee", birthday: null, ageMonths: null });

  expect((await call(`/api/children/${runi!.id}`, "PUT", { name: "Runi Lee", birthday: "2025-08-01" })).status).toBe(200);
  expect((await kids())[0]).toMatchObject({ birthday: "2025-08-01", ageMonths: 7 });
  expect((await kids("2026-08-01"))[0]!.ageMonths).toBe(12);
});

test("add a child, rename, refuse bad input, remove", async () => {
  const { call, kids } = await loggedIn();
  expect((await call("/api/children", "POST", { name: " ", birthday: null })).status).toBe(400);
  expect((await call("/api/children", "POST", { name: "Bo", birthday: "2026-02-30" })).status).toBe(400);
  expect((await call("/api/children", "POST", { name: "Bo", birthday: "2027-01-01" })).status).toBe(400);
  const made = await call("/api/children", "POST", { name: "Bo", birthday: "2026-01-15" });
  expect(made.status).toBe(201);
  const { id } = (await made.json()) as { id: string };
  expect((await kids()).map((kid) => [kid.name, kid.ageMonths])).toEqual([
    ["Runi Lee", null],
    ["Bo", 1],
  ]);

  await call(`/api/children/${id}`, "PUT", { name: "Bo Lee", birthday: null });
  expect((await kids())[1]).toMatchObject({ name: "Bo Lee", birthday: null, ageMonths: null });

  expect((await call(`/api/children/${id}`, "DELETE")).status).toBe(204);
  const [runi] = await kids();
  expect((await call(`/api/children/${runi!.id}`, "DELETE")).status).toBe(409);
});

test("a child from another kitchen is not found", async () => {
  const { app, call } = await loggedIn();
  const [other] = await app.query<{ id: string }>("insert into kitchens (name) values ('Next door') returning id");
  const [kid] = await app.query<{ id: string }>("insert into children (kitchen_id, name) values ($1, 'Mo') returning id", [other!.id]);
  expect((await call(`/api/children/${kid!.id}`, "PUT", { name: "Mine", birthday: null })).status).toBe(404);
  expect((await call(`/api/children/${kid!.id}`, "DELETE")).status).toBe(404);
  expect((await call(`/api/children/${kid!.id}/recipes`)).status).toBe(404);
  expect((await call("/api/children/nope/recipes")).status).toBe(404);
});

test("recipes that fit her age now, and all her recipes", async () => {
  const { call, kids, create, recipesFor } = await loggedIn();
  await create(recipe("Carrot mash", { ageFromMonths: 6, ageToMonths: 12 }));
  await create(recipe("Toddler pasta", { ageFromMonths: 12, ageToMonths: 36 }));
  await create(recipe("Fish fingers", { tags: ["for Runi"] }));
  await create(recipe("Lasagne"));
  const [runi] = await kids();

  const before = await recipesFor(runi!.id);
  expect(before.fitsNow).toEqual([]);
  expect(before.all.map((item) => item.title)).toEqual(["Carrot mash", "Fish fingers", "Toddler pasta"]);
  expect(before.all[0]).toMatchObject({ ageFromMonths: 6, ageToMonths: 12 });

  await call(`/api/children/${runi!.id}`, "PUT", { name: "Runi Lee", birthday: "2025-08-01" });
  expect((await recipesFor(runi!.id)).fitsNow.map((item) => item.title)).toEqual(["Carrot mash"]);
  expect((await recipesFor(runi!.id, "2026-08-01")).fitsNow.map((item) => item.title)).toEqual(["Carrot mash", "Toddler pasta"]);
  expect((await recipesFor(runi!.id, "2027-08-01")).fitsNow.map((item) => item.title)).toEqual(["Toddler pasta"]);
});
