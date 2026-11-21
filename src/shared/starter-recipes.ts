import type { Language } from "./profile.ts";
import type { MainType, RecipeInput } from "./recipes.ts";
import type { Unit } from "./units.ts";

// Fifteen everyday Danish family dinners a new kitchen starts with, in English and Danish.
// Ingredient names are shared constants so every recipe points at the same ingredient.

type Words = { en: string; da: string };
type Line = [amount: number | null, unit: Unit | null, ingredient: Words];
type StarterRecipe = {
  title: Words;
  description: Words;
  feeds: number;
  minutes: number;
  types: MainType[];
  tags: string[];
  lines: Line[];
  steps: { en: string[]; da: string[] };
};

const w = (en: string, da: string): Words => ({ en, da });
const mincePorkVeal = w("Minced pork and veal", "Hakket svine- og kalvekød");
const minceBeef = w("Minced beef", "Hakket oksekød");
const mincedPork = w("Minced pork", "Hakket svinekød");
const porkBelly = w("Pork belly slices", "Stegeflæsk i skiver");
const chickenBreast = w("Chicken breast", "Kyllingebryst");
const chickenThigh = w("Chicken thighs", "Kyllingeoverlår");
const salmon = w("Salmon fillet", "Laksefilet");
const cod = w("Cod fillet", "Torskefilet");
const fishMince = w("Fish mince", "Fiskefars");
const onion = w("Onion", "Løg");
const garlic = w("Garlic clove", "Fed hvidløg");
const carrot = w("Carrot", "Gulerod");
const potato = w("Potato", "Kartoffel");
const leek = w("Leek", "Porre");
const celeriac = w("Celeriac", "Knoldselleri");
const apple = w("Apple", "Æble");
const lemon = w("Lemon", "Citron");
const broccoli = w("Broccoli", "Broccoli");
const peas = w("Frozen peas", "Frosne ærter");
const spinach = w("Baby spinach", "Babyspinat");
const bellPepper = w("Bell pepper", "Peberfrugt");
const parsley = w("Parsley", "Persille");
const dill = w("Dill", "Dild");
const egg = w("Egg", "Æg");
const milk = w("Milk", "Mælk");
const cream = w("Whipping cream", "Piskefløde");
const cremeFraiche = w("Crème fraîche", "Creme fraiche");
const butter = w("Butter", "Smør");
const cheese = w("Grated cheese", "Revet ost");
const flour = w("Wheat flour", "Hvedemel");
const oats = w("Rolled oats", "Havregryn");
const rice = w("Rice", "Ris");
const pasta = w("Pasta", "Pasta");
const lasagneSheets = w("Lasagne sheets", "Lasagneplader");
const ryeBread = w("Rye bread", "Rugbrød");
const tartlets = w("Tartlet cases", "Tarteletter");
const asparagus = w("Canned asparagus", "Asparges på dåse");
const tortillas = w("Tortillas", "Tortillas");
const choppedTomatoes = w("Chopped tomatoes", "Hakkede tomater");
const tomatoPaste = w("Tomato paste", "Tomatpuré");
const coconutMilk = w("Coconut milk", "Kokosmælk");
const chickpeas = w("Chickpeas", "Kikærter");
const kidneyBeans = w("Kidney beans", "Kidneybønner");
const corn = w("Sweetcorn", "Majs");
const curry = w("Curry powder", "Karry");
const stock = w("Vegetable stock", "Grøntsagsbouillon");
const oil = w("Oil", "Olie");
const salt = w("Salt", "Salt");
const pepper = w("Pepper", "Peber");

export const starterRecipes: StarterRecipe[] = [
  {
    title: w("Frikadeller", "Frikadeller"),
    description: w("Danish meatballs, fried in butter. With potatoes and gravy or in rye bread the next day.", "Danske frikadeller stegt i smør. Med kartofler og sovs, eller på rugbrød dagen efter."),
    feeds: 4,
    minutes: 45,
    types: ["Meat"],
    tags: ["freezable", "kid-friendly"],
    lines: [[500, "g", mincePorkVeal], [1, "pcs", onion], [1, "pcs", egg], [1, "dl", milk], [40, "g", oats], [10, "g", salt], [null, null, pepper], [30, "g", butter], [1, "kg", potato]],
    steps: {
      en: ["Grate the onion and stir it into the mince with egg, milk, oats, salt and pepper. Rest 15 minutes.", "Boil the potatoes.", "Shape balls with a wet spoon and fry them in butter, about 6 minutes on each side."],
      da: ["Riv løget og rør det i farsen med æg, mælk, havregryn, salt og peber. Lad den hvile 15 minutter.", "Kog kartoflerne.", "Form frikadeller med en våd ske og steg dem i smør ca. 6 minutter på hver side."],
    },
  },
  {
    title: w("Oven-baked salmon with potatoes", "Ovnbagt laks med kartofler"),
    description: w("Salmon baked with lemon and dill, new potatoes and a quick cold sauce.", "Laks bagt med citron og dild, kartofler og en hurtig kold sauce."),
    feeds: 4,
    minutes: 35,
    types: ["Fish"],
    tags: ["kid-friendly"],
    lines: [[600, "g", salmon], [1, "kg", potato], [1, "pcs", lemon], [1, "pcs", dill], [2, "dl", cremeFraiche], [400, "g", broccoli], [null, null, salt], [null, null, pepper]],
    steps: {
      en: ["Boil the potatoes. Heat the oven to 200 °C.", "Put the salmon in a dish, season, add lemon slices and bake 15 minutes.", "Steam the broccoli. Stir chopped dill and a little lemon juice into the crème fraîche."],
      da: ["Kog kartoflerne. Tænd ovnen på 200 °C.", "Læg laksen i et fad, krydr den, læg citronskiver på og bag den i 15 minutter.", "Damp broccolien. Rør hakket dild og lidt citronsaft i cremefraichen."],
    },
  },
  {
    title: w("Chicken curry", "Kylling i karry"),
    description: w("Mild chicken curry with apple and cream, served with rice.", "Mild kylling i karry med æble og fløde, serveret med ris."),
    feeds: 4,
    minutes: 40,
    types: ["Chicken"],
    tags: ["kid-friendly"],
    lines: [[600, "g", chickenBreast], [1, "pcs", onion], [1, "pcs", apple], [2, "pcs", carrot], [15, "ml", curry], [2, "dl", cream], [2, "dl", stock], [300, "g", rice], [15, "g", butter], [null, null, salt]],
    steps: {
      en: ["Cook the rice.", "Cut the chicken into pieces and brown it in butter. Add chopped onion, apple, carrot and the curry for 2 minutes.", "Add stock and cream and simmer 15 minutes. Season with salt."],
      da: ["Kog risene.", "Skær kyllingen i stykker og brun den i smør. Tilsæt hakket løg, æble, gulerod og karry i 2 minutter.", "Hæld bouillon og fløde ved og lad det simre 15 minutter. Smag til med salt."],
    },
  },
  {
    title: w("Lasagne", "Lasagne"),
    description: w("Meat sauce, white sauce and cheese in layers. Makes good leftovers.", "Kødsauce, hvid sovs og ost i lag. Giver gode rester."),
    feeds: 4,
    minutes: 90,
    types: ["Meat"],
    tags: ["freezable", "kid-friendly"],
    lines: [[500, "g", minceBeef], [1, "pcs", onion], [2, "pcs", garlic], [2, "pcs", carrot], [800, "g", choppedTomatoes], [30, "g", tomatoPaste], [250, "g", lasagneSheets], [50, "g", butter], [50, "g", flour], [7, "dl", milk], [150, "g", cheese], [null, null, salt], [null, null, pepper]],
    steps: {
      en: ["Brown the mince with onion, garlic and grated carrot. Add tomatoes and paste and simmer 20 minutes.", "Melt the butter, stir in the flour, then whisk in the milk to a thick white sauce. Season.", "Layer meat sauce, sheets and white sauce three times. Top with cheese and bake 40 minutes at 200 °C."],
      da: ["Brun kødet med løg, hvidløg og revet gulerod. Tilsæt tomater og tomatpuré og lad det simre 20 minutter.", "Smelt smørret, rør melet i og pisk mælken i til en tyk hvid sovs. Smag til.", "Læg kødsauce, plader og hvid sovs i lag tre gange. Drys med ost og bag 40 minutter ved 200 °C."],
    },
  },
  {
    title: w("Meatballs in curry sauce", "Boller i karry"),
    description: w("Boiled pork meatballs in a mild curry sauce, with rice. A Danish classic.", "Kogte kødboller i mild karrysovs med ris. En dansk klassiker."),
    feeds: 4,
    minutes: 60,
    types: ["Meat"],
    tags: ["freezable", "kid-friendly"],
    lines: [[500, "g", mincedPork], [2, "pcs", onion], [1, "pcs", egg], [30, "g", flour], [1, "dl", milk], [10, "g", salt], [1, "l", stock], [15, "ml", curry], [40, "g", butter], [40, "g", flour], [1, "dl", cream], [300, "g", rice], [1, "pcs", leek]],
    steps: {
      en: ["Stir the mince with 1 grated onion, egg, flour, milk and salt. Cook spoonfuls in simmering stock for 8 minutes, then lift out.", "Cook the rice.", "Soften the other onion and the leek in butter with the curry, stir in the flour, then add 6 dl of the stock and the cream. Simmer 5 minutes and put the meatballs back."],
      da: ["Rør farsen med 1 revet løg, æg, mel, mælk og salt. Kog skefulde i simrende bouillon i 8 minutter og tag dem op.", "Kog risene.", "Svits det andet løg og porren i smør med karry, rør melet i og tilsæt 6 dl af bouillonen og fløden. Lad det simre 5 minutter og kom bollerne i igen."],
    },
  },
  {
    title: w("Fish cakes", "Fiskefrikadeller"),
    description: w("Fried fish cakes with potatoes, lemon and a cold dill sauce.", "Stegte fiskefrikadeller med kartofler, citron og en kold dildsauce."),
    feeds: 4,
    minutes: 40,
    types: ["Fish"],
    tags: ["kid-friendly"],
    lines: [[600, "g", fishMince], [1, "pcs", onion], [1, "pcs", carrot], [1, "pcs", egg], [1, "pcs", dill], [30, "g", butter], [1, "kg", potato], [2, "dl", cremeFraiche], [1, "pcs", lemon], [null, null, salt]],
    steps: {
      en: ["Boil the potatoes.", "Stir grated onion and carrot, egg and half the chopped dill into the fish mince.", "Fry spoonfuls in butter, about 4 minutes on each side. Stir the rest of the dill into the crème fraîche and serve with lemon."],
      da: ["Kog kartoflerne.", "Rør revet løg og gulerod, æg og halvdelen af den hakkede dild i fiskefarsen.", "Steg skefulde i smør ca. 4 minutter på hver side. Rør resten af dilden i cremefraichen og server med citron."],
    },
  },
  {
    title: w("Vegetable soup", "Grøntsagssuppe"),
    description: w("A warming soup of root vegetables and leek, with bread on the side.", "En varmende suppe med rodfrugter og porre og brød til."),
    feeds: 4,
    minutes: 40,
    types: ["Vegetarian", "Vegetables"],
    tags: ["freezable", "kid-friendly"],
    lines: [[1, "pcs", onion], [4, "pcs", carrot], [500, "g", potato], [300, "g", celeriac], [1, "pcs", leek], [400, "g", choppedTomatoes], [1, "l", stock], [15, "ml", oil], [null, null, parsley], [null, null, salt], [null, null, pepper]],
    steps: {
      en: ["Cut all the vegetables into small cubes.", "Soften the onion in oil, add the rest of the vegetables, tomatoes and stock.", "Simmer 25 minutes, season and top with parsley."],
      da: ["Skær alle grøntsagerne i små tern.", "Svits løget i olie, tilsæt resten af grøntsagerne, tomater og bouillon.", "Lad suppen simre 25 minutter, smag til og drys med persille."],
    },
  },
  {
    title: w("Pasta with meat sauce", "Pasta med kødsauce"),
    description: w("Everyday pasta with a tomato meat sauce and grated vegetables in it.", "Hverdagspasta med kødsauce og revne grøntsager i."),
    feeds: 4,
    minutes: 40,
    types: ["Meat"],
    tags: ["freezable", "kid-friendly"],
    lines: [[500, "g", minceBeef], [1, "pcs", onion], [2, "pcs", garlic], [2, "pcs", carrot], [800, "g", choppedTomatoes], [30, "g", tomatoPaste], [400, "g", pasta], [50, "g", cheese], [null, null, salt], [null, null, pepper]],
    steps: {
      en: ["Brown the mince with chopped onion and garlic.", "Add grated carrot, tomatoes and tomato paste and simmer 20 minutes. Season.", "Cook the pasta and serve with the sauce and cheese."],
      da: ["Brun kødet med hakket løg og hvidløg.", "Tilsæt revet gulerod, tomater og tomatpuré og lad det simre 20 minutter. Smag til.", "Kog pastaen og server med sauce og ost."],
    },
  },
  {
    title: w("Tartlets with chicken and asparagus", "Tarteletter med høns i asparges"),
    description: w("Crisp tartlet cases filled with chicken and asparagus in a creamy sauce.", "Sprøde tarteletter fyldt med kylling og asparges i cremet sovs."),
    feeds: 4,
    minutes: 50,
    types: ["Chicken"],
    tags: ["kid-friendly"],
    lines: [[500, "g", chickenBreast], [1, "l", stock], [400, "g", asparagus], [40, "g", butter], [40, "g", flour], [1, "dl", cream], [12, "pcs", tartlets], [null, null, parsley], [null, null, salt]],
    steps: {
      en: ["Simmer the chicken in the stock for 20 minutes. Lift it out and cut it into small pieces.", "Melt the butter, stir in the flour and whisk in 5 dl of the stock, the asparagus water and the cream. Simmer 5 minutes.", "Add chicken and asparagus. Warm the tartlets 5 minutes at 180 °C, fill them and top with parsley."],
      da: ["Kog kyllingen i bouillonen i 20 minutter. Tag den op og skær den i små stykker.", "Smelt smørret, rør melet i og pisk 5 dl af bouillonen, aspargesvandet og fløden i. Lad det simre 5 minutter.", "Kom kylling og asparges i. Lun tarteletterne 5 minutter ved 180 °C, fyld dem og drys med persille."],
    },
  },
  {
    title: w("Chickpea curry", "Kikærtecurry"),
    description: w("Creamy curry with chickpeas, tomato, coconut milk and spinach.", "Cremet curry med kikærter, tomat, kokosmælk og spinat."),
    feeds: 4,
    minutes: 35,
    types: ["Vegetarian", "Vegetables"],
    tags: ["freezable"],
    lines: [[1, "pcs", onion], [2, "pcs", garlic], [15, "ml", curry], [480, "g", chickpeas], [400, "g", choppedTomatoes], [400, "ml", coconutMilk], [100, "g", spinach], [300, "g", rice], [15, "ml", oil], [null, null, salt]],
    steps: {
      en: ["Cook the rice.", "Soften onion and garlic in oil with the curry. Add drained chickpeas, tomatoes and coconut milk.", "Simmer 15 minutes, stir in the spinach and season with salt."],
      da: ["Kog risene.", "Svits løg og hvidløg i olie med karry. Tilsæt afdryppede kikærter, tomater og kokosmælk.", "Lad det simre 15 minutter, rør spinaten i og smag til med salt."],
    },
  },
  {
    title: w("Baked cod with vegetables", "Ovnbagt torsk med grøntsager"),
    description: w("Cod baked on a bed of vegetables with butter and lemon.", "Torsk bagt på en bund af grøntsager med smør og citron."),
    feeds: 4,
    minutes: 35,
    types: ["Fish", "Vegetables"],
    tags: [],
    lines: [[600, "g", cod], [1, "pcs", leek], [3, "pcs", carrot], [200, "g", peas], [1, "pcs", lemon], [30, "g", butter], [800, "g", potato], [null, null, salt], [null, null, pepper]],
    steps: {
      en: ["Boil the potatoes. Heat the oven to 200 °C.", "Put sliced leek and carrot and the peas in a dish and lay the cod on top.", "Season, add knobs of butter and lemon slices, and bake 15 to 20 minutes."],
      da: ["Kog kartoflerne. Tænd ovnen på 200 °C.", "Læg porre og gulerod i skiver og ærterne i et fad, og læg torsken ovenpå.", "Krydr, læg smørklatter og citronskiver på, og bag i 15 til 20 minutter."],
    },
  },
  {
    title: w("Fried pork with parsley sauce", "Stegt flæsk med persillesovs"),
    description: w("Crisp fried pork belly with potatoes and parsley sauce. Denmark's national dish.", "Sprødt stegt flæsk med kartofler og persillesovs. Danmarks nationalret."),
    feeds: 4,
    minutes: 45,
    types: ["Meat"],
    tags: [],
    lines: [[800, "g", porkBelly], [1, "kg", potato], [40, "g", butter], [40, "g", flour], [5, "dl", milk], [null, null, parsley], [null, null, salt], [null, null, pepper]],
    steps: {
      en: ["Boil the potatoes.", "Fry the pork slices on a dry pan until crisp, about 15 minutes, turning often. Salt them.", "Melt the butter, stir in the flour, whisk in the milk and simmer 5 minutes. Stir in lots of chopped parsley and season."],
      da: ["Kog kartoflerne.", "Steg flæsket på en tør pande til det er sprødt, ca. 15 minutter, og vend det tit. Drys med salt.", "Smelt smørret, rør melet i, pisk mælken i og lad det simre 5 minutter. Rør masser af hakket persille i og smag til."],
    },
  },
  {
    title: w("Beef patties with soft onions", "Hakkebøf med bløde løg"),
    description: w("Pan-fried beef patties with slow-cooked onions, potatoes and gravy.", "Stegte hakkebøffer med bløde løg, kartofler og brun sovs."),
    feeds: 4,
    minutes: 35,
    types: ["Meat"],
    tags: ["kid-friendly"],
    lines: [[600, "g", minceBeef], [3, "pcs", onion], [30, "g", butter], [1, "kg", potato], [2, "dl", stock], [1, "dl", cream], [200, "g", peas], [null, null, salt], [null, null, pepper]],
    steps: {
      en: ["Boil the potatoes.", "Slice the onions and cook them slowly in half the butter until soft and golden. Set aside.", "Shape 4 patties, season and fry 3 to 4 minutes on each side. Add stock and cream to the pan for a quick gravy. Serve with onions and peas."],
      da: ["Kog kartoflerne.", "Skær løgene i skiver og steg dem langsomt i halvdelen af smørret til de er bløde og gyldne. Sæt dem til side.", "Form 4 bøffer, krydr dem og steg 3 til 4 minutter på hver side. Hæld bouillon og fløde på panden til en hurtig sovs. Server med løg og ærter."],
    },
  },
  {
    title: w("Chicken traybake with potatoes", "Kylling i fad med kartofler"),
    description: w("Chicken thighs roasted with potatoes and vegetables in one dish.", "Kyllingeoverlår bagt med kartofler og grøntsager i ét fad."),
    feeds: 4,
    minutes: 60,
    types: ["Chicken", "Vegetables"],
    tags: ["kid-friendly"],
    lines: [[800, "g", chickenThigh], [800, "g", potato], [3, "pcs", carrot], [1, "pcs", bellPepper], [1, "pcs", onion], [30, "ml", oil], [null, null, salt], [null, null, pepper]],
    steps: {
      en: ["Heat the oven to 200 °C.", "Cut potatoes, carrots, pepper and onion into chunks and toss them with oil, salt and pepper in a dish.", "Lay the chicken on top, season and bake 45 minutes until golden."],
      da: ["Tænd ovnen på 200 °C.", "Skær kartofler, gulerødder, peberfrugt og løg i stykker og vend dem med olie, salt og peber i et fad.", "Læg kyllingen ovenpå, krydr den og bag 45 minutter, til den er gylden."],
    },
  },
  {
    title: w("Bean tacos", "Vegetartacos med bønner"),
    description: w("Soft tacos with spiced beans, corn and vegetables. Everyone fills their own.", "Bløde tacos med krydrede bønner, majs og grøntsager. Alle fylder deres egen."),
    feeds: 4,
    minutes: 30,
    types: ["Vegetarian"],
    tags: ["kid-friendly"],
    lines: [[8, "pcs", tortillas], [480, "g", kidneyBeans], [300, "g", corn], [1, "pcs", onion], [1, "pcs", bellPepper], [400, "g", choppedTomatoes], [100, "g", cheese], [2, "dl", cremeFraiche], [15, "ml", oil], [null, null, salt]],
    steps: {
      en: ["Soften chopped onion and pepper in oil.", "Add drained beans, corn and tomatoes and simmer 10 minutes. Season.", "Warm the tortillas and serve with the beans, cheese and crème fraîche."],
      da: ["Svits hakket løg og peberfrugt i olie.", "Tilsæt afdryppede bønner, majs og tomater og lad det simre 10 minutter. Smag til.", "Lun tortillaerne og server med bønner, ost og cremefraiche."],
    },
  },
];

/** The starter recipes as the edit form would send them, in one language. Kid tags are left out for a kitchen without kids. */
export function starterRecipeInputs(language: Language, kids: boolean): RecipeInput[] {
  return starterRecipes.map((recipe) => ({
    title: recipe.title[language],
    description: recipe.description[language],
    feeds: recipe.feeds,
    minutes: recipe.minutes,
    types: recipe.types,
    tags: kids ? recipe.tags : recipe.tags.filter((tag) => tag !== "kid-friendly"),
    ageFromMonths: null,
    ageToMonths: null,
    lines: recipe.lines.map(([amount, unit, ingredient]) => ({ amount, unit, ingredient: ingredient[language], note: "" })),
    steps: recipe.steps[language],
  }));
}
