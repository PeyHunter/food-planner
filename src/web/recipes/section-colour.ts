import type { ShopSection } from "../../shared/recipes.ts";

/** Sticker colour class per shop section, the same on the Ingredients screen and in the recipe form. */
export const sectionColour: Record<ShopSection, string> = {
  Vegetables: "mint",
  Bread: "sun-soft",
  Dairy: "sky",
  "Meat & fish": "tomato",
  "Dry goods": "",
  "Tins & jars": "sky-soft",
  "Spices & sauces": "tomato-soft",
  Frozen: "lilac",
  Drinks: "mint-soft",
  Other: "white",
};
