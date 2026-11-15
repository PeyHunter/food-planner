import { expect, test } from "vitest";
import type { Recipe, RecipeInput, RecipeSummary } from "../src/shared/recipes.ts";
import { createTestApp, startingUsers } from "./support/test-app.ts";

const fishPie: RecipeInput = {
  title: "Fish pie",
  feeds: 4,
  types: ["Fish"],
  tags: ["freezable", "kid-friendly"],
  ageFromMonths: null,
  ageToMonths: null,
  lines: [
    { amount: 3, unit: "pcs", ingredient: "Onion", note: "finely chopped" },
    { amount: 130, unit: "g", ingredient: "Butter", note: "" },
    { amount: null, unit: null, ingredient: "Salt", note: "to taste" },
  ],
  steps: ["Fry the onion.", "Bake for 30 minutes."],
};

async function loggedIn(username = "peyton") {
  const app = await createTestApp();
  const password = startingUsers.find((user) => user.username === username)!.password;
  const { cookie } = await app.logIn(username, password);
  const call = (path: string, method = "GET", body?: unknown) =>
    app.request(path, {
      method,
      headers: { cookie: cookie!, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const create = async (input: RecipeInput) => {
    const response = await call("/api/recipes", "POST", input);
    expect(response.status).toBe(201);
    return ((await response.json()) as { id: string }).id;
  };
  return { app, call, create };
}

test("recipes need a login", async () => {
  const app = await createTestApp();
  expect((await app.request("/api/recipes")).status).toBe(401);
  expect((await app.request("/api/ingredients?q=on")).status).toBe(401);
  expect((await app.request("/api/recipes", { method: "POST", body: "{}" })).status).toBe(401);
});

test("a new recipe saves with its lines, steps, types and tags", async () => {
  const { call, create } = await loggedIn();
  const id = await create(fishPie);

  const recipe = (await (await call(`/api/recipes/${id}`)).json()) as Recipe;
  expect(recipe).toMatchObject({
    id,
    title: "Fish pie",
    feeds: 4,
    types: ["Fish"],
    tags: ["freezable", "kid-friendly"],
    steps: ["Fry the onion.", "Bake for 30 minutes."],
    createdBy: "peyton",
    mainPhoto: null,
    photos: [],
    cooks: [],
    lastMadeOn: null,
    timesMade: 0,
  });
  expect(recipe.lines.map((line) => [line.amount, line.unit, line.ingredient.name, line.note])).toEqual([
    [3, "pcs", "Onion", "finely chopped"],
    [130, "g", "Butter", ""],
    [null, null, "Salt", "to taste"],
  ]);
  expect(recipe.lines[0]!.ingredient.shopSection).toBe("Other");
});

test("the child age range is stored and can be changed", async () => {
  const { call, create } = await loggedIn();
  const id = await create({ ...fishPie, title: "Salmon mash", tags: ["for Runi"], ageFromMonths: 6, ageToMonths: 12 });
  expect(await (await call(`/api/recipes/${id}`)).json()).toMatchObject({ ageFromMonths: 6, ageToMonths: 12 });

  await call(`/api/recipes/${id}`, "PUT", { ...fishPie, ageFromMonths: 8, ageToMonths: null });
  expect(await (await call(`/api/recipes/${id}`)).json()).toMatchObject({ ageFromMonths: 8, ageToMonths: null });

  const backwards = await call(`/api/recipes/${id}`, "PUT", { ...fishPie, ageFromMonths: 12, ageToMonths: 6 });
  expect(backwards.status).toBe(400);
});

test("ingredients are shared: another spelling of the same name is the same ingredient", async () => {
  const { app, create } = await loggedIn();
  await create(fishPie);
  await create({ ...fishPie, title: "Onion soup", lines: [{ amount: 1, unit: "kg", ingredient: "onion", note: "" }] });

  const rows = await app.query<{ name: string }>("select name from ingredients order by name");
  expect(rows.map((row) => row.name)).toEqual(["Butter", "Onion", "Salt"]);
});

test("ingredient suggest finds names that match, starts-with first", async () => {
  const { call, create } = await loggedIn();
  await create({
    ...fishPie,
    lines: ["Carrot", "Red onion", "Onion", "Butter"].map((ingredient) => ({ amount: 1, unit: "pcs" as const, ingredient, note: "" })),
  });

  const names = async (q: string) => ((await (await call(`/api/ingredients?q=${encodeURIComponent(q)}`)).json()) as { name: string }[]).map((row) => row.name);
  expect(await names("on")).toEqual(["Onion", "Red onion"]);
  expect(await names("CAR")).toEqual(["Carrot"]);
  expect(await names("%")).toEqual([]);
  expect(await names("")).toEqual([]);
});

test("editing replaces the lines and steps", async () => {
  const { call, create } = await loggedIn();
  const id = await create(fishPie);

  const response = await call(`/api/recipes/${id}`, "PUT", {
    ...fishPie,
    title: "Better fish pie",
    feeds: 2,
    types: ["Fish", "Vegetables"],
    tags: [],
    lines: [{ amount: 2, unit: "tbsp", ingredient: "Olive oil", note: "" }],
    steps: ["Just bake it."],
  });
  expect(response.status).toBe(200);

  const recipe = (await (await call(`/api/recipes/${id}`)).json()) as Recipe;
  expect(recipe).toMatchObject({ title: "Better fish pie", feeds: 2, types: ["Fish", "Vegetables"], tags: [], steps: ["Just bake it."] });
  expect(recipe.lines.map((line) => line.ingredient.name)).toEqual(["Olive oil"]);
});

test("the list is sorted by name and search looks at names and ingredients", async () => {
  const { call, create } = await loggedIn();
  await create(fishPie);
  await create({ ...fishPie, title: "apple cake", types: ["Vegetarian"], lines: [{ amount: 4, unit: "pcs", ingredient: "Apple", note: "" }] });

  const titles = async (q = "") => ((await (await call(`/api/recipes?q=${encodeURIComponent(q)}`)).json()) as RecipeSummary[]).map((recipe) => recipe.title);
  expect(await titles()).toEqual(["apple cake", "Fish pie"]);
  expect(await titles("FISH")).toEqual(["Fish pie"]);
  expect(await titles("butter")).toEqual(["Fish pie"]);
  expect(await titles("apple")).toEqual(["apple cake"]);
  expect(await titles("nothing like it")).toEqual([]);
});

test("bad recipes are refused in plain words", async () => {
  const { call } = await loggedIn();
  const problem = async (input: unknown) => {
    const response = await call("/api/recipes", "POST", input);
    expect(response.status).toBe(400);
    return ((await response.json()) as { error: string }).error;
  };
  expect(await problem({ ...fishPie, title: " " })).toBe("Give the recipe a name.");
  expect(await problem({ ...fishPie, feeds: 0 })).toBe("Feeds must be a whole number from 1 to 100.");
  expect(await problem({ ...fishPie, feeds: 2.5 })).toBe("Feeds must be a whole number from 1 to 100.");
  expect(await problem({ ...fishPie, types: ["Pizza"] })).toBe("Pick at least one main type.");
  expect(await problem({ ...fishPie, lines: [{ amount: 1, unit: "cup", ingredient: "Rice" }] })).toBe("Pick a unit for Rice.");
  expect(await problem({ ...fishPie, lines: [{ amount: -1, unit: "g", ingredient: "Rice" }] })).toBe("The amount for Rice must be a number above 0.");
  expect(await problem({ ...fishPie, lines: [{ amount: 1, unit: "g", ingredient: "" }] })).toBe("Every ingredient line needs an ingredient.");
});

test("deleting a recipe removes it", async () => {
  const { call, create } = await loggedIn();
  const id = await create(fishPie);

  expect((await call(`/api/recipes/${id}`, "DELETE")).status).toBe(204);
  expect((await call(`/api/recipes/${id}`)).status).toBe(404);
  expect((await call("/api/recipes/not-a-uuid")).status).toBe(404);
});

test("a recipe from another kitchen is not found", async () => {
  const { app, call, create } = await loggedIn();
  const id = await create(fishPie);
  const [other] = await app.query<{ id: string }>("insert into kitchens (name) values ('Next door') returning id");
  await app.query("update recipes set kitchen_id = $1 where id = $2", [other!.id, id]);

  expect((await call(`/api/recipes/${id}`)).status).toBe(404);
  expect((await call(`/api/recipes/${id}`, "PUT", fishPie)).status).toBe(404);
  expect((await call(`/api/recipes/${id}`, "DELETE")).status).toBe(404);
  expect(await (await call("/api/recipes")).json()).toEqual([]);
});

test("ronja sees the recipes peyton added", async () => {
  const { app, create } = await loggedIn("peyton");
  const id = await create(fishPie);
  const { cookie } = await app.logIn("ronja", startingUsers[1]!.password);

  const recipe = (await (await app.request(`/api/recipes/${id}`, { headers: { cookie: cookie! } })).json()) as Recipe;
  expect(recipe.title).toBe("Fish pie");
  expect(recipe.createdBy).toBe("peyton");
});
