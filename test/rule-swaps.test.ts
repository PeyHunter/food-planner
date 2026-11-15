import { expect, test } from "vitest";
import { isBabyOnly, suggestSwaps, type SwapRecipe } from "../src/shared/rule-swaps.ts";
import type { ChildMeal, Dish, PlanDay, Rule } from "../src/shared/rules.ts";
import { weekDates } from "../src/shared/week.ts";

const recipe = (title: string, types: string[], extra: Partial<SwapRecipe> = {}): SwapRecipe => ({
  id: title,
  title,
  types,
  tags: [],
  lastMadeOn: null,
  forChildren: false,
  babyOnly: false,
  ...extra,
});

const pasta = recipe("Pasta", ["Vegetarian"]);
const curry = recipe("Curry", ["Vegetarian"]);
const salmon = recipe("Salmon", ["Fish"], { lastMadeOn: "2026-11-01" });
const cod = recipe("Cod", ["Fish"], { lastMadeOn: "2026-10-01" });
const steak = recipe("Steak", ["Meat"]);
const salmonMash = recipe("Salmon mash", ["Fish"], { forChildren: true });
const carrotMash = recipe("Carrot mash", ["Vegetables"], { forChildren: true });
const meatMash = recipe("Meat mash", ["Meat"], { forChildren: true });

const week = (dinners: (Dish | null)[], runi: ChildMeal[] = []): PlanDay[] =>
  weekDates("2026-11-09").map((date, index) => ({ date, dinner: dinners[index] ?? null, children: { runi: runi[index] ?? { kind: "empty" } } }));
const full = (dish: Dish) => Array.from({ length: 7 }, () => dish);
const rule = (id: string, childId: string | null, op: Rule["op"], n: number, what: string): Rule => ({ id, childId, op, n, what });

const suggest = (rules: Rule[], days: PlanDay[], recipes: SwapRecipe[], today = "2026-11-09") =>
  suggestSwaps({ rules, days, recipes, childNames: { runi: "Runi Lee" }, today });

test("no suggestions when every rule is met", () => {
  expect(suggest([rule("fish", null, "at-least", 1, "Fish")], week([salmon]), [cod])).toEqual([]);
});

test("fills an empty day first, with the dish not made for the longest time", () => {
  const [swap] = suggest([rule("fish", null, "at-least", 1, "Fish")], week([pasta, pasta, null, pasta, pasta, pasta, pasta]), [salmon, cod]);
  expect(swap).toEqual({
    id: "fish:2026-11-11:Cod",
    ruleId: "fish",
    childId: null,
    date: "2026-11-11",
    recipeId: "Cod",
    text: "Add Cod on Wednesday to get fish 1/1",
  });
});

test("swaps a planned day when no day is empty", () => {
  const [swap] = suggest([rule("fish", null, "at-least", 1, "Fish")], week(full(pasta)), [salmon]);
  expect(swap?.text).toBe("Swap Monday for Salmon to get fish 1/1");
});

test("never breaks a rule that is met now", () => {
  const rules = [rule("fish", null, "at-least", 1, "Fish"), rule("veg", null, "at-least", 1, "Vegetarian")];
  // Monday's pasta is the only vegetarian dinner, so the swap goes on Tuesday.
  const [swap] = suggest(rules, week([pasta, steak, steak, steak, steak, steak, steak]), [salmon]);
  expect(swap?.date).toBe("2026-11-10");
});

test("skips days that are already past", () => {
  const [swap] = suggest([rule("fish", null, "at-least", 1, "Fish")], week([]), [salmon], "2026-11-13");
  expect(swap?.date).toBe("2026-11-13");
  expect(suggest([rule("fish", null, "at-least", 1, "Fish")], week([]), [salmon], "2026-11-16")).toEqual([]);
});

test("a child's rule picks a child recipe for the child's own row", () => {
  const runi = [{ kind: "same-as-dinner" }, { kind: "recipe", dish: carrotMash }] as ChildMeal[];
  const [swap] = suggest([rule("fish", "runi", "at-least", 2, "Fish")], week(full(pasta), runi), [salmon, salmonMash, carrotMash]);
  expect(swap).toMatchObject({ childId: "runi", date: "2026-11-11", recipeId: "Salmon mash", text: "Add Salmon mash on Runi Lee's Wednesday to get fish 1/2" });
});

test("an at-most rule that is broken gets a swap away from it", () => {
  const runi = [{ kind: "recipe", dish: meatMash }, { kind: "recipe", dish: meatMash }] as ChildMeal[];
  const [swap] = suggest([rule("meat", "runi", "at-most", 1, "Meat")], week([], runi), [carrotMash, meatMash]);
  expect(swap?.text).toBe("Swap Runi Lee's Monday for Carrot mash to get meat down to 1");
});

test("a dinner swap that would break a child's same-as-dinner rule is not offered", () => {
  const rules = [rule("fish", null, "at-least", 1, "Fish"), rule("veg", "runi", "at-least", 1, "Vegetarian")];
  const runi = [{ kind: "same-as-dinner" }] as ChildMeal[];
  const [swap] = suggest(rules, week([pasta, steak, steak, steak, steak, steak, steak], runi), [salmon]);
  expect(swap?.date).toBe("2026-11-10");
});

test("one suggestion per missed rule, the same every time", () => {
  const rules = [rule("fish", null, "at-least", 1, "Fish"), rule("veg", null, "at-least", 1, "Vegetables")];
  const days = week([pasta]);
  const recipes = [salmon, cod, curry, recipe("Soup", ["Vegetables"])];
  const first = suggest(rules, days, recipes);
  expect(first.map((s) => s.ruleId)).toEqual(["fish", "veg"]);
  expect(suggest(rules, days, recipes)).toEqual(first);
});

test("adults get a child recipe when it is the only one that meets the rule", () => {
  const [swap] = suggest([rule("fish", null, "at-least", 1, "Fish")], week(full(pasta)), [salmonMash, curry]);
  expect(swap?.recipeId).toBe("Salmon mash");
});

test("adults get a grown-up recipe before a child recipe", () => {
  // Salmon mash was never made, so it sorts before Salmon; Salmon still wins.
  const [swap] = suggest([rule("fish", null, "at-least", 1, "Fish")], week(full(pasta)), [salmonMash, salmon]);
  expect(swap?.recipeId).toBe("Salmon");
});

test("adults get a grown-up recipe on a later day before a child recipe on an earlier one", () => {
  const rules = [rule("fish", null, "at-least", 1, "Fish"), rule("veg", null, "at-least", 1, "Vegetarian")];
  // Monday holds the only vegetarian dinner, so plain Salmon can only go on Tuesday; the vegetarian fish mash could take Monday.
  const vegFishMash = recipe("Veg fish mash", ["Fish", "Vegetarian"], { forChildren: true });
  const [swap] = suggest(rules, week([pasta, steak, steak, steak, steak, steak, steak]), [vegFishMash, salmon]);
  expect(swap).toMatchObject({ recipeId: "Salmon", date: "2026-11-10" });
});

test("adults never get a recipe for babies only (age range ends before 18 months)", () => {
  const babyFish = recipe("Baby fish puree", ["Fish"], { forChildren: true, babyOnly: true });
  expect(suggest([rule("fish", null, "at-least", 1, "Fish")], week(full(pasta)), [babyFish])).toEqual([]);
  const [swap] = suggest([rule("fish", "runi", "at-least", 1, "Fish")], week(full(pasta)), [babyFish]);
  expect(swap?.recipeId).toBe("Baby fish puree");
});

test("isBabyOnly: only an age range that ends below 18 months", () => {
  expect([isBabyOnly(null), isBabyOnly(12), isBabyOnly(17), isBabyOnly(18), isBabyOnly(36)]).toEqual([false, true, true, false, false]);
});
