import { expect, test } from "vitest";
import { groceries, groceryOf } from "../src/shared/groceries.ts";
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
  expect(groceryOf("garlic powder")?.en[0]).not.toBe("garlic");
  expect(groceryOf("hvidløgspulver")?.en[0]).not.toBe("garlic");
  expect(groceryOf("frozen spinach")?.pack?.amount).not.toBe(100);
});
