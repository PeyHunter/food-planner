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
export type ChildInput = { name: string; birthday: string | null };

/** A reference paper kept for the kids, e.g. the health visitor's food plan. */
export type KidDocument = { id: string; title: string; fileType: "pdf" | "jpeg" | "png" | "webp"; bytes: number; createdAt: string; by: string; url: string };
