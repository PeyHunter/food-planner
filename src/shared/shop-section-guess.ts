import type { ShopSection } from "./recipes.ts";

/** Common groceries in the singular. Plurals and words like "red" or "tinned" in front are handled by the lookup. */
const sections: Record<Exclude<ShopSection, "Other">, string[]> = {
  Vegetables: [
    "potato", "sweet potato", "onion", "red onion", "spring onion", "shallot", "carrot", "leek", "garlic", "tomato",
    "cherry tomato", "cucumber", "pepper", "bell pepper", "chilli", "chili", "courgette", "zucchini", "aubergine",
    "eggplant", "broccoli", "cauliflower", "cabbage", "kale", "spinach", "lettuce", "salad", "rocket", "celery",
    "celeriac", "parsnip", "beetroot", "swede", "turnip", "pumpkin", "squash", "butternut squash", "mushroom",
    "corn", "sweetcorn", "green bean", "asparagus", "avocado", "ginger", "herb", "parsley", "coriander", "basil",
    "dill", "chive", "mint", "thyme", "rosemary", "lemon", "lime", "apple", "pear", "banana", "orange", "berry",
    "strawberry", "blueberry", "raspberry", "grape", "mango", "melon", "fruit", "vegetable",
  ],
  Dairy: [
    "milk", "cream", "double cream", "single cream", "sour cream", "creme fraiche", "crème fraîche", "cheese",
    "cheddar", "parmesan", "mozzarella", "feta", "halloumi", "ricotta", "cream cheese", "cottage cheese", "butter",
    "yoghurt", "yogurt", "greek yoghurt", "egg", "quark", "skyr",
  ],
  "Meat & fish": [
    "salmon", "cod", "haddock", "tuna", "trout", "mackerel", "prawn", "shrimp", "fish", "white fish", "chicken",
    "chicken breast", "chicken thigh", "turkey", "beef", "steak", "mince", "beef mince", "pork", "pork chop", "lamb",
    "bacon", "ham", "sausage", "chorizo", "meatball",
  ],
  "Dry goods": [
    "pasta", "spaghetti", "penne", "macaroni", "noodle", "rice", "risotto rice", "couscous", "bulgur", "quinoa",
    "oat", "porridge oat", "flour", "plain flour", "self-raising flour", "sugar", "brown sugar", "lentil",
    "red lentil", "chickpea", "bean", "kidney bean", "black bean", "baked bean", "tinned tomato", "chopped tomato",
    "passata", "tomato puree", "tomato paste", "coconut milk", "stock", "stock cube", "bread", "breadcrumb",
    "tortilla", "wrap", "cracker", "honey", "jam", "peanut butter", "nut", "almond", "seed", "raisin", "cereal",
    "baking powder", "yeast", "vinegar", "soy sauce", "spice", "cumin", "paprika", "curry powder", "cinnamon",
    "salt", "black pepper", "oil", "olive oil",
  ],
  Frozen: ["pea", "frozen pea", "frozen spinach", "frozen berry", "ice cream", "fish finger", "frozen vegetable"],
};

const byName = new Map<string, ShopSection>(
  Object.entries(sections).flatMap(([section, names]) => names.map((name): [string, ShopSection] => [name, section as ShopSection])),
);

/** "tomatoes" -> tomato, "berries" -> berry, "leeks" -> leek. Tries the word as it is too. */
function singulars(word: string) {
  const forms = [word];
  if (word.endsWith("ies")) forms.push(`${word.slice(0, -3)}y`);
  if (word.endsWith("es")) forms.push(word.slice(0, -2));
  if (word.endsWith("s")) forms.push(word.slice(0, -1));
  return forms;
}

function lookup(words: string[]) {
  const last = words.at(-1)!;
  for (const form of singulars(last)) {
    const section = byName.get([...words.slice(0, -1), form].join(" "));
    if (section) return section;
  }
  return undefined;
}

/**
 * A first guess at the shop section for a new ingredient. Tries the whole name, then without words in front
 * ("cherry tomatoes" -> tomato), then without words behind ("garlic cloves" -> garlic). Unknown names go to Other.
 */
export function guessShopSection(name: string): ShopSection {
  const words = name.toLowerCase().replace(/[^\p{L}\s-]/gu, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return "Other";
  for (let start = 0; start < words.length; start++) {
    const section = lookup(words.slice(start));
    if (section) return section;
  }
  for (let end = words.length - 1; end > 0; end--) {
    const section = lookup(words.slice(0, end));
    if (section) return section;
  }
  return "Other";
}
