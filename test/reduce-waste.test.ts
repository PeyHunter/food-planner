import { expect, test } from "vitest";
import type { CreateWeekInput, PlannerDay, PlannerRecipe } from "../src/shared/create-week.ts";
import { nothingToSwap, reduceWaste } from "../src/shared/reduce-waste.ts";
import type { Rule } from "../src/shared/rules.ts";
import type { ShoppingIngredient } from "../src/shared/shopping.ts";
import { weekDates } from "../src/shared/week.ts";

const monday = "2026-03-02";
const thursday = "2026-03-05";
const runi = { id: "runi", name: "Runi Lee", ageMonths: 10 };

const item = (name: string, packAmount: number | null = 1000): ShoppingIngredient => ({
  id: name,
  name,
  shopSection: "Vegetables",
  packAmount,
  packUnit: packAmount === null ? null : "g",
  alwaysAtHome: false,
});
const carrots = item("Carrots");
const onions = item("Onions", 500);

let next = 0;
const dish = (title: string, lines: [ShoppingIngredient, number][] = [], extra: Partial<PlannerRecipe> = {}): PlannerRecipe => ({
  id: `r${++next}`,
  title,
  feeds: 2,
  types: [],
  tags: [],
  lines: lines.map(([ingredient, amount]) => ({ amount, unit: "g" as const, ingredient })),
  lastMadeOn: null,
  ageFromMonths: null,
  ageToMonths: null,
  ...extra,
});
const week = (dinners: (PlannerRecipe | null)[] = []): PlannerDay[] =>
  weekDates(monday).map((date, index) => ({ date, people: 2, dinner: dinners[index] ?? null, children: { runi: { kind: "empty" as const } } }));
const input = (extra: Partial<CreateWeekInput>): CreateWeekInput => ({ rules: [], days: week(), recipes: [], children: [runi], today: monday, ...extra });

test("fills an empty day with a recipe that uses the carrots left from Monday", () => {
  const cake = dish("Carrot cake", [[carrots, 400]]);
  const soup = dish("Carrot soup", [[carrots, 300]]);
  const pasta = dish("Plain pasta");
  const result = reduceWaste(input({ days: week([cake]), recipes: [cake, soup, pasta] }));
  expect(result.swap).toEqual({ date: "2026-03-03", recipeId: soup.id, replaces: null, text: "Add Carrot soup on Tuesday to use the 600 g carrots left from Monday." });
  expect(result.text).toBe(result.swap!.text);
});

test("swaps a planned dinner when no day is empty, and never a past one", () => {
  const cake = dish("Carrot cake", [[carrots, 400]]);
  const others = Array.from({ length: 6 }, (_, index) => dish(`Dish ${index}`));
  const soup = dish("Carrot soup", [[carrots, 300]]);
  const result = reduceWaste(input({ days: week([cake, ...others]), recipes: [cake, ...others, soup], today: thursday }));
  expect(result.swap).toEqual({ date: thursday, recipeId: soup.id, replaces: others[2]!.id, text: "Swap Thursday for Carrot soup to use the 600 g carrots left from Monday." });
});

test("picks the dish that uses up the most", () => {
  const cake = dish("Carrot cake", [[carrots, 400]]);
  const little = dish("A little carrot", [[carrots, 100]]);
  const lots = dish("Big carrot stew", [[carrots, 600]]);
  expect(reduceWaste(input({ days: week([cake]), recipes: [cake, little, lots] })).swap?.recipeId).toBe(lots.id);
});

test("skips a dish that would open a new pack and waste more in total", () => {
  const cake = dish("Carrot cake", [[carrots, 400]]);
  // Uses 100 g carrots but opens a 500 g bag of onions for 50 g.
  const salad = dish("Carrot salad", [[carrots, 100], [onions, 50]]);
  expect(reduceWaste(input({ days: week([cake]), recipes: [cake, salad] }))).toEqual({ swap: null, text: nothingToSwap });
});

test("never breaks a rule that is met now", () => {
  const cake = dish("Carrot cake", [[carrots, 400]]);
  const fish = Array.from({ length: 6 }, (_, index) => dish(`Fish ${index}`, [], { types: ["Fish"] }));
  const soup = dish("Carrot soup", [[carrots, 300]]);
  const rules: Rule[] = [{ id: "fish", childId: null, op: "at-least", n: 6, what: "Fish" }];
  expect(reduceWaste(input({ rules, days: week([cake, ...fish]), recipes: [cake, ...fish, soup] })).swap).toBeNull();
  const fishSoup = dish("Fish and carrot soup", [[carrots, 300]], { types: ["Fish"] });
  expect(reduceWaste(input({ rules, days: week([cake, ...fish]), recipes: [cake, ...fish, soup, fishSoup] })).swap?.recipeId).toBe(fishSoup.id);
});

test("leaves out child recipes, dishes already in the week, and leftovers with no pack size", () => {
  const cake = dish("Carrot cake", [[carrots, 400]]);
  const mash = dish("Carrot mash", [[carrots, 300]], { tags: ["for Runi"] });
  const days = week([cake]);
  days[3]!.children.runi = { kind: "recipe", dish: mash };
  expect(reduceWaste(input({ days, recipes: [cake, mash] })).swap).toBeNull();

  const loose = item("Leeks", null);
  const pie = dish("Leek pie", [[loose, 400]]);
  expect(reduceWaste(input({ days: week([pie]), recipes: [pie, dish("Leek soup", [[loose, 300]])] }))).toEqual({ swap: null, text: nothingToSwap });
});

test("says so when nothing is left over", () => {
  const exact = dish("Carrot bake", [[carrots, 1000]]);
  expect(reduceWaste(input({ days: week([exact]), recipes: [exact, dish("Carrot soup", [[carrots, 300]])] })).text).toBe(nothingToSwap);
});

test("gives the same answer every time", () => {
  const cake = dish("Carrot cake", [[carrots, 400]]);
  const recipes = [cake, dish("B carrot soup", [[carrots, 300]]), dish("A carrot soup", [[carrots, 300]])];
  const first = reduceWaste(input({ days: week([cake]), recipes }));
  expect(first.swap?.text).toBe("Add A carrot soup on Tuesday to use the 600 g carrots left from Monday.");
  expect(reduceWaste(input({ days: week([cake]), recipes: [...recipes].reverse() }))).toEqual(first);
});

test("suggests a swap from 200 recipes within 200 ms", () => {
  const things = Array.from({ length: 40 }, (_, index) => item(`Thing ${index}`, 500));
  const recipes = Array.from({ length: 200 }, (_, index) =>
    dish(`Recipe ${index}`, Array.from({ length: 8 }, (_, line) => [things[(index * 3 + line) % 40]!, 70 + line * 30] as [ShoppingIngredient, number]), {
      types: [["Fish", "Meat", "Vegetarian"][index % 3]!],
    }),
  );
  const rules: Rule[] = [
    { id: "fish", childId: null, op: "at-least", n: 1, what: "Fish" },
    { id: "meat", childId: null, op: "at-most", n: 2, what: "Meat" },
  ];
  const days = week([recipes[0]!, recipes[1]!, null, recipes[2]!]);
  const run = () => reduceWaste(input({ rules, days, recipes }));
  expect(run().swap).not.toBeNull();
  const times: number[] = [];
  for (let round = 0; round < 7; round++) {
    const start = performance.now();
    run();
    times.push(performance.now() - start);
  }
  const median = times.sort((a, b) => a - b)[3]!;
  console.log(`reduceWaste: median ${median.toFixed(1)} ms over 7 runs`);
  expect(median).toBeLessThanOrEqual(200);
});
