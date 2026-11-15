import { describe, expect, test } from "vitest";
import type { ShopSection } from "../src/shared/recipes.ts";
import { buildShoppingList, restOfWeek, type ShoppingDay, type ShoppingIngredient, type ShoppingRecipe } from "../src/shared/shopping.ts";
import type { Unit } from "../src/shared/units.ts";

const ingredient = (name: string, shopSection: ShopSection = "Vegetables", extra: Partial<ShoppingIngredient> = {}): ShoppingIngredient => ({
  id: `id-${name}`,
  name,
  shopSection,
  packAmount: null,
  packUnit: null,
  alwaysAtHome: false,
  ...extra,
});
const carrot = ingredient("Carrots");
const onion = ingredient("Onion");
const milk = ingredient("Milk", "Dairy");
const salt = ingredient("Salt", "Dry goods", { alwaysAtHome: true });

const recipe = (title: string, feeds: number, lines: [number | null, Unit | null, ShoppingIngredient][]): ShoppingRecipe => ({
  title,
  feeds,
  lines: lines.map(([amount, unit, ingredient]) => ({ amount, unit, ingredient })),
});
const day = (date: string, dinner: ShoppingRecipe | null, extra: Partial<ShoppingDay> = {}): ShoppingDay => ({ date, people: 2, sameAsDinner: 0, dinner, childMeals: [], ...extra });

const lines = (days: ShoppingDay[]) => buildShoppingList(days).flatMap((section) => section.lines);
const line = (days: ShoppingDay[], name: string) => lines(days).find((one) => one.ingredient.name === name)!;

describe("scaling", () => {
  test("scales a dinner from the recipe's feeds to the day's people", () => {
    const soup = recipe("Soup", 4, [[400, "g", carrot]]);
    expect(line([day("2026-03-02", soup, { people: 2 })], "Carrots")).toMatchObject({ amount: 200, unit: "g" });
    expect(line([day("2026-03-02", soup, { people: 5 })], "Carrots")).toMatchObject({ amount: 500, unit: "g" });
  });

  test("a child eating the same as dinner adds half a person", () => {
    const soup = recipe("Soup", 2, [[200, "g", carrot]]);
    expect(line([day("2026-03-02", soup, { sameAsDinner: 1 })], "Carrots").amount).toBe(250);
    expect(line([day("2026-03-02", soup, { sameAsDinner: 2 })], "Carrots").amount).toBe(300);
  });

  test("a child recipe adds one small portion: half a person of its feeds", () => {
    const mash = recipe("Cod mash", 2, [[200, "g", carrot]]);
    const view = line([day("2026-03-02", null, { childMeals: [{ childName: "Runi Lee", recipe: mash }] })], "Carrots");
    expect(view).toMatchObject({ amount: 50, unit: "g", meals: ["Mon: Cod mash for Runi Lee"] });
  });

  test("pieces round up to whole after adding, not before", () => {
    // ¾ onion on each of two days is 1½ onions, which is 2.
    const stew = recipe("Stew", 4, [[1.5, "pcs", onion]]);
    expect(line([day("2026-03-02", stew), day("2026-03-03", stew)], "Onion")).toMatchObject({ amount: 2, unit: "pcs" });
    expect(line([day("2026-03-02", stew)], "Onion").amount).toBe(1);
    // ⅜ onion on each of two days is ¾, which is 1, not 1 + 1.
    const half = recipe("Half", 4, [[0.75, "pcs", onion]]);
    expect(line([day("2026-03-02", half), day("2026-03-03", half)], "Onion").amount).toBe(1);
  });

  test("g rounds up to a tidy step and spoons to a half", () => {
    const soup = recipe("Soup", 3, [
      [130, "g", carrot],
      [1, "tsp", ingredient("Cumin", "Dry goods")],
    ]);
    const list = lines([day("2026-03-02", soup)]);
    // 86.7 g goes up to 90 g; ⅔ tsp goes up to 1 tsp.
    expect(list.find((one) => one.ingredient.name === "Carrots")).toMatchObject({ amount: 90, unit: "g" });
    expect(list.find((one) => one.ingredient.name === "Cumin")).toMatchObject({ amount: 1, unit: "tsp" });
  });
});

describe("adding up", () => {
  test("adds the same ingredient across dinners after converting units", () => {
    const a = recipe("A", 2, [[0.5, "kg", carrot]]);
    const b = recipe("B", 2, [[300, "g", carrot]]);
    expect(line([day("2026-03-02", a), day("2026-03-03", b)], "Carrots")).toMatchObject({ amount: 800, unit: "g", meals: ["Mon: A", "Tue: B"] });
    const c = recipe("C", 2, [[900, "g", carrot]]);
    expect(line([day("2026-03-02", a), day("2026-03-03", c)], "Carrots")).toMatchObject({ amount: 1.4, unit: "kg" });
  });

  test("volume and spoons add up as volume", () => {
    const a = recipe("A", 2, [[2, "dl", milk]]);
    const b = recipe("B", 2, [[2, "tbsp", milk]]);
    expect(line([day("2026-03-02", a), day("2026-03-03", b)], "Milk")).toMatchObject({ amount: 250, unit: "ml" });
    const c = recipe("C", 2, [[1, "tsp", milk]]);
    expect(line([day("2026-03-02", b), day("2026-03-03", c)], "Milk")).toMatchObject({ amount: 2.5, unit: "tbsp" });
  });

  test("keeps a lone unit like dl or kg as written", () => {
    const a = recipe("A", 2, [[3, "dl", milk]]);
    expect(line([day("2026-03-02", a), day("2026-03-03", a)], "Milk")).toMatchObject({ amount: 6, unit: "dl" });
  });

  test("pieces never convert: 2 carrots and 200 g carrots are two lines", () => {
    const a = recipe("A", 2, [[2, "pcs", carrot]]);
    const b = recipe("B", 2, [[200, "g", carrot]]);
    const carrots = lines([day("2026-03-02", a), day("2026-03-03", b)]).filter((one) => one.ingredient.name === "Carrots");
    expect(carrots.map((one) => [one.amount, one.unit])).toEqual([
      [200, "g"],
      [2, "pcs"],
    ]);
    expect(new Set(carrots.map((one) => one.key)).size).toBe(2);
  });

  test("a line with no amount shows once, and folds into a measured line of the same ingredient", () => {
    const pepper = ingredient("Pepper", "Dry goods");
    const a = recipe("A", 2, [[null, null, pepper]]);
    const b = recipe("B", 2, [[1, "tsp", pepper]]);
    expect(line([day("2026-03-02", a), day("2026-03-03", a)], "Pepper")).toMatchObject({ amount: null, needsPackSize: false, meals: ["Mon: A", "Tue: A"] });
    const both = lines([day("2026-03-02", a), day("2026-03-03", b)]).filter((one) => one.ingredient.name === "Pepper");
    expect(both).toHaveLength(1);
    expect(both[0]).toMatchObject({ amount: 1, unit: "tsp", meals: ["Tue: B", "Mon: A"] });
  });

  test("the same dinner twice in one recipe line list is named once", () => {
    const a = recipe("A", 2, [
      [100, "g", carrot],
      [100, "g", carrot],
    ]);
    expect(line([day("2026-03-02", a)], "Carrots")).toMatchObject({ amount: 200, meals: ["Mon: A"] });
  });
});

describe("packs", () => {
  test("rounds up to whole packs and says what is left", () => {
    const bag = ingredient("Carrots", "Vegetables", { packAmount: 1, packUnit: "kg" });
    const a = recipe("A", 2, [[400, "g", bag]]);
    expect(line([day("2026-03-02", a)], "Carrots")).toMatchObject({ amount: 400, unit: "g", packs: 1, leftover: "600 g carrots left", needsPackSize: false });
    const b = recipe("B", 2, [[700, "g", bag]]);
    expect(line([day("2026-03-02", a), day("2026-03-03", b)], "Carrots")).toMatchObject({ amount: 1.1, unit: "kg", packs: 2, leftover: "900 g carrots left" });
  });

  test("an exact fit has no leftover", () => {
    const carton = ingredient("Milk", "Dairy", { packAmount: 1, packUnit: "l" });
    expect(line([day("2026-03-02", recipe("A", 2, [[10, "dl", carton]]))], "Milk")).toMatchObject({ packs: 1, leftover: null });
  });

  test("pieces in packs", () => {
    const eggs = ingredient("Eggs", "Dairy", { packAmount: 6, packUnit: "pcs" });
    expect(line([day("2026-03-02", recipe("A", 2, [[8, "pcs", eggs]]))], "Eggs")).toMatchObject({ packs: 2, leftover: "4 eggs left" });
  });

  test("a pack in another kind of unit is ignored", () => {
    const odd = ingredient("Leeks", "Vegetables", { packAmount: 3, packUnit: "pcs" });
    expect(line([day("2026-03-02", recipe("A", 2, [[300, "g", odd]]))], "Leeks")).toMatchObject({ amount: 300, packs: null, leftover: null, needsPackSize: false });
  });

  test("asks for a pack size only when there is an amount and no pack size", () => {
    expect(line([day("2026-03-02", recipe("A", 2, [[300, "g", carrot]]))], "Carrots").needsPackSize).toBe(true);
  });
});

describe("sections", () => {
  test("groups in the fixed shop order and hides always-at-home items", () => {
    const fish = ingredient("Salmon", "Meat & fish");
    const peas = ingredient("Peas", "Frozen");
    const rice = ingredient("Rice", "Dry goods");
    const foil = ingredient("Foil", "Other");
    const all = recipe("All", 2, [
      [1, "pcs", foil],
      [200, "g", peas],
      [100, "g", rice],
      [1, "tsp", salt],
      [300, "g", fish],
      [2, "dl", milk],
      [100, "g", carrot],
    ]);
    const sections = buildShoppingList([day("2026-03-02", all)]);
    expect(sections.map((section) => section.section)).toEqual(["Vegetables", "Dairy", "Meat & fish", "Dry goods", "Frozen", "Other"]);
    expect(sections.flatMap((section) => section.lines.map((one) => one.ingredient.name))).not.toContain("Salt");
  });

  test("names in a section are in a-z order", () => {
    const all = recipe("All", 2, [
      [1, "pcs", onion],
      [100, "g", carrot],
    ]);
    expect(buildShoppingList([day("2026-03-02", all)])[0]!.lines.map((one) => one.ingredient.name)).toEqual(["Carrots", "Onion"]);
  });

  test("no days or empty days make an empty list", () => {
    expect(buildShoppingList([])).toEqual([]);
    expect(buildShoppingList([day("2026-03-02", null)])).toEqual([]);
  });
});

test("the rest of the week runs from today through Sunday", () => {
  expect(restOfWeek("2026-03-04")).toEqual(["2026-03-04", "2026-03-05", "2026-03-06", "2026-03-07", "2026-03-08"]);
  expect(restOfWeek("2026-03-08")).toEqual(["2026-03-08"]);
  expect(restOfWeek("2026-03-02")).toHaveLength(7);
});

test("keys stay the same whichever days are picked, so ticks stick", () => {
  const a = recipe("A", 2, [[100, "g", carrot]]);
  const b = recipe("B", 2, [[1, "kg", carrot]]);
  expect(line([day("2026-03-02", a)], "Carrots").key).toBe(line([day("2026-03-03", b)], "Carrots").key);
});
