import { expect, test } from "vitest";
import { guessShopSection } from "../src/shared/shop-section-guess.ts";

test.each([
  ["Potatoes", "Vegetables"],
  ["sweet potato", "Vegetables"],
  ["Onions", "Vegetables"],
  ["carrots", "Vegetables"],
  ["Leek", "Vegetables"],
  ["garlic cloves", "Vegetables"],
  ["Cherry tomatoes", "Vegetables"],
  ["Berries", "Vegetables"],
  ["Milk", "Dairy"],
  ["double cream", "Dairy"],
  ["Cheese", "Dairy"],
  ["butter", "Dairy"],
  ["Yoghurt", "Dairy"],
  ["Eggs", "Dairy"],
  ["Coconut milk", "Dry goods"],
  ["Salmon fillets", "Meat & fish"],
  ["Cod", "Meat & fish"],
  ["chicken thighs", "Meat & fish"],
  ["Beef mince", "Meat & fish"],
  ["Bacon", "Meat & fish"],
  ["Pasta", "Dry goods"],
  ["Rice", "Dry goods"],
  ["Flour", "Dry goods"],
  ["Red lentils", "Dry goods"],
  ["Tinned chickpeas", "Dry goods"],
  ["Tinned tomatoes", "Dry goods"],
  ["Chicken stock", "Dry goods"],
  ["Peas", "Frozen"],
  ["Frozen peas", "Frozen"],
  ["Fish fingers", "Frozen"],
  ["Saffron", "Other"],
  ["", "Other"],
])("%s goes to %s", (name, section) => {
  expect(guessShopSection(name)).toBe(section);
});
