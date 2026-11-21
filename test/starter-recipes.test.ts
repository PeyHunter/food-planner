import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { ensureHousehold } from "../src/server/household.ts";
import { addStarterRecipesOnce } from "../src/server/starter-recipes.ts";
import { starterRecipes, starterRecipeInputs } from "../src/shared/starter-recipes.ts";
import { parseInput } from "../src/server/recipes.ts";
import { createTestApp, startingUsers } from "./support/test-app.ts";

const valdemarAndAnna = [
  { username: "valdemar", password: randomUUID() },
  { username: "anna", password: randomUUID() },
];

test("every starter recipe passes the recipe form's own checks in both languages", () => {
  expect(starterRecipes).toHaveLength(15);
  for (const language of ["en", "da"] as const) {
    for (const input of starterRecipeInputs(language, true)) expect(parseInput(input)).toEqual(input);
  }
  const fish = starterRecipes.filter((recipe) => recipe.types.includes("Fish"));
  expect(fish.length).toBeGreaterThanOrEqual(3);
});

test("a new Danish kitchen with kids gets its own children, rules for each, Danish logins and the starter recipes once", async () => {
  const app = await createTestApp();
  const kitchen = { name: "Valdemar og Annas køkken", kids: ["Vilje", "Konrad"], language: "da" as const };
  const kitchenId = await ensureHousehold(app.database, valdemarAndAnna, kitchen);
  expect(await addStarterRecipesOnce(app.database, kitchenId, "da")).toBe(true);
  // A restart runs both again.
  expect(await ensureHousehold(app.database, valdemarAndAnna, kitchen)).toBe(kitchenId);
  expect(await addStarterRecipesOnce(app.database, kitchenId, "da")).toBe(false);

  const kids = await app.query<{ name: string; birthday: string | null }>("select name, birthday from children where kitchen_id = $1 order by name", [kitchenId]);
  expect(kids).toEqual([{ name: "Konrad", birthday: null }, { name: "Vilje", birthday: null }]);
  const childRules = await app.query("select * from rules where kitchen_id = $1 and child_id is not null", [kitchenId]);
  expect(childRules).toHaveLength(6);
  expect(await app.query("select language from users where username in ('valdemar', 'anna')")).toEqual([{ language: "da" }, { language: "da" }]);

  const titles = await app.query<{ title: string }>("select title from recipes where kitchen_id = $1 order by title", [kitchenId]);
  expect(titles).toHaveLength(15);
  expect(titles.map((row) => row.title)).toContain("Boller i karry");
  // "Løg" is in many recipes but is one ingredient.
  expect(await app.query("select * from ingredients where kitchen_id = $1 and name = 'Løg'", [kitchenId])).toHaveLength(1);
  // Peyton and Ronja's kitchen is untouched.
  expect(await app.query("select * from recipes where kitchen_id <> $1", [kitchenId])).toHaveLength(0);
});

test("the button adds the starter recipes in your language to an empty kitchen, reusing its ingredients, and only once", async () => {
  const app = await createTestApp();
  const { cookie } = await app.logIn("peyton", startingUsers[0]!.password);
  const headers = { cookie: cookie!, "content-type": "application/json" };
  await app.query("insert into ingredients (kitchen_id, name, shop_section) select id, 'onion', 'Vegetables' from kitchens");

  const first = await app.request("/api/recipes/starter", { method: "POST", headers });
  expect(first.status).toBe(201);
  expect(await first.json()).toEqual({ added: 15 });
  const list = (await (await app.request("/api/recipes?q=", { headers })).json()) as { title: string; tags: string[] }[];
  expect(list.map((recipe) => recipe.title)).toContain("Meatballs in curry sauce");
  expect(list.find((recipe) => recipe.title === "Frikadeller")!.tags).toContain("kid-friendly");
  expect(await app.query("select name from ingredients where lower(name) = 'onion'")).toEqual([{ name: "onion" }]);

  const again = await app.request("/api/recipes/starter", { method: "POST", headers });
  expect(again.status).toBe(409);
  expect(await app.query("select * from recipes")).toHaveLength(15);
});

test("a kitchen without kids gets no kid tags", async () => {
  const app = await createTestApp();
  const kitchenId = await ensureHousehold(app.database, [{ username: "marieke", password: randomUUID() }], { name: "Marieke's kitchen", kids: [], language: "en" });
  await addStarterRecipesOnce(app.database, kitchenId, "en");
  expect(await app.query("select * from recipe_tags where tag = 'kid-friendly'")).toHaveLength(0);
  expect(await app.query("select * from children where kitchen_id = $1", [kitchenId])).toHaveLength(0);
});
