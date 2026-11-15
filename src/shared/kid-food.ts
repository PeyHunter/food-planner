/**
 * Foods small children shouldn't have yet, or should only have prepared a certain way or in small amounts.
 *
 * Sources (checked November 2026):
 * - Fødevarestyrelsen, "Særligt om mad til børn i daginstitutioner" (2023).
 * - Københavns Kommune, "Særlige hensyn til de mindste børn" (2025), built on Fødevarestyrelsen's and Sundhedsstyrelsen's advice.
 * - NHS, "Foods to avoid giving babies and young children", for what the Danish lists don't cover.
 * Where they differ, the Danish age is used and the message says so.
 *
 * These are reminders, not medical advice: the health visitor (sundhedsplejerske) knows your child.
 */

/** "not-yet": don't give it before the age. "careful": fine if prepared a certain way or kept small. */
export type KidFoodLevel = "not-yet" | "careful";

export type KidFoodRule = {
  id: string;
  /** What the warning calls it. */
  name: string;
  /** Applies while the child is younger than this many months. */
  underMonths: number;
  level: KidFoodLevel;
  /** Why, and what to do instead, in plain words. */
  advice: string;
  source: string;
  /** Whole words or word starts in ingredient names (English and Danish), lower case. */
  words: string[];
  /** Ingredient names with any of these words are left alone, e.g. "unsalted" for salt. */
  except?: string[];
  /** Matches only when the ingredient's note says so too, e.g. raw. */
  noteWords?: string[];
};

const fvst = "Fødevarestyrelsen";
const kk = "Fødevarestyrelsen and Sundhedsstyrelsen (via Københavns Kommune)";
const nhs = "NHS";

export const kidFoodRules: KidFoodRule[] = [
  {
    id: "honey",
    name: "Honey",
    underMonths: 12,
    level: "not-yet",
    advice: "Not before 1 year, not even cooked or baked: honey can carry bacteria spores that cause infant botulism.",
    source: kk,
    words: ["honey", "honning", "honningsennep", "akaciehonning", "lynghonning", "blomsterhonning"],
  },
  {
    id: "predatory-fish",
    name: "Tuna and large predatory fish",
    underMonths: 36,
    level: "not-yet",
    advice: "Not before 3 years: tuna (fresh and tinned) and big predatory fish hold mercury, which can harm the developing brain. Salmon, cod, plaice, herring and mackerel are good choices.",
    source: fvst,
    words: ["tuna", "tun", "tunfisk", "tunbøf", "tunbøffer", "tunsalat", "shark", "haj", "sildehaj", "swordfish", "sværdfisk", "marlin", "pike", "gedde", "perch", "aborre", "pikeperch", "sandart", "halibut", "helleflynder", "ray", "rokke", "escolar", "oliefisk"],
    except: ["tuna-free"],
  },
  {
    id: "whole-nuts",
    name: "Whole nuts, peanuts and seeds",
    underMonths: 36,
    level: "careful",
    advice: "Until about 3 years, only finely chopped, ground or as smooth butter: whole nuts and hard seeds are easy to choke on. (The NHS says whole nuts not before 5.)",
    source: fvst,
    words: ["nut", "nuts", "nød", "nødder", "peanut", "peanuts", "jordnød", "jordnødder", "almond", "almonds", "mandel", "mandler", "hazelnut", "hazelnuts", "hasselnød", "hasselnødder", "walnut", "walnuts", "valnød", "valnødder", "cashew", "cashews", "cashewnød", "cashewnødder", "pistachio", "pistachios", "pistacie", "pistacier", "pistacienødder", "pecan", "pecans", "pekannød", "pekannødder", "paranød", "paranødder", "brazil nut", "macadamia", "pine nut", "pinjekerne", "pinjekerner", "kerner", "popcorn"],
    // Ground nuts, nut butter, flour and nut drinks are the safe forms.
    except: ["nutmeg", "muskatnød", "nutritional", "coconut", "kokos", "kokosnød", "butter", "smør", "mel", "flour", "paste", "mælk", "milk", "drik", "drink"],
  },
  {
    id: "grapes",
    name: "Grapes",
    underMonths: 36,
    level: "careful",
    advice: "Until about 3 years, cut grapes lengthways into small pieces (and take out the seeds under 1 year): whole grapes are easy to choke on.",
    source: kk,
    words: ["grape", "grapes", "vindrue", "vindruer", "drue", "druer"],
    except: ["grapefruit"],
  },
  {
    id: "rice-drink",
    name: "Rice drink and rice cakes",
    underMonths: 36,
    level: "not-yet",
    advice: "Not before 3 years: rice drink and rice cakes can hold a lot of inorganic arsenic. (The NHS says no rice drink before 5.)",
    source: kk,
    words: ["rice drink", "rice milk", "risdrik", "rismælk", "rice cake", "rice cakes", "riskiks"],
  },
  {
    id: "rice",
    name: "Rice",
    underMonths: 36,
    level: "careful",
    advice: "Fine now and then: rice can hold arsenic, so the Danish advice for small children is rice about every other week, not every day.",
    source: kk,
    words: ["rice", "ris", "risotto", "jasminris", "basmatiris", "grødris", "risengrød"],
    except: ["rice drink", "rice milk", "risdrik", "rismælk", "rice cake", "riskiks", "rice paper", "rispapir", "rice vinegar", "riseddike"],
  },
  {
    id: "salt",
    name: "Salt and stock cubes",
    underMonths: 12,
    level: "careful",
    advice: "Under 1 year, leave the salt out of the child's portion and skip stock cubes, soy sauce and gravy: a baby's kidneys can't handle much salt. Season the grown-ups' food after taking the baby's out.",
    source: nhs,
    words: ["salt", "sea salt", "havsalt", "flake salt", "flagesalt", "stock", "stock cube", "stock cubes", "bouillon", "bouillonterning", "bouillonterninger", "hønsebouillon", "kyllingebouillon", "oksebouillon", "grøntsagsbouillon", "fiskebouillon", "fond", "hønsefond", "kalvefond", "oksefond", "fiskefond", "grøntsagsfond", "soy sauce", "soja", "sojasauce", "fish sauce", "fiskesauce", "gravy"],
    except: ["unsalted", "usaltet", "saltless", "low-salt"],
  },
  {
    id: "soy-drink",
    name: "Soy drink",
    underMonths: 24,
    level: "careful",
    advice: "Not as a drink before 2 years; from 1 year a little in cooking is fine.",
    source: kk,
    words: ["soy milk", "soya milk", "soy drink", "sojamælk", "sojadrik"],
  },
  {
    id: "high-protein-dairy",
    name: "Skyr, quark, ymer, cottage cheese and Greek yoghurt",
    underMonths: 24,
    level: "careful",
    advice: "Before 2 years, not as the main part of a meal (too much protein for small kidneys); a little in a sauce or dressing is fine. Plain yoghurt or A38 are better.",
    source: kk,
    words: ["skyr", "quark", "kvark", "ymer", "cottage cheese", "hytteost", "greek yoghurt", "greek yogurt", "græsk yoghurt"],
  },
  {
    id: "raisins",
    name: "Raisins",
    underMonths: 36,
    level: "careful",
    advice: "At most 50 g raisins a week in all for children under 3: raisins can hold mould toxins. Remember any raisins at home or in daycare.",
    source: fvst,
    words: ["raisin", "raisins", "rosin", "rosiner", "sultana", "sultanas", "sultanarosiner"],
  },
  {
    id: "cinnamon",
    name: "Cinnamon",
    underMonths: 36,
    level: "careful",
    advice: "Keep it small, e.g. a little cinnamon sugar on porridge: cinnamon contains coumarin, which is harmful in larger amounts.",
    source: fvst,
    words: ["cinnamon", "kanel", "kanelsukker", "kanelstang", "kanelstænger", "stødt kanel"],
  },
  {
    id: "flax-sunflower",
    name: "Flaxseed and sunflower seeds",
    underMonths: 36,
    level: "careful",
    advice: "Fine in small amounts: they hold cadmium, a heavy metal.",
    source: kk,
    words: ["flaxseed", "flax seed", "linseed", "hørfrø", "sunflower seed", "sunflower seeds", "solsikkekerne", "solsikkekerner"],
    except: ["oil", "olie"],
  },
  {
    id: "nitrate-veg",
    name: "Spinach, beetroot, fennel and celery",
    underMonths: 12,
    level: "careful",
    advice: "For the smallest, keep these to a little and vary the vegetables over the week: they hold a lot of nitrate. Don't keep leftovers with chopped fresh herbs on top.",
    source: kk,
    words: ["spinach", "spinat", "beetroot", "beet", "rødbede", "rødbeder", "fennel", "fennikel", "celery", "selleri", "bladselleri", "celeriac", "knoldselleri"],
    except: ["seed", "frø"],
  },
  {
    id: "soft-cheese",
    name: "Soft mould cheese and unpasteurised cheese",
    underMonths: 60,
    level: "careful",
    advice: "Brie, camembert, blue cheese and unpasteurised cheese only when cooked until piping hot: otherwise they can carry listeria. Pasteurised hard cheese is fine.",
    source: nhs,
    words: ["brie", "camembert", "blue cheese", "blåskimmelost", "roquefort", "gorgonzola", "danablu", "stilton", "unpasteurised", "upasteuriseret", "raw milk", "råmælk"],
  },
  {
    id: "raw-egg",
    name: "Raw or runny egg",
    underMonths: 12,
    level: "careful",
    advice: "Cook eggs until white and yolk are firm for babies, and skip raw egg in homemade mayonnaise, mousse or ice cream.",
    source: nhs,
    words: ["egg", "eggs", "æg", "æggeblomme", "æggeblommer", "egg yolk", "egg yolks", "mayonnaise", "mayo"],
    noteWords: ["raw", "rå", "runny", "blødkogt", "soft-boiled", "lightly cooked", "homemade mayonnaise"],
  },
  {
    id: "raw-shellfish",
    name: "Raw shellfish",
    underMonths: 12,
    level: "careful",
    advice: "No raw or lightly cooked mussels, clams or oysters for babies: high risk of food poisoning. Cook them through.",
    source: nhs,
    words: ["oyster", "oysters", "østers", "mussel", "mussels", "musling", "muslinger", "clam", "clams"],
  },
];

export type KidFoodWarning = { ruleId: string; name: string; level: KidFoodLevel; advice: string; source: string; ingredients: string[] };

const letter = /[\p{L}\p{N}]/u;

/** Whether `phrase` is in `text` as whole words ("tun" in "tun i vand", not in "tunge"). */
export function hasWords(text: string, phrase: string) {
  let at = 0;
  while ((at = text.indexOf(phrase, at)) !== -1) {
    const before = text.charAt(at - 1);
    const after = text.charAt(at + phrase.length);
    if (!(before && letter.test(before)) && !(after && letter.test(after))) return true;
    at += 1;
  }
  return false;
}

export function matchesRule(rule: KidFoodRule, ingredient: string, note = "") {
  const name = ingredient.toLowerCase().trim();
  if (rule.except?.some((word) => hasWords(name, word))) return false;
  // Whole words only: Danish joins words, and "honningmelon" is a melon, so compounds are listed one by one.
  if (!rule.words.some((word) => hasWords(name, word))) return false;
  if (!rule.noteWords) return true;
  const said = `${name} ${note.toLowerCase()}`;
  return rule.noteWords.some((word) => hasWords(said, word));
}

/**
 * The warnings for one recipe and one child. A child with no birthday gets the warnings for the youngest age,
 * so a missing birthday never hides one. "not-yet" warnings come first.
 */
export function kidFoodWarnings(lines: { ingredient: string; note?: string }[], ageMonths: number | null): KidFoodWarning[] {
  const warnings: KidFoodWarning[] = [];
  for (const rule of kidFoodRules) {
    if (ageMonths !== null && ageMonths >= rule.underMonths) continue;
    const found = [...new Set(lines.filter((line) => matchesRule(rule, line.ingredient, line.note)).map((line) => line.ingredient))];
    if (found.length) warnings.push({ ruleId: rule.id, name: rule.name, level: rule.level, advice: rule.advice, source: rule.source, ingredients: found });
  }
  return warnings.sort((a, b) => Number(a.level !== "not-yet") - Number(b.level !== "not-yet"));
}

/** "Honey" or "Honey, Tuna and large predatory fish": short enough for a day card. */
export const warningNames = (warnings: KidFoodWarning[]) => warnings.map((warning) => warning.name).join(", ");
