import type { KidFoodWarning } from "./kid-food.ts";
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
  /** The dinner is a portion from the freezer, so it adds nothing to the shopping list. */
  fromFreezer: boolean;
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
  /** Child id → recipe id → what that child shouldn't have yet (or only with care) in that recipe. Only recipes with warnings. */
  kidWarnings: Record<string, Record<string, KidFoodWarning[]>>;
  /** Dishes with portions in the freezer, for planning a night "from the freezer". */
  freezer: FreezerItem[];
};

export type FreezerItem = { recipe: RecipeSummary; count: number };

/** What Create week put in, so the phone can undo just that, and a short note on how the rules came out. */
export type CreatedWeek = { fills: { date: string; childId: string | null; recipeId: string; sameAsDinner?: true }[]; note: string };

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
