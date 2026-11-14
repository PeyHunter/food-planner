import { expect, test } from "vitest";
import type { Ingredient, Recipe } from "../src/shared/recipes.ts";
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
    expect.objectContaining({ name: "Cream", shopSection: "Other", packAmount: null, packUnit: null, alwaysAtHome: false }),
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

  const saved = await call(`/api/ingredients/${cream!.id}`, "PUT", { shopSection: "Dairy", packAmount: 2.5, packUnit: "dl", alwaysAtHome: false });
  expect(saved.status).toBe(200);
  expect(await saved.json()).toEqual({ id: cream!.id, name: "Cream", shopSection: "Dairy", packAmount: 2.5, packUnit: "dl", alwaysAtHome: false });
  await call(`/api/ingredients/${salt!.id}`, "PUT", { shopSection: "Dry goods", packAmount: null, packUnit: null, alwaysAtHome: true });

  const now = await list();
  expect(now.map((ingredient) => [ingredient.name, ingredient.shopSection, ingredient.packAmount, ingredient.packUnit, ingredient.alwaysAtHome])).toEqual([
    ["Cream", "Dairy", 2.5, "dl", false],
    ["salt", "Dry goods", null, null, true],
    ["Spaghetti", "Other", null, null, false],
  ]);
  const recipe = (await (await call(`/api/recipes/${recipeId}`)).json()) as Recipe;
  expect(recipe.lines.find((line) => line.ingredient.name === "Cream")?.ingredient.shopSection).toBe("Dairy");
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
  expect((await list())[0]!.shopSection).toBe("Other");
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
