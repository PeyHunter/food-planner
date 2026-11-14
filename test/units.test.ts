import { describe, expect, test } from "vitest";
import { canConvert, convert, formatAmount, isUnit, kindOf, roundUp, scale, units, type Unit } from "../src/shared/units.ts";

test("every unit has a kind", () => {
  expect(units.map((unit) => [unit, kindOf(unit)])).toEqual([
    ["g", "mass"],
    ["kg", "mass"],
    ["ml", "volume"],
    ["dl", "volume"],
    ["l", "volume"],
    ["tsp", "spoon"],
    ["tbsp", "spoon"],
    ["pcs", "pcs"],
  ]);
  expect(isUnit("dl")).toBe(true);
  expect(isUnit("cup")).toBe(false);
  expect(isUnit("toString")).toBe(false);
});

describe("convert", () => {
  test.each<[number, Unit, Unit, number]>([
    [1, "kg", "g", 1000],
    [250, "g", "kg", 0.25],
    [1, "l", "ml", 1000],
    [3, "dl", "ml", 300],
    [1, "l", "dl", 10],
    [1, "tbsp", "tsp", 3],
    [2, "tsp", "ml", 10],
    [1, "tbsp", "ml", 15],
    [1, "dl", "tbsp", 100 / 15],
    [4, "pcs", "pcs", 4],
  ])("%d %s is %d %s", (amount, from, to, expected) => {
    expect(convert(amount, from, to)).toBeCloseTo(expected, 9);
  });

  test.each<[Unit, Unit]>([
    ["g", "ml"],
    ["kg", "l"],
    ["tsp", "g"],
    ["pcs", "g"],
    ["ml", "pcs"],
  ])("%s never converts to %s", (from, to) => {
    expect(canConvert(from, to)).toBe(false);
    expect(() => convert(1, from, to)).toThrow();
  });
});

describe("roundUp", () => {
  test.each<[number, Unit, number]>([
    // pcs go up to a whole number
    [0.75, "pcs", 1],
    [1, "pcs", 1],
    [1.01, "pcs", 2],
    [4.5, "pcs", 5],
    // g and ml: step 5 below 100
    [1, "g", 5],
    [37, "g", 40],
    [40, "g", 40],
    [97.5, "ml", 100],
    // step 25 from 100 to below 1000
    [100, "g", 100],
    [101, "g", 125],
    [195, "g", 200],
    [375, "ml", 375],
    [990, "g", 1000],
    // step 50 from 1000
    [1000, "g", 1000],
    [1001, "ml", 1050],
    [1260, "g", 1300],
    // kg, dl and l round as the g or ml they hold
    [1.26, "kg", 1.3],
    [0.33, "kg", 0.35],
    [1.5, "dl", 1.5],
    [1.53, "dl", 1.75],
    [0.333, "l", 0.35],
    // tsp and tbsp go up to the next half
    [1, "tsp", 1],
    [1.2, "tsp", 1.5],
    [1.5, "tbsp", 1.5],
    [1.51, "tbsp", 2],
    [0.1, "tsp", 0.5],
    [0, "g", 0],
  ])("%d %s becomes %d", (amount, unit, expected) => {
    expect(roundUp(amount, unit)).toBe(expected);
  });

  test("float noise never adds a step", () => {
    expect(roundUp(0.1 * 3 * 1000, "g")).toBe(300);
    expect(roundUp(0.35 * 3, "kg")).toBe(1.05);
    expect(roundUp((2 * 6) / 4, "pcs")).toBe(3);
  });
});

describe("scale", () => {
  test("the recipe's own N keeps the amounts as written", () => {
    expect(scale(130, "g", 4, 4)).toBe(130);
    expect(scale(0.75, "pcs", 4, 4)).toBe(0.75);
  });

  test.each<[number, Unit, number, number, number]>([
    [3, "pcs", 4, 6, 5],
    [130, "g", 4, 6, 200],
    [1, "tsp", 4, 6, 1.5],
    [1, "pcs", 4, 3, 1],
    [400, "g", 4, 1, 100],
    [500, "ml", 4, 5, 625],
    [1, "kg", 4, 5, 1.25],
    [2, "tbsp", 2, 5, 5],
  ])("%d %s for %d becomes %d for %d", (amount, unit, from, to, expected) => {
    expect(scale(amount, unit, from, to)).toBe(expected);
  });
});

test.each<[number, string]>([
  [2, "2"],
  [1.5, "1½"],
  [0.5, "½"],
  [1.25, "1¼"],
  [0.75, "¾"],
  [0.35, "0.35"],
  [1.3, "1.3"],
])("formatAmount(%d) is %s", (amount, expected) => {
  expect(formatAmount(amount)).toBe(expected);
});
