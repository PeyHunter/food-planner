import { describe, expect, test } from "vitest";
import { danishName, didYouMean, groceries, guessShopSection } from "../src/shared/groceries.ts";
import { shopSections } from "../src/shared/recipes.ts";

describe("guessShopSection", () => {
  test.each([
    // English
    ["Potatoes", "Vegetables"],
    ["sweet potato", "Vegetables"],
    ["Onions", "Vegetables"],
    ["carrots", "Vegetables"],
    ["Leek", "Vegetables"],
    ["garlic cloves", "Vegetables"],
    ["Cherry tomatoes", "Vegetables"],
    ["Berries", "Vegetables"],
    ["fresh basil", "Vegetables"],
    ["tørrede røde chilier", "Spices & sauces"],
    ["tørrede karljohansvampe", "Dry goods"],
    ["cans sardines packed in olive oil", "Tins & jars"],
    ["æg til mayo", "Dairy"],
    ["Tomat puré", "Tins & jars"],
    ["spring onions", "Vegetables"],
    ["Bay leaves", "Spices & sauces"],
    ["Milk", "Dairy"],
    ["double cream", "Dairy"],
    ["Cheese", "Dairy"],
    ["butter", "Dairy"],
    ["Yoghurt", "Dairy"],
    ["Eggs", "Dairy"],
    ["goat's cheese", "Dairy"],
    ["Salmon fillets", "Meat & fish"],
    ["Cod", "Meat & fish"],
    ["chicken thighs", "Meat & fish"],
    ["Beef mince", "Meat & fish"],
    ["Bacon", "Meat & fish"],
    ["King prawns", "Meat & fish"],
    ["Pasta", "Dry goods"],
    ["Rice", "Dry goods"],
    ["Flour", "Dry goods"],
    ["Red lentils", "Dry goods"],
    ["Chicken stock", "Dry goods"],
    ["Pine nuts", "Dry goods"],
    ["Tinned chickpeas", "Tins & jars"],
    ["Tinned tomatoes", "Tins & jars"],
    ["Coconut milk", "Tins & jars"],
    ["Peanut butter", "Tins & jars"],
    ["Saffron", "Spices & sauces"],
    ["ground cumin", "Spices & sauces"],
    ["dried basil", "Spices & sauces"],
    ["tørret timian", "Spices & sauces"],
    ["dried oregano", "Spices & sauces"],
    ["Soy sauce", "Spices & sauces"],
    ["Extra virgin olive oil", "Spices & sauces"],
    ["salt and pepper", "Spices & sauces"],
    ["Peas", "Frozen"],
    ["Frozen peas", "Frozen"],
    ["Fish fingers", "Frozen"],
    ["frozen spinach", "Frozen"],
    ["Sourdough bread", "Bread"],
    ["Pitta breads", "Bread"],
    ["Red wine", "Drinks"],
    ["Orange juice", "Drinks"],
    // Danish, with endings and compounds
    ["hakket oksekød", "Meat & fish"],
    ["kyllingebryst", "Meat & fish"],
    ["kyllingebrystfileter", "Meat & fish"],
    ["oksemørbrad", "Meat & fish"],
    ["laksefilet", "Meat & fish"],
    ["røget laks", "Meat & fish"],
    ["rejer", "Meat & fish"],
    ["bacontern", "Meat & fish"],
    ["hakket kalv og flæsk", "Meat & fish"],
    ["kyllingefrikadeller", "Meat & fish"],
    ["flåede tomater", "Tins & jars"],
    ["hakkede tomater", "Tins & jars"],
    ["1 dåse kokosmælk", "Tins & jars"],
    ["kikærter", "Tins & jars"],
    ["jordbærsyltetøj", "Tins & jars"],
    ["tomatsuppe", "Tins & jars"],
    ["piskefløde", "Dairy"],
    ["2 dl piskefløde", "Dairy"],
    ["revet ost", "Dairy"],
    ["æggene", "Dairy"],
    ["sojamælk", "Dairy"],
    ["creme fraiche 18%", "Dairy"],
    ["rugbrød", "Bread"],
    ["rugbrødet", "Bread"],
    ["løg", "Vegetables"],
    ["rødløg", "Vegetables"],
    ["hvidløgsfed", "Vegetables"],
    ["porreløg", "Vegetables"],
    ["tomaterne", "Vegetables"],
    ["kartoflerne", "Vegetables"],
    ["gulerødder", "Vegetables"],
    ["æbler", "Vegetables"],
    ["friske krydderurter", "Vegetables"],
    ["økologiske bananer", "Vegetables"],
    ["chilipeber", "Vegetables"],
    ["hvedemel", "Dry goods"],
    ["lasagneplader", "Dry goods"],
    ["kyllingebouillon", "Dry goods"],
    ["babygrød", "Dry goods"],
    ["citronsaft", "Spices & sauces"],
    ["rødvinseddike", "Spices & sauces"],
    ["spidskommen", "Spices & sauces"],
    ["frosne ærter", "Frozen"],
    ["frosne bær", "Frozen"],
    ["isterninger", "Frozen"],
    ["danskvand", "Drinks"],
    ["øl", "Drinks"],
    ["bagepapir", "Other"],
    // ae/oe/aa spellings and typos
    ["oksekoed", "Meat & fish"],
    ["hvidloeg", "Vegetables"],
    ["blaabaer", "Vegetables"],
    ["brocoli", "Vegetables"],
    ["tomatoe", "Vegetables"],
    ["agurke", "Vegetables"],
    ["parmasan", "Dairy"],
    ["mozarella", "Dairy"],
    ["chiken breast", "Meat & fish"],
    // A tin word anywhere wins
    ["Hakkede tomat dåse", "Tins & jars"],
    ["dåse majs", "Tins & jars"],
    ["kikærter på dåse", "Tins & jars"],
    ["can of corn", "Tins & jars"],
    ["canned peaches", "Tins & jars"],
    ["tinned tomatoes", "Tins & jars"],
    // Peppercorns are a spice, not a bell pepper
    ["Szechuan pepper", "Spices & sauces"],
    ["sichuan peppercorns", "Spices & sauces"],
    ["peberkorn", "Spices & sauces"],
    ["black pepper", "Spices & sauces"],
    ["red pepper", "Vegetables"],
    // Unknown
    ["birthday candles", "Other"],
    ["zzqx", "Other"],
    ["", "Other"],
  ])("%s goes to %s", (name, section) => {
    expect(guessShopSection(name)).toBe(section);
  });
});

describe("didYouMean", () => {
  test.each([
    ["tomatoe", "tomato"],
    ["agurke", "agurk"],
    ["brocoli", "broccoli"],
    ["parmasan", "parmesan"],
    ["mozarella", "mozzarella"],
    ["spinnach", "spinach"],
    ["rodlog", "rødløg"],
    ["hakket oksekod", "oksekød"],
  ])("%s offers %s first", (name, first) => {
    const offered = didYouMean(name);
    expect(offered[0]).toBe(first);
    expect(offered.length).toBeLessThanOrEqual(3);
  });

  test.each(["tomato", "Tomatoes", "kyllingebryst", "hvidløgsfed", "2 dl piskefløde", "", "zzqx"])("offers nothing for %j", (name) => {
    expect(didYouMean(name)).toEqual([]);
  });
});

describe("danishName", () => {
  test.each([
    ["chicken breasts", "kyllingebryst"],
    ["Minced beef", "hakket oksekød"],
    ["tinned tomatoes", "hakkede tomater"],
    ["Spring onions", "forårsløg"],
    ["double cream", "fløde"],
    ["Eggs", "æg"],
    ["kartoflerne", "kartofler"],
    ["oksekoed", "oksekød"],
    ["brocoli", "broccoli"],
  ])("%s is %s", (name, danish) => {
    expect(danishName(name)).toBe(danish);
  });

  test("is undefined for an unknown name", () => {
    expect(danishName("zzqx")).toBeUndefined();
  });
});

test("every grocery has names in both languages and a real section", () => {
  expect(groceries.length).toBeGreaterThan(300);
  for (const grocery of groceries) {
    expect(grocery.en.length, grocery.da.join()).toBeGreaterThan(0);
    expect(grocery.da.length, grocery.en.join()).toBeGreaterThan(0);
    expect(shopSections).toContain(grocery.section);
  }
});
