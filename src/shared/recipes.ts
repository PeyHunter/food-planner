import type { Unit } from "./units.ts";

export const mainTypes = ["Fish", "Meat", "Chicken", "Vegetarian", "Vegetables"] as const;
/** The five built-in types, or any category a kitchen makes for itself. */
export type MainType = (typeof mainTypes)[number] | (string & {});

export const isBuiltInType = (type: string) => (mainTypes as readonly string[]).includes(type);

/** Built-in types in their usual order, then custom categories alphabetically. Duplicates are dropped. */
export function sortCategories(types: string[]): string[] {
  const unique = [...new Set(types)];
  const builtIns = mainTypes.filter((type) => unique.includes(type));
  const custom = unique.filter((type) => !isBuiltInType(type)).sort((a, b) => a.localeCompare(b));
  return [...builtIns, ...custom];
}

export const builtInTags = ["freezable", "kid-friendly", "for Runi"] as const;
/** Tags that only make sense in a kitchen with children. */
export const kidTags: readonly string[] = ["kid-friendly", "for Runi"];

/** In the order the shop walk goes. Keys are stored in ingredients.shop_section, so never rename one; only add. */
export const shopSections = ["Vegetables", "Bread", "Dairy", "Meat & fish", "Dry goods", "Tins & jars", "Spices & sauces", "Frozen", "Drinks", "Other"] as const;
export type ShopSection = (typeof shopSections)[number];

export type Photo = { id: string; url: string; role: "main" | "gallery"; cookId: string | null };

export type RecipeSummary = {
  id: string;
  title: string;
  feeds: number;
  /** Total cooking time in minutes, or null when unknown. */
  minutes: number | null;
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
  /** A few lines about the dish, e.g. the intro from a recipe book. Empty if none. */
  description: string;
  ageFromMonths: number | null;
  ageToMonths: number | null;
  lines: RecipeLine[];
  steps: string[];
  photos: Photo[];
  cooks: Cook[];
  createdBy: string;
  /** The share link, or null while sharing is off. Comes with the recipe so the Share panel needs no extra call. */
  shareUrl: string | null;
};

/** What the edit form sends. Ingredients go by name: a new name adds it to the kitchen's list. */
export type RecipeInput = {
  title: string;
  /** Left out means empty. */
  description?: string;
  feeds: number;
  /** Left out means unknown. */
  minutes?: number | null;
  types: MainType[];
  tags: string[];
  ageFromMonths: number | null;
  ageToMonths: number | null;
  lines: { amount: number | null; unit: Unit | null; ingredient: string; note: string }[];
  steps: string[];
};

/** What POST /api/recipes/from-photo returns: a recipe to review in the edit form, and notes on what was left out.
 * dishPhoto: the picture of the finished dish cut out of the book page, as a JPEG data URL, or null when the pages have none. */
export type PhotoRecipeDraft = { recipe: RecipeInput; notes: string[]; dishPhoto: string | null };

export type IngredientSuggestion = { id: string; name: string; shopSection: ShopSection };

/** What a share link shows: the recipe without who made it or when it was cooked. Photo urls go through the link. */
export type SharedRecipe = Pick<Recipe, "title" | "description" | "feeds" | "minutes" | "types" | "tags" | "photos" | "lines" | "steps"> & {
  /** smallUrl: an 800 px wide copy for phones. */
  mainPhoto: (Photo & { smallUrl: string }) | null;
};

/** Share pages show the small copy of the main photo below this width (the content column is at most 34rem) and the full photo above it. */
export const sharePhotoMedia = { narrow: "(max-width: 35.98rem)", wide: "(min-width: 36rem)" } as const;

/** 45 → "45 min", 75 → "1 h 15 min", 120 → "2 h". */
export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** The recipe's share link, or null while sharing is off. */
export type ShareLink = { url: string | null };

/** An ingredient with the settings the shopping list uses. */
export type Ingredient = IngredientSuggestion & { packAmount: number | null; packUnit: Unit | null; alwaysAtHome: boolean };
/** A row on the Ingredients screen: `recipes` is how many recipes use it (only unused ones can be deleted). */
export type IngredientRow = Ingredient & { recipes: number };
/** What the Ingredients screen sends to PUT /api/ingredients/:id. */
export type IngredientSettings = Omit<Ingredient, "id" | "name">;
