import type { RecipeSummary } from "./recipes.ts";
import type { RuleStatus } from "./rules.ts";
import type { Suggestion } from "./rule-swaps.ts";

export type Child = { id: string; name: string; birthday: string | null };
export type ChildDayKind = "empty" | "same-as-dinner" | "recipe";
export type ChildDay = { childId: string; kind: ChildDayKind; recipe: RecipeSummary | null };
export type WeekDay = {
  date: string;
  people: number;
  dinner: RecipeSummary | null;
  /** Each child eating "Same as dinner, mashed" adds half a portion. */
  extraPortions: number;
  children: ChildDay[];
};
export type WeekRule = RuleStatus & { sentence: string };
export type WeekView = {
  monday: string;
  days: WeekDay[];
  children: Child[];
  rules: WeekRule[];
  suggestions: Suggestion[];
  /** Recipes meant for a child: tag "for Runi" or an age range. */
  childRecipes: RecipeSummary[];
};

export const childRecipeTag = "for Runi";
export const defaultPeople = 2;
export const maxPeople = 50;
export const sameAsDinnerPortion = 0.5;

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const utc = (date: string) => new Date(`${date}T00:00:00Z`);

export const isDate = (value: string) => isoDate.test(value) && !Number.isNaN(utc(value).getTime()) && utc(value).toISOString().startsWith(value);

export const addDays = (date: string, count: number) => {
  const next = utc(date);
  next.setUTCDate(next.getUTCDate() + count);
  return next.toISOString().slice(0, 10);
};

export const mondayOf = (date: string) => addDays(date, -((utc(date).getUTCDay() + 6) % 7));

export const weekDates = (monday: string) => Array.from({ length: 7 }, (_, index) => addDays(monday, index));

export const weekdayName = (date: string) => utc(date).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
