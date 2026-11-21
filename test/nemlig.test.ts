import { describe, expect, test } from "vitest";
import { amountLabel, buildSendList, buyOf, copyText, itemUrl, needOf, nemligLink, searchWord } from "../src/shared/nemlig.ts";
import type { ShoppingIngredient, ShoppingItem, ShoppingView } from "../src/shared/shopping.ts";
import type { ShopSection } from "../src/shared/recipes.ts";

const ingredient = (id: string, name: string, shopSection: ShopSection = "Vegetables", alwaysAtHome = false): ShoppingIngredient => ({
  id,
  name,
  shopSection,
  packAmount: null,
  packUnit: null,
  alwaysAtHome,
});
const item = (ingredientOf: ShoppingIngredient, more: Partial<ShoppingItem> = {}): ShoppingItem => ({
  key: `${ingredientOf.id}:mass`,
  ingredient: ingredientOf,
  amount: 600,
  unit: "g",
  packs: null,
  leftover: null,
  spare: null,
  needsPackSize: false,
  meals: ["Mon: Soup"],
  ticked: false,
  ...more,
});

const carrots = ingredient("c", "Carrots");
const chicken = { ...ingredient("k", "chicken breasts", "Meat & fish"), packAmount: 500, packUnit: "g" as const };
const tomatoes = ingredient("t", "flåede tomater", "Tins & jars");
const onion = ingredient("o", "Onion");
const view: ShoppingView = {
  monday: "2026-03-02",
  days: ["2026-03-02"],
  sections: [
    { section: "Vegetables", lines: [item(carrots), item(onion, { key: "o:pcs", amount: 3, unit: "pcs" })] },
    { section: "Meat & fish", lines: [item(chicken, { packs: 2 }), item(ingredient("x", "Pork"), { ticked: true })] },
    { section: "Tins & jars", lines: [item(tomatoes, { amount: null, unit: null })] },
  ],
  extras: [
    { key: "extra:1", id: "1", name: "milk", ticked: false },
    { key: "extra:2", id: "2", name: "apples", ticked: false },
    { key: "extra:3", id: "3", name: "bread", ticked: true },
  ],
  cleared: 0,
};

describe("searchWord", () => {
  test.each([
    ["chicken breasts", "kyllingefilet"],
    ["Carrots", "gulerødder"],
    ["flåede tomater", "flåede tomater"],
    ["Hakkede tomat dåse", "Hakkede tomat dåse"],
    ["kyllingebryst", "kyllingefilet"],
    ["onions", "gule løg"],
    ["løg", "gule løg"],
    ["rødløg", "rødløg"],
    ["rice", "jasminris"],
    ["ris", "jasminris"],
    ["basmatiris", "basmatiris"],
    ["tortillas", "tortilla wraps"],
    ["fresh coriander", "frisk koriander"],
    ["koriander", "frisk koriander"],
    ["stødt koriander", "stødt koriander"],
    ["soy sauce", "soja"],
    ["lime", "lime"],
    ["zzqx gadget", "zzqx gadget"],
    ["brocoli", "broccoli"],
  ])("%s searches for %s", (name, word) => {
    expect(searchWord(name)).toBe(word);
  });
});

describe("buildSendList", () => {
  test("takes every item not ticked, lines first, then extras, in list order", () => {
    const items = buildSendList(view, { organic: "none" });
    expect(items.map((one) => one.name)).toEqual(["Carrots", "Onion", "chicken breasts", "flåede tomater", "milk", "apples"]);
    expect(items.map((one) => one.word)).toEqual(["gulerødder", "gule løg", "kyllingefilet", "flåede tomater", "mælk", "æbler"]);
    expect(items.every((one) => !one.organic && one.link === null)).toBe(true);
  });

  test("leaves out ticks the screen made but the server has not seen", () => {
    const items = buildSendList(view, { organic: "none", ticked: (key, fromServer) => key === "c:mass" || fromServer });
    expect(items.map((one) => one.key)).not.toContain("c:mass");
  });

  test("fruit and veg organic only marks the vegetable section and fruit extras", () => {
    const items = buildSendList(view, { organic: "produce" });
    expect(Object.fromEntries(items.map((one) => [one.name, one.organic]))).toEqual({
      Carrots: true,
      Onion: true,
      "chicken breasts": false,
      "flåede tomater": false,
      milk: false,
      apples: true,
    });
    expect(buildSendList(view, { organic: "all" }).every((one) => one.organic)).toBe(true);
  });

  test("a remembered word or link wins for next week", () => {
    const items = buildSendList(view, { organic: "all", remembered: { k: { word: "kyllingefilet", link: null }, c: { word: null, link: "https://www.nemlig.com/gulerod-123" } } });
    const chick = items.find((one) => one.name === "chicken breasts")!;
    expect(chick.word).toBe("kyllingefilet");
    expect(itemUrl(chick)).toBe(`https://www.nemlig.com/?search=${encodeURIComponent("økologisk kyllingefilet")}`);
    const carrot = items.find((one) => one.name === "Carrots")!;
    expect(carrot.word).toBe("gulerødder");
    expect(itemUrl(carrot)).toBe("https://www.nemlig.com/gulerod-123");
  });

  test("says the packs to buy when the pack size is known, else what is needed", () => {
    const items = buildSendList(view, { organic: "none" });
    expect(items.map((one) => buyOf(one, "en"))).toEqual(["", "", "Buy 2 packs (500 g each)", "", "", ""]);
    expect(items.map((one) => buyOf(one, "da"))).toEqual(["", "", "Køb 2 pakker (500 g hver)", "", "", ""]);
    expect(items.map((one) => needOf(one, "en"))).toEqual(["600 g", "3 pcs", "600 g", "", "", ""]);
    expect(items.map((one) => needOf(one, "da"))).toEqual(["600 g", "3 stk", "600 g", "", "", ""]);
  });
});

test("the search link adds økologisk once", () => {
  expect(itemUrl({ word: "mælk", link: null, organic: true })).toBe(`https://www.nemlig.com/?search=${encodeURIComponent("økologisk mælk")}`);
  expect(itemUrl({ word: "økologisk mælk", link: null, organic: true })).toBe(`https://www.nemlig.com/?search=${encodeURIComponent("økologisk mælk")}`);
  expect(itemUrl({ word: "mælk", link: null, organic: false })).toBe("https://www.nemlig.com/?search=m%C3%A6lk");
});

test("the copied list is Danish, one line per item with its amount", () => {
  const items = buildSendList(view, { organic: "produce" });
  expect(copyText(items)).toBe(["600 g økologisk gulerødder", "3 stk økologisk gule løg", "2 x 500 g kyllingefilet", "flåede tomater", "mælk", "økologisk æbler"].join("\n"));
});

test("pieces never stand alone", () => {
  expect(amountLabel(1, "pcs", "en")).toBe("1 pc");
  expect(amountLabel(4, "pcs", "en")).toBe("4 pcs");
  expect(amountLabel(1, "pcs", "da")).toBe("1 stk");
  expect(amountLabel(1.5, "l", "da")).toBe("1½ l");
});

describe("nemligLink", () => {
  test.each([
    ["https://www.nemlig.com/kyllingebryst-5021812", "https://www.nemlig.com/kyllingebryst-5021812"],
    ["  https://nemlig.com/x  ", "https://nemlig.com/x"],
  ])("keeps %s", (text, link) => {
    expect(nemligLink(text)).toBe(link);
  });
  test.each(["http://www.nemlig.com/x", "https://nemlig.com.evil.dk/x", "https://evilnemlig.com/x", "javascript:alert(1)", "https://user:pw@nemlig.com/", "kyllingebryst", ""])(
    "refuses %j",
    (text) => {
      expect(nemligLink(text)).toBeUndefined();
    },
  );
});
