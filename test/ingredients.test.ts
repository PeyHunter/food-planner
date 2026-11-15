import { expect, test } from "vitest";
import type { Ingredient, IngredientRow, Recipe } from "../src/shared/recipes.ts";
import { createTestApp, startingUsers } from "./support/test-app.ts";

async function kitchenWithIngredients() {
  const app = await createTestApp();
  const { cookie } = await app.logIn("peyton", startingUsers[0]!.password);
  const call = (path: string, method = "GET", body?: unknown) =>
    app.request(path, {
      method,
      headers: { cookie: cookie!, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const made = await call("/api/recipes", "POST", {
    title: "Pasta",
    feeds: 2,
    types: ["Vegetarian"],
    tags: [],
    lines: [
      { amount: 500, unit: "g", ingredient: "Spaghetti", note: "" },
      { amount: 1, unit: "tsp", ingredient: "salt", note: "" },
      { amount: 200, unit: "ml", ingredient: "Cream", note: "" },
    ],
    steps: [],
  });
  const recipeId = ((await made.json()) as { id: string }).id;
  const list = async (query = "") => (await (await call(`/api/ingredients?all=1${query}`)).json()) as Ingredient[];
  return { app, call, list, recipeId };
}

test("the Ingredients screen lists every ingredient with its settings, and can search", async () => {
  const { call, list } = await kitchenWithIngredients();

  expect(await list()).toEqual([
    expect.objectContaining({ name: "Cream", shopSection: "Dairy", packAmount: null, packUnit: null, alwaysAtHome: false, recipes: 1 }),
    expect.objectContaining({ name: "salt" }),
    expect.objectContaining({ name: "Spaghetti" }),
  ]);
  expect((await list("&q=SPAG")).map((ingredient) => ingredient.name)).toEqual(["Spaghetti"]);
  // Without ?all=1 an empty search still suggests nothing.
  expect(await (await call("/api/ingredients")).json()).toEqual([]);
});

test("an ingredient's shop section, pack size and always-at-home flag can be set", async () => {
  const { call, list, recipeId } = await kitchenWithIngredients();
  const [cream, salt] = await list();

  const saved = await call(`/api/ingredients/${cream!.id}`, "PUT", { shopSection: "Frozen", packAmount: 2.5, packUnit: "dl", alwaysAtHome: false });
  expect(saved.status).toBe(200);
  expect(await saved.json()).toEqual({ id: cream!.id, name: "Cream", shopSection: "Frozen", packAmount: 2.5, packUnit: "dl", alwaysAtHome: false });
  await call(`/api/ingredients/${salt!.id}`, "PUT", { shopSection: "Dry goods", packAmount: null, packUnit: null, alwaysAtHome: true });

  const now = await list();
  expect(now.map((ingredient) => [ingredient.name, ingredient.shopSection, ingredient.packAmount, ingredient.packUnit, ingredient.alwaysAtHome])).toEqual([
    ["Cream", "Frozen", 2.5, "dl", false],
    ["salt", "Dry goods", null, null, true],
    ["Spaghetti", "Dry goods", null, null, false],
  ]);
  const recipe = (await (await call(`/api/recipes/${recipeId}`)).json()) as Recipe;
  expect(recipe.lines.find((line) => line.ingredient.name === "Cream")?.ingredient.shopSection).toBe("Frozen");
});

test("new ingredients get a guessed shop section, and a user's choice is never overwritten", async () => {
  const { call, list } = await kitchenWithIngredients();
  const [cream] = await list();
  await call(`/api/ingredients/${cream!.id}`, "PUT", { shopSection: "Other", packAmount: null, packUnit: null, alwaysAtHome: false });
  await call("/api/recipes", "POST", {
    title: "Fish pie",
    feeds: 2,
    types: ["Fish"],
    tags: [],
    lines: ["cream", "Salmon", "Sweet potatoes", "Frozen peas", "Saffron"].map((ingredient) => ({ amount: 1, unit: "pcs", ingredient, note: "" })),
    steps: [],
  });
  expect((await list()).map((ingredient) => [ingredient.name, ingredient.shopSection])).toEqual([
    ["Cream", "Other"],
    ["Frozen peas", "Frozen"],
    ["Saffron", "Other"],
    ["Salmon", "Meat & fish"],
    ["salt", "Dry goods"],
    ["Spaghetti", "Dry goods"],
    ["Sweet potatoes", "Vegetables"],
  ]);
});

test("a plural or singular spelling reuses the ingredient that is already there", async () => {
  const { call, list } = await kitchenWithIngredients();
  await call("/api/recipes", "POST", {
    title: "Mash",
    feeds: 2,
    types: ["Vegetarian"],
    tags: [],
    lines: [
      { amount: 1, unit: "kg", ingredient: "potatoes", note: "" },
      { amount: 1, unit: "pcs", ingredient: "Spaghettis", note: "" },
      { amount: 2, unit: "pcs", ingredient: "carrots", note: "" },
      { amount: 1, unit: "pcs", ingredient: "Carrot", note: "" },
      { amount: 1, unit: "tsp", ingredient: "SALT", note: "" },
    ],
    steps: [],
  });
  const names = ((await list()) as IngredientRow[]).map((ingredient) => [ingredient.name, ingredient.recipes]);
  expect(names).toEqual([
    ["carrots", 1],
    ["Cream", 1],
    ["potatoes", 1],
    ["salt", 2],
    ["Spaghetti", 2],
  ]);

  // Suggestions find the other spelling too.
  const suggest = async (q: string) => ((await (await call(`/api/ingredients?q=${q}`)).json()) as Ingredient[]).map((ingredient) => ingredient.name);
  expect(await suggest("potato")).toEqual(["potatoes"]);
  expect(await suggest("carrot")).toEqual(["carrots"]);
  expect(await suggest("spaghettis")).toEqual(["Spaghetti"]);
});

test("an ingredient no recipe uses can be deleted", async () => {
  const { call, list, recipeId } = await kitchenWithIngredients();
  const [cream] = await list();
  const remove = async () => {
    const response = await call(`/api/ingredients/${cream!.id}`, "DELETE");
    return [response.status, response.status === 204 ? undefined : ((await response.json()) as { error: string }).error];
  };

  expect(await remove()).toEqual([409, "Cream is in a recipe, so it can't be deleted. Take it out of the recipe first."]);
  expect((await call(`/api/recipes/${recipeId}`, "DELETE")).status).toBe(204);
  expect((await list())[0]).toMatchObject({ name: "Cream", recipes: 0 });
  expect(await remove()).toEqual([204, undefined]);
  expect((await list()).map((ingredient) => ingredient.name)).not.toContain("Cream");
  expect((await remove())[0]).toBe(404);
});

test("bad settings are refused in plain words", async () => {
  const { call, list } = await kitchenWithIngredients();
  const [cream] = await list();
  const put = async (body: unknown) => {
    const response = await call(`/api/ingredients/${cream!.id}`, "PUT", body);
    return [response.status, ((await response.json()) as { error?: string }).error];
  };
  const fine = { shopSection: "Dairy", packAmount: 1, packUnit: "l", alwaysAtHome: false };

  expect(await put({ ...fine, shopSection: "Bakery" })).toEqual([400, "Pick a shop section."]);
  expect(await put({ ...fine, packAmount: 0 })).toEqual([400, "The pack size must be a number above 0."]);
  expect(await put({ ...fine, packUnit: "cups" })).toEqual([400, "Pick a unit for the pack size."]);
  expect(await put({ ...fine, packUnit: null })).toEqual([400, "A pack size needs both an amount and a unit."]);
  expect(await put({ ...fine, alwaysAtHome: "yes" })).toEqual([400, "Say if it is always at home."]);
  expect((await list())[0]!.shopSection).toBe("Dairy");
});

test("ingredients need a login and stay in their kitchen", async () => {
  const { app, call, list } = await kitchenWithIngredients();
  const [cream] = await list();
  const settings = { shopSection: "Dairy", packAmount: null, packUnit: null, alwaysAtHome: false };

  expect((await app.request("/api/ingredients?all=1")).status).toBe(401);
  expect((await app.request(`/api/ingredients/${cream!.id}`, { method: "PUT", body: JSON.stringify(settings) })).status).toBe(401);

  const [other] = await app.query<{ id: string }>("insert into kitchens (name) values ('Next door') returning id");
  await app.query("update ingredients set kitchen_id = $1 where id = $2", [other!.id, cream!.id]);
  expect((await list()).map((ingredient) => ingredient.name)).not.toContain("Cream");
  expect((await call(`/api/ingredients/${cream!.id}`, "PUT", settings)).status).toBe(404);
  expect((await call("/api/ingredients/not-an-id", "PUT", settings)).status).toBe(404);
});
