import { expect, test } from "vitest";
import { createWeek, type CreateWeekInput, type PlannerDay, type PlannerRecipe } from "../src/shared/create-week.ts";
import type { Rule } from "../src/shared/rules.ts";
import type { ShoppingIngredient } from "../src/shared/shopping.ts";
import { weekDates } from "../src/shared/week.ts";

const monday = "2026-03-02";
const runi = { id: "runi", name: "Runi Lee", ageMonths: 10 };

let next = 0;
const dish = (title: string, types: string[] = [], extra: Partial<PlannerRecipe> = {}): PlannerRecipe => ({
  id: `r${++next}`,
  title,
  feeds: 4,
  types,
  tags: [],
  lines: [],
  lastMadeOn: null,
  ageFromMonths: null,
  ageToMonths: null,
  ...extra,
});
const forRuni = (title: string, types: string[] = [], extra: Partial<PlannerRecipe> = {}) => dish(title, types, { tags: ["for Runi"], ...extra });
const emptyWeek = (kids = [runi]): PlannerDay[] =>
  weekDates(monday).map((date) => ({ date, people: 2, dinner: null, children: Object.fromEntries(kids.map((kid) => [kid.id, { kind: "empty" as const }])) }));
const rule = (childId: string | null, op: Rule["op"], n: number, what: string): Rule => ({ id: `${childId}:${op}:${what}`, childId, op, n, what });
const input = (extra: Partial<CreateWeekInput>): CreateWeekInput => ({ rules: [], days: emptyWeek(), recipes: [], children: [runi], today: monday, ...extra });

test("fills only empty dinners and never touches a planned day", () => {
  const planned = dish("Planned pie");
  const days = emptyWeek();
  days[1]!.dinner = planned;
  const recipes = Array.from({ length: 10 }, (_, index) => dish(`Dish ${index}`));
  const { fills } = createWeek(input({ days, recipes: [planned, ...recipes], children: [] }));
  const dinners = fills.filter((fill) => fill.childId === null);
  expect(dinners.map((fill) => fill.date)).toEqual(weekDates(monday).filter((date) => date !== days[1]!.date));
  expect(dinners.some((fill) => fill.recipeId === planned.id)).toBe(false);
  expect(new Set(dinners.map((fill) => fill.recipeId)).size).toBe(6);
});

test("past days stay as they are", () => {
  const recipes = Array.from({ length: 10 }, (_, index) => dish(`Dish ${index}`));
  const { fills } = createWeek(input({ recipes, children: [], today: "2026-03-05" }));
  expect(fills.map((fill) => fill.date)).toEqual(["2026-03-05", "2026-03-06", "2026-03-07", "2026-03-08"]);
});

test("meets at-least rules first and never breaks an at-most rule", () => {
  const recipes = [dish("A steak", ["Meat"]), dish("B steak", ["Meat"]), dish("C chops", ["Meat"]), dish("Z cod", ["Fish"]), dish("Z salmon", ["Fish"]), dish("Y beans", ["Vegetarian"])];
  const rules = [rule(null, "at-least", 2, "Fish"), rule(null, "at-most", 1, "Meat")];
  const result = createWeek(input({ rules, recipes, children: [] }));
  expect(result.rules.map((status) => [status.what, status.count, status.met])).toEqual([
    ["Fish", 2, true],
    ["Meat", 1, true],
  ]);
  // Fish goes on the first empty days; one meat dish, then the rest; the week is short of dishes.
  const titles = result.fills.map((fill) => recipes.find((recipe) => recipe.id === fill.recipeId)!.title);
  expect(titles).toEqual(["Z cod", "Z salmon", "A steak", "Y beans"]);
});

test("a dinner counts for a child eating the same, so it keeps the child's at-most rule", () => {
  const days = emptyWeek();
  for (const day of days) day.children.runi = { kind: "same-as-dinner" };
  const recipes = [dish("A steak", ["Meat"]), dish("B steak", ["Meat"]), dish("C dal", ["Vegetarian"])];
  const result = createWeek(input({ days, recipes, rules: [rule("runi", "at-most", 1, "Meat")] }));
  expect(result.rules[0]).toMatchObject({ count: 1, met: true });
  expect(result.fills).toHaveLength(2);
});

test("an at-most rule already broken by the plan blocks more of the same", () => {
  const days = emptyWeek();
  days[0]!.dinner = dish("Planned steak", ["Meat"]);
  days[1]!.dinner = dish("Planned ribs", ["Meat"]);
  const { fills } = createWeek(input({ days, recipes: [dish("More meat", ["Meat"])], rules: [rule(null, "at-most", 1, "Meat")], children: [] }));
  expect(fills).toEqual([]);
});

test("skips dishes made in the last 14 days and dishes already in the week", () => {
  const recent = dish("Made last week", [], { lastMadeOn: "2026-02-20" });
  const longAgo = dish("Made long ago", [], { lastMadeOn: "2026-02-10" });
  const inWeek = dish("Already Monday");
  const days = emptyWeek();
  days[0]!.dinner = inWeek;
  const { fills } = createWeek(input({ days, recipes: [recent, longAgo, inWeek], children: [] }));
  expect(fills).toEqual([{ date: "2026-03-03", childId: null, recipeId: longAgo.id }]);
});

test("ties go to the dish not made for the longest time, then by title", () => {
  const recipes = [dish("Banana bread", [], { lastMadeOn: "2026-01-10" }), dish("Apple pie", [], { lastMadeOn: "2026-01-10" }), dish("Zucchini soup"), dish("Old curry", [], { lastMadeOn: "2025-12-01" })];
  const { fills } = createWeek(input({ recipes, children: [] }));
  expect(fills.map((fill) => recipes.find((recipe) => recipe.id === fill.recipeId)!.title)).toEqual(["Zucchini soup", "Old curry", "Apple pie", "Banana bread"]);
});

test("prefers a dish that uses up a leftover pack", () => {
  const carrots: ShoppingIngredient = { id: "carrots", name: "Carrots", shopSection: "Vegetables", packAmount: 1000, packUnit: "g", alwaysAtHome: false };
  const days = emptyWeek([]);
  const soup = dish("Carrot soup", [], { lines: [{ amount: 400, unit: "g", ingredient: carrots }] });
  days[0]!.dinner = soup;
  const cake = dish("Z carrot cake", [], { lines: [{ amount: 200, unit: "g", ingredient: carrots }] });
  const plain = dish("A plain pasta");
  const { fills } = createWeek(input({ days, recipes: [soup, plain, cake], children: [] }));
  expect(fills[0]).toEqual({ date: "2026-03-03", childId: null, recipeId: cake.id });
});

test("child days get child recipes that fit the child's age, and follow the child's rules", () => {
  const days = emptyWeek();
  days[0]!.children.runi = { kind: "same-as-dinner" };
  days[1]!.children.runi = { kind: "recipe", dish: forRuni("Planned mash") };
  const recipes = [
    dish("Grown-up fish", ["Fish"]),
    forRuni("Cod mash", ["Fish"]),
    forRuni("Salmon mash", ["Fish", "Vegetables"]),
    forRuni("Pea mash", ["Vegetables"]),
    dish("Baby carrots", ["Vegetables"], { ageFromMonths: 6, ageToMonths: 12 }),
    dish("Toddler veg", ["Vegetables"], { ageFromMonths: 18, ageToMonths: null }),
  ];
  const rules = [rule("runi", "at-least", 2, "Fish"), rule("runi", "at-least", 3, "Vegetables")];
  const result = createWeek(input({ days, recipes, rules }));
  const runiFills = result.fills.filter((fill) => fill.childId === "runi");
  // Runi eats Monday's dinner mashed, so a dinner that helps her rules wins there.
  expect(result.fills[0]).toEqual({ date: "2026-03-02", childId: null, recipeId: recipes[2]!.id });
  expect(runiFills.map((fill) => fill.date)).toEqual(["2026-03-04", "2026-03-05", "2026-03-06"]);
  const titles = runiFills.map((fill) => recipes.find((recipe) => recipe.id === fill.recipeId)!.title);
  expect(titles).not.toContain("Toddler veg");
  expect(titles).not.toContain("Grown-up fish");
  expect(result.rules.find((status) => status.what === "Fish")).toMatchObject({ count: 2, met: true });
  expect(result.rules.find((status) => status.what === "Vegetables")).toMatchObject({ count: 3, met: true });
});

test("adults get child recipes only when nothing else helps, and never baby-only food", () => {
  const recipes = [forRuni("Fish fingers", ["Fish"]), dish("Purée", ["Fish"], { ageFromMonths: 6, ageToMonths: 12 }), dish("Pasta")];
  const { fills } = createWeek(input({ recipes, rules: [rule(null, "at-least", 1, "Fish")], children: [] }));
  expect(fills.map((fill) => recipes.find((recipe) => recipe.id === fill.recipeId)!.title)).toEqual(["Fish fingers", "Pasta"]);
});

test("the same week always gives the same plan, and the note says what happened", () => {
  const recipes = [dish("Cod", ["Fish"]), dish("Dal", ["Vegetarian"]), forRuni("Cod mash", ["Fish"]), forRuni("Pea mash", ["Vegetables"])];
  const days = emptyWeek();
  days[2]!.dinner = dish("Planned pie");
  const rules = [rule(null, "at-least", 1, "Fish"), rule("runi", "at-least", 2, "Fish")];
  const first = createWeek(input({ days, recipes, rules }));
  expect(createWeek(input({ days, recipes: [...recipes].reverse(), rules }))).toEqual(first);
  // Monday's cod also goes to Runi Lee mashed, so she needs only one more fish meal.
  expect(first.note).toBe("Filled 2 dinners and 3 meals for Runi Lee. 4 days still empty: add more recipes to fill them. Fish 1/1 ✓ · Fish 2/2 for Runi Lee ✓");
  expect(days[0]!.dinner).toBeNull();
});

test("a child eats a dinner mashed when it helps a rule still short, before child recipes", () => {
  const days = emptyWeek();
  const recipes = [dish("A cod", ["Fish"]), dish("B dal", ["Vegetarian"]), dish("C salmon", ["Fish"]), forRuni("Pea mash", ["Vegetables"]), forRuni("Cod mash", ["Fish"])];
  const rules = [rule("runi", "at-least", 2, "Fish"), rule("runi", "at-most", 0, "Meat")];
  const result = createWeek(input({ days, recipes, rules }));
  const runi = result.fills.filter((fill) => fill.childId === "runi");
  // Monday's cod and Wednesday's salmon meet the fish rule, so no fish recipe for Runi Lee is needed.
  expect(runi.filter((fill) => fill.sameAsDinner)).toEqual([
    { date: "2026-03-02", childId: "runi", recipeId: recipes[0]!.id, sameAsDinner: true },
    { date: "2026-03-04", childId: "runi", recipeId: recipes[2]!.id, sameAsDinner: true },
  ]);
  expect(runi.filter((fill) => !fill.sameAsDinner).map((fill) => fill.date)).toEqual(["2026-03-03", "2026-03-05"]);
  expect(result.rules[0]).toMatchObject({ count: 3, met: true });
});

test("a dinner that would break a child's at-most rule is not given mashed", () => {
  const days = emptyWeek();
  const recipes = [dish("A cod and bacon", ["Fish", "Meat"])];
  const result = createWeek(input({ days, recipes, rules: [rule("runi", "at-least", 1, "Fish"), rule("runi", "at-most", 0, "Meat")] }));
  expect(result.fills.filter((fill) => fill.childId === "runi")).toEqual([]);
});

test("the note says how many days are still empty", () => {
  const recipes = [dish("Cod"), dish("Dal"), dish("Pie")];
  expect(createWeek(input({ recipes, children: [] })).note).toBe("Filled 3 dinners. 4 days still empty: add more recipes to fill them.");
});

test("says so when there is nothing to fill", () => {
  const days = emptyWeek([]);
  for (const day of days) day.dinner = dish("Planned");
  expect(createWeek(input({ days, recipes: [dish("Spare")], children: [] })).note).toBe("Nothing to fill. Every day is already planned.");
  expect(createWeek(input({ recipes: [], children: [] })).note).toBe("No recipe fits the empty days. Add more recipes or loosen the rules.");
});

test("plans a week from 200 recipes within 100 ms", () => {
  const types = ["Fish", "Meat", "Chicken", "Vegetarian", "Vegetables"];
  const ingredients: ShoppingIngredient[] = Array.from({ length: 40 }, (_, index) => ({
    id: `i${index}`,
    name: `Thing ${index}`,
    shopSection: "Other",
    packAmount: 500,
    packUnit: "g",
    alwaysAtHome: false,
  }));
  const recipes = Array.from({ length: 200 }, (_, index) =>
    dish(`Recipe ${index}`, [types[index % 5]!], {
      tags: index % 4 === 0 ? ["for Runi"] : index % 3 === 0 ? ["freezable"] : [],
      lastMadeOn: index % 7 === 0 ? "2026-02-25" : null,
      lines: Array.from({ length: 8 }, (_, line) => ({ amount: 100 + line * 30, unit: "g" as const, ingredient: ingredients[(index * 3 + line) % 40]! })),
    }),
  );
  const rules = [rule(null, "at-least", 1, "Fish"), rule(null, "at-least", 1, "Freezable"), rule("runi", "at-least", 2, "Fish"), rule("runi", "at-most", 1, "Meat"), rule("runi", "at-least", 5, "Vegetables")];
  const run = () => createWeek(input({ recipes, rules }));
  expect(run().fills).toHaveLength(14);
  const times: number[] = [];
  for (let round = 0; round < 7; round++) {
    const start = performance.now();
    run();
    times.push(performance.now() - start);
  }
  // The median, so one slow moment on a busy machine does not fail it. About 11 ms on a laptop.
  const median = times.sort((a, b) => a - b)[3]!;
  console.log(`createWeek: median ${median.toFixed(1)} ms over 7 runs`);
  expect(median).toBeLessThanOrEqual(100);
});

const line = (name: string): PlannerRecipe["lines"][number] => ({
  amount: 1,
  unit: "pcs",
  ingredient: { id: name, name, shopSection: "Other", packAmount: null, packUnit: null, alwaysAtHome: false },
});

test("a child never gets a dish with something they shouldn't have yet, not even as 'same as dinner'", () => {
  const honeyPorridge = forRuni("Honey porridge", ["Vegetarian"], { lines: [line("Honning")] });
  const plainPorridge = forRuni("Plain porridge", ["Vegetarian"], { lines: [line("Havregryn")] });
  const tunaPasta = dish("Tuna pasta", ["Fish"], { lines: [line("Tun")] });
  const days = emptyWeek();
  days[0]!.dinner = tunaPasta;
  const { fills } = createWeek(input({ days, recipes: [honeyPorridge, plainPorridge, tunaPasta], rules: [rule("runi", "at-least", 2, "Fish"), rule("runi", "at-least", 2, "Vegetarian")] }));
  const forRuniFills = fills.filter((fill) => fill.childId === "runi");
  expect(forRuniFills.map((fill) => fill.recipeId)).not.toContain(honeyPorridge.id);
  expect(forRuniFills.filter((fill) => fill.sameAsDinner)).toEqual([]);
  expect(forRuniFills.map((fill) => fill.recipeId)).toContain(plainPorridge.id);
});
