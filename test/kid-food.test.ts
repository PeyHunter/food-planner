import { expect, test } from "vitest";
import { hasWords, kidFoodRules, kidFoodWarnings, matchesRule } from "../src/shared/kid-food.ts";

const rule = (id: string) => kidFoodRules.find((entry) => entry.id === id)!;
const ids = (lines: { ingredient: string; note?: string }[], age: number | null) => kidFoodWarnings(lines, age).map((warning) => warning.ruleId);

test("honey is never for a baby under 1, in English or Danish, but honeydew melon is fine", () => {
  for (const name of ["Honey", "honning", "Flydende honning", "Honningsennep", "raw honey"]) expect(matchesRule(rule("honey"), name)).toBe(true);
  for (const name of ["Honningmelon", "Honeydew melon"]) expect(matchesRule(rule("honey"), name)).toBe(false);
  expect(ids([{ ingredient: "Honning" }], 11)).toEqual(["honey"]);
  expect(ids([{ ingredient: "Honning" }], 12)).toEqual([]);
});

test("tuna and big predatory fish under 3; tunge and salmon are fine", () => {
  for (const name of ["Tun i vand", "tuna steak", "Sværdfisk", "Gedde", "Tunsalat"]) expect(matchesRule(rule("predatory-fish"), name)).toBe(true);
  for (const name of ["Tunge", "Laks", "Torsk", "Salmon"]) expect(matchesRule(rule("predatory-fish"), name)).toBe(false);
  expect(kidFoodWarnings([{ ingredient: "Tun" }], 30)[0]).toMatchObject({ level: "not-yet", source: "Fødevarestyrelsen" });
  expect(ids([{ ingredient: "Tun" }], 36)).toEqual([]);
});

test("whole nuts need a reminder, ground nuts, nut butter and nutmeg don't", () => {
  for (const name of ["Hasselnødder", "almonds", "Peanuts", "Valnødder", "Popcorn"]) expect(matchesRule(rule("whole-nuts"), name)).toBe(true);
  for (const name of ["Peanut butter", "Mandelmel", "Almond milk", "Muskatnød", "Nutmeg", "Coconut milk", "Kokosmælk"]) expect(matchesRule(rule("whole-nuts"), name)).toBe(false);
});

test("salt is left alone when the ingredient is unsalted", () => {
  expect(matchesRule(rule("salt"), "Salt")).toBe(true);
  expect(matchesRule(rule("salt"), "Hønsebouillon")).toBe(true);
  expect(matchesRule(rule("salt"), "Chicken stock")).toBe(true);
  expect(matchesRule(rule("salt"), "Bouillon")).toBe(true);
  expect(matchesRule(rule("salt"), "Usaltet smør")).toBe(false);
  expect(matchesRule(rule("salt"), "unsalted butter")).toBe(false);
});

test("eggs only count when the note says raw or runny", () => {
  expect(matchesRule(rule("raw-egg"), "Æg")).toBe(false);
  expect(matchesRule(rule("raw-egg"), "Æg", "blødkogt")).toBe(true);
  expect(matchesRule(rule("raw-egg"), "Egg yolks", "raw")).toBe(true);
});

test("rice drink is not-yet, plain rice is a careful reminder, rice paper is neither", () => {
  expect(ids([{ ingredient: "Risdrik" }], 20)).toEqual(["rice-drink"]);
  expect(ids([{ ingredient: "Jasminris" }], 20)).toEqual(["rice"]);
  expect(ids([{ ingredient: "Rispapir" }], 20)).toEqual([]);
});

test("a child with no birthday gets every warning, not-yet ones first, each naming its ingredients once", () => {
  const warnings = kidFoodWarnings([{ ingredient: "Salt" }, { ingredient: "Honning" }, { ingredient: "Havsalt" }, { ingredient: "Tun" }], null);
  expect(warnings.map((warning) => warning.ruleId)).toEqual(["honey", "predatory-fish", "salt"]);
  expect(warnings[2]!.ingredients).toEqual(["Salt", "Havsalt"]);
});

test("whole words only", () => {
  expect(hasWords("tun i vand", "tun")).toBe(true);
  expect(hasWords("tunge", "tun")).toBe(false);
  expect(hasWords("æble-ris", "ris")).toBe(true);
  expect(hasWords("rosiner", "ris")).toBe(false);
});
