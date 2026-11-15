import type { Unit } from "./units.ts";

export const mainTypes = ["Fish", "Meat", "Chicken", "Vegetarian", "Vegetables"] as const;
export type MainType = (typeof mainTypes)[number];

export const builtInTags = ["freezable", "kid-friendly", "for Runi"] as const;

/** In the order the shop walk goes. */
export const shopSections = ["Vegetables", "Dairy", "Meat & fish", "Dry goods", "Frozen", "Other"] as const;
export type ShopSection = (typeof shopSections)[number];

export type Photo = { id: string; url: string; role: "main" | "gallery"; cookId: string | null };

export type RecipeSummary = {
  id: string;
  title: string;
  feeds: number;
  types: MainType[];
  tags: string[];
  mainPhoto: Photo | null;
  lastMadeOn: string | null;
  timesMade: number;
};

export type RecipeLine = {
  amount: number | null;
  unit: Unit | null;
  ingredient: { id: string; name: string; shopSection: ShopSection };
  note: string;
};

export type Cook = { id: string; madeOn: string; by: string; photos: Photo[] };

export type Recipe = RecipeSummary & {
  ageFromMonths: number | null;
  ageToMonths: number | null;
  lines: RecipeLine[];
  steps: string[];
  photos: Photo[];
  cooks: Cook[];
  createdBy: string;
};

/** What the edit form sends. Ingredients go by name: a new name adds it to the kitchen's list. */
export type RecipeInput = {
  title: string;
  feeds: number;
  types: MainType[];
  tags: string[];
  ageFromMonths: number | null;
  ageToMonths: number | null;
  lines: { amount: number | null; unit: Unit | null; ingredient: string; note: string }[];
  steps: string[];
};

export type IngredientSuggestion = { id: string; name: string; shopSection: ShopSection };

/** What a share link shows: the recipe without who made it or when it was cooked. Photo urls go through the link. */
export type SharedRecipe = Pick<Recipe, "title" | "feeds" | "types" | "tags" | "mainPhoto" | "photos" | "lines" | "steps">;

/** The recipe's share link, or null while sharing is off. */
export type ShareLink = { url: string | null };

/** An ingredient with the settings the shopping list uses. */
export type Ingredient = IngredientSuggestion & { packAmount: number | null; packUnit: Unit | null; alwaysAtHome: boolean };
/** What the Ingredients screen sends to PUT /api/ingredients/:id. */
export type IngredientSettings = Omit<Ingredient, "id" | "name">;
