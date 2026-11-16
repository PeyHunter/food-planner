import type { RecipeSummary } from "./recipes.ts";
import type { Child } from "./week.ts";

/** A child with their age on the asked day; ageMonths is null while the birthday isn't set. */
export type ChildView = Child & { ageMonths: number | null };
export type ChildRecipe = RecipeSummary & { ageFromMonths: number | null; ageToMonths: number | null };
export type ChildRecipes = {
  /** Recipes whose age range holds the child's age today. Empty while the birthday isn't set. */
  fitsNow: ChildRecipe[];
  /** Recipes tagged "for Runi" or with any age range. */
  all: ChildRecipe[];
};
/** sameAsDinnerByDefault is left as it is when not sent. */
export type ChildInput = { name: string; birthday: string | null; sameAsDinnerByDefault?: boolean };
