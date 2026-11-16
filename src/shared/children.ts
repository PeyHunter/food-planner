import type { RecipeSummary } from "./recipes.ts";
import type { Child } from "./week.ts";

/** A child with their age on the asked day; ageMonths is null while the birthday isn't set. */
export type ChildView = Child & { ageMonths: number | null };
export type ChildRecipe = RecipeSummary & { ageFromMonths: number | null; ageToMonths: number | null };
export type ChildRecipes = {
  /** Her own recipes: tagged "for Runi", minus any whose age range doesn't hold her age today. */
  hers: ChildRecipe[];
  /** The other recipes whose age range holds her age today. Empty while the birthday isn't set. */
  fitsAge: ChildRecipe[];
};
/** sameAsDinnerByDefault is left as it is when not sent. */
export type ChildInput = { name: string; birthday: string | null; sameAsDinnerByDefault?: boolean };
