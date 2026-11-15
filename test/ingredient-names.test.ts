import { expect, test } from "vitest";
import { nameForms, sameIngredient } from "../src/shared/ingredient-names.ts";

test("singular and plural spellings count as the same ingredient", () => {
  expect(sameIngredient("potatoes", "Potato")).toBe(true);
  expect(sameIngredient("Potato", "potatoes")).toBe(true);
  expect(sameIngredient("carrots", "carrot")).toBe(true);
  expect(sameIngredient("berries", "berry")).toBe(true);
  expect(sameIngredient("cherry", "Cherries")).toBe(true);
  expect(sameIngredient("Bay leaves", "bay leaf")).toBe(true);
  expect(sameIngredient("spring onion", "Spring onions")).toBe(true);
  expect(sameIngredient("cheeses", "cheese")).toBe(true);
});

test("different ingredients stay different", () => {
  expect(sameIngredient("peas", "pear")).toBe(false);
  expect(sameIngredient("rice", "rise")).toBe(false);
  expect(sameIngredient("sweet potato", "potato")).toBe(false);
  expect(nameForms("grass")).not.toContain("gras");
});
