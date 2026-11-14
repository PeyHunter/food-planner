import { expect, test } from "vitest";
import { checkRules, ruleSentence, type ChildMeal, type Dish, type PlanDay, type Rule } from "../src/shared/rules.ts";
import { addDays, isDate, mondayOf, weekDates, weekdayName } from "../src/shared/week.ts";

const dish = (title: string, types: string[], tags: string[] = []): Dish => ({ id: title, title, types, tags });
const salmon = dish("Salmon", ["Fish"], ["freezable"]);
const surfAndTurf = dish("Surf and turf", ["Fish", "Meat"]);
const soup = dish("Carrot soup", ["Vegetables"]);

const week = (dinners: (Dish | null)[], runi: ChildMeal[] = []): PlanDay[] =>
  weekDates("2026-11-09").map((date, index) => ({
    date,
    dinner: dinners[index] ?? null,
    children: { runi: runi[index] ?? { kind: "empty" } },
  }));

const rule = (id: string, childId: string | null, op: Rule["op"], n: number, what: string): Rule => ({ id, childId, op, n, what });

test("an empty week meets at-most rules and misses at-least rules", () => {
  const status = checkRules([rule("fish", null, "at-least", 1, "Fish"), rule("meat", "runi", "at-most", 1, "Meat")], week([]));
  expect(status.map(({ id, count, met }) => ({ id, count, met }))).toEqual([
    { id: "fish", count: 0, met: false },
    { id: "meat", count: 0, met: true },
  ]);
});

test("a dish with several main types counts for each", () => {
  const status = checkRules([rule("fish", null, "at-least", 1, "Fish"), rule("meat", null, "at-most", 0, "Meat")], week([surfAndTurf]));
  expect(status.map((s) => [s.count, s.met])).toEqual([
    [1, true],
    [1, false],
  ]);
});

test("tags count too, without caring about capitals", () => {
  const [status] = checkRules([rule("freeze", null, "at-least", 1, "Freezable")], week([salmon]));
  expect(status).toMatchObject({ count: 1, met: true });
});

test("same as dinner counts the dinner's types for the child", () => {
  const status = checkRules(
    [rule("fish", "runi", "at-least", 2, "Fish"), rule("veg", "runi", "at-least", 1, "Vegetables")],
    week([salmon, salmon, null], [{ kind: "same-as-dinner" }, { kind: "recipe", dish: soup }, { kind: "same-as-dinner" }]),
  );
  expect(status.map((s) => [s.count, s.met])).toEqual([
    [1, false],
    [1, true],
  ]);
});

test("a child's rules only look at the child's meals", () => {
  const [status] = checkRules([rule("fish", "runi", "at-least", 1, "Fish")], week([salmon]));
  expect(status).toMatchObject({ count: 0, met: false });
});

test("rules read as plain sentences", () => {
  expect(ruleSentence({ op: "at-least", n: 2, what: "Fish" }, "Runi Lee")).toBe("Runi Lee: Fish at least 2 a week");
  expect(ruleSentence({ op: "at-most", n: 1, what: "Meat" }, "Adults")).toBe("Adults: Meat at most 1 a week");
});

test("week dates run Monday to Sunday", () => {
  expect(mondayOf("2026-11-15")).toBe("2026-11-09");
  expect(mondayOf("2026-11-09")).toBe("2026-11-09");
  expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
  expect(weekDates("2026-11-09").at(-1)).toBe("2026-11-15");
  expect(weekdayName("2026-11-10")).toBe("Tuesday");
  expect(isDate("2026-02-30")).toBe(false);
  expect(isDate("2026-02-28")).toBe(true);
});
