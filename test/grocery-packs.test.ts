import { expect, test } from "vitest";
import { groceries, groceryOf } from "../src/shared/groceries.ts";
import { moreGroceries, moreNames } from "../src/shared/groceries-more.ts";
import { packNames } from "../src/shared/grocery-packs.ts";
import { kindOf } from "../src/shared/units.ts";

test("every pack names a grocery by its first English name", () => {
  const firsts = new Set(groceries.map((grocery) => grocery.en[0]));
  expect(packNames().filter((name) => !firsts.has(name))).toEqual([]);
});

test("piece weights only where a recipe count can meet a pack by weight, or grams a pack by the piece", () => {
  for (const grocery of groceries) {
    const pack = grocery.pack;
    if (!pack?.pieceGrams) continue;
    expect(["mass", "pcs"], grocery.en[0]).toContain(kindOf(pack.unit));
  }
});

test("whole names find their pack; guesses and frozen versions don't", () => {
  expect(groceryOf("Løg")?.pack).toMatchObject({ amount: 1, unit: "kg", pieceGrams: 160 });
  expect(groceryOf("onions")?.pack?.unit).toBe("kg");
  expect(groceryOf("Hakkede tomater")?.pack).toMatchObject({ amount: 400, unit: "g" });
  expect(groceryOf("fresh basil")?.en[0]).toBe("basil");
  // A tin of beans is 400 g net; dried beans are not that tin, and dried thyme is not a fresh bunch.
  expect(groceryOf("kikærter")?.pack).toMatchObject({ amount: 400, unit: "g" });
  expect(groceryOf("tørrede kikærter")?.pack).toMatchObject({ amount: 500, unit: "g" });
  expect(groceryOf("dried black beans")).toBeUndefined();
  expect(groceryOf("Hakkede tomat dåse")).toBeUndefined();
  expect(groceryOf("dåse kikærter")?.pack).toMatchObject({ amount: 400, unit: "g" });
  expect(groceryOf("tørret timian")?.pack).toMatchObject({ amount: 15, unit: "g" });
  expect(groceryOf("tørret rosmarin")).toBeUndefined();
  expect(groceryOf("garlic powder")?.en[0]).not.toBe("garlic");
  expect(groceryOf("hvidløgspulver")?.en[0]).not.toBe("garlic");
  expect(groceryOf("frozen spinach")?.pack?.amount).not.toBe(100);
});

test("extra names belong to a grocery in the main table", () => {
  const firsts = new Set(groceries.map((grocery) => grocery.en[0]));
  expect(Object.keys(moreNames).filter((name) => !firsts.has(name))).toEqual([]);
});

test("each new grocery's first names find it, not some other grocery", () => {
  const wrong = Object.values(moreGroceries)
    .flat()
    .flatMap(([en, da]) => [en.split(",")[0]!.trim(), da.split(",")[0]!.trim()])
    .filter((name) => groceryOf(name)?.en[0] !== groceries.find((grocery) => grocery.en.includes(name) || grocery.da.includes(name))?.en[0]);
  expect(wrong).toEqual([]);
});

test("survey names now find their pack", () => {
  expect(groceryOf("Ground cinnamon")?.pack?.amount).toBe(40);
  expect(groceryOf("Grøntsagsbouillon")?.pack).toMatchObject({ amount: 5, unit: "l" });
  expect(groceryOf("Medisterpølse")?.pack?.amount).toBe(500);
  expect(groceryOf("hakket grise- og kalvekød")?.pack?.amount).toBe(500);
  expect(groceryOf("Tarteletter")?.pack).toMatchObject({ amount: 10, unit: "pcs" });
});
