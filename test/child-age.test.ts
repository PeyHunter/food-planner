import { expect, test } from "vitest";
import { ageInWords, ageRangeLabel, fitsAge, monthsOld } from "../src/shared/child-age.ts";

test("months count whole months from the birthday", () => {
  expect(monthsOld("2026-04-10", "2026-04-10")).toBe(0);
  expect(monthsOld("2026-04-10", "2026-11-09")).toBe(6);
  expect(monthsOld("2026-04-10", "2026-11-10")).toBe(7);
  expect(monthsOld("2025-09-15", "2026-11-15")).toBe(14);
  expect(monthsOld("2024-11-15", "2026-11-15")).toBe(24);
});

test("a month-end birthday turns a month older on a shorter month's last day", () => {
  expect(monthsOld("2026-01-31", "2026-02-27")).toBe(0);
  expect(monthsOld("2026-01-31", "2026-02-28")).toBe(1);
  expect(monthsOld("2026-01-31", "2026-03-30")).toBe(1);
  expect(monthsOld("2026-01-31", "2026-03-31")).toBe(2);
  expect(monthsOld("2023-12-31", "2024-02-29")).toBe(2);
});

test("a birthday after the day counts as 0 months", () => {
  expect(monthsOld("2026-12-01", "2026-11-15")).toBe(0);
});

test("age in plain words", () => {
  expect(ageInWords(0)).toBe("under 1 month");
  expect(ageInWords(1)).toBe("1 month");
  expect(ageInWords(7)).toBe("7 months");
  expect(ageInWords(12)).toBe("1 year");
  expect(ageInWords(14)).toBe("1 year 2 months");
  expect(ageInWords(24)).toBe("2 years");
  expect(ageInWords(25)).toBe("2 years 1 month");
});

test("a recipe fits ages inside its range, ends included", () => {
  const range = { ageFromMonths: 6, ageToMonths: 12 };
  expect([5, 6, 9, 12, 13].map((months) => fitsAge(range, months))).toEqual([false, true, true, true, false]);
  expect(fitsAge({ ageFromMonths: 8, ageToMonths: null }, 30)).toBe(true);
  expect(fitsAge({ ageFromMonths: null, ageToMonths: 10 }, 3)).toBe(true);
  expect(fitsAge({ ageFromMonths: null, ageToMonths: null }, 7)).toBe(false);
});

test("age range sticker text", () => {
  expect(ageRangeLabel({ ageFromMonths: 6, ageToMonths: 12 })).toBe("For 6–12 months");
  expect(ageRangeLabel({ ageFromMonths: 6, ageToMonths: null })).toBe("For 6+ months");
  expect(ageRangeLabel({ ageFromMonths: null, ageToMonths: 12 })).toBe("For up to 12 months");
  expect(ageRangeLabel({ ageFromMonths: null, ageToMonths: null })).toBeNull();
});
