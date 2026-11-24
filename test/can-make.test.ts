import { expect, test } from "vitest";
import { canMake } from "../src/shared/can-make.ts";
import type { RecipeSummary } from "../src/shared/recipes.ts";

const summary = (title: string): RecipeSummary => ({
  id: title.toLowerCase().replaceAll(" ", "-"),
  title,
  feeds: 4,
  minutes: null,
  ageFromMonths: null,
  ageToMonths: null,
  types: ["Vegetarian"],
  tags: [],
  mainPhoto: null,
  lastMadeOn: null,
  timesMade: 0,
});

test("a recipe with all its ingredients at home has nothing missing", () => {
  const recipe = summary("Toast");
  expect(canMake([{ recipe, ingredients: ["Bread", "Butter"] }], ["bread", "BUTTER"])).toEqual([
    { recipe, have: ["bread", "BUTTER"], missing: [] },
  ]);
});

test("plural and case differences still match, in both directions", () => {
  const pluralRecipe = summary("Carrot soup");
  const singularRecipe = summary("Onion soup");
  const results = canMake(
    [
      { recipe: pluralRecipe, ingredients: ["Carrots", "Onions"] },
      { recipe: singularRecipe, ingredients: ["carrot", "onion"] },
    ],
    ["carrot", "onions"],
  );
  expect(results.map((result) => result.missing)).toEqual([[], []]);
});

test("fewest missing first, then most already at home, then title", () => {
  const items = [
    { recipe: summary("Two match"), ingredients: ["apple", "milk", "salt"] },
    { recipe: summary("Alpha"), ingredients: ["apple", "flour"] },
    { recipe: summary("Beta"), ingredients: ["apple", "flour"] },
    { recipe: summary("Three match"), ingredients: ["apple", "milk"] },
  ];
  const results = canMake(items, ["apple", "butter", "milk"]);
  expect(results.map((result) => result.recipe.title)).toEqual(["Three match", "Two match", "Alpha", "Beta"]);
});

test("recipes with no ingredient lines are left out", () => {
  const recipe = summary("Nothing listed");
  expect(canMake([{ recipe, ingredients: [] }], ["salt"])).toEqual([]);
  expect(canMake([{ recipe, ingredients: ["  "] }], ["salt"])).toEqual([]);
});
