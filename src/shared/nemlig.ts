import { danishName, guessShopSection, recognise, type Grocery } from "./groceries.ts";
import { translate } from "./i18n.ts";
import { nemligSearchUrl, type Language, type Organic } from "./profile.ts";
import type { ShopSection } from "./recipes.ts";
import type { ShoppingView } from "./shopping.ts";
import { formatAmount, type Unit } from "./units.ts";

/** A word or product link the kitchen picked for an ingredient on nemlig.com, kept for next week. */
export type Remembered = { word: string | null; link: string | null };

/** One thing to put in the nemlig.com basket. */
export type SendItem = {
  /** The shopping list key, so it can be ticked off after. */
  key: string;
  /** Null for an extra ("milk"), which has no ingredient to remember a word on. */
  ingredientId: string | null;
  name: string;
  /** Whole packs when a pack size is known, else the amount; null for "salt, to taste" or an extra. */
  measure: { packs: number } | { amount: number; unit: Unit } | null;
  /** What goes in nemlig's search box, without the organic word. */
  word: string;
  link: string | null;
  organic: boolean;
};

export const maxWord = 80;
export const maxLink = 500;
export const nemligHome = "https://www.nemlig.com/";

/** "600 g", "1.5 l", and pieces as "3 pcs" / "3 stk" so a count never stands alone. */
export function amountLabel(amount: number, unit: Unit, language: Language) {
  if (unit === "pcs") return language === "da" ? `${formatAmount(amount)} stk` : `${formatAmount(amount)} ${amount === 1 ? "pc" : "pcs"}`;
  return `${formatAmount(amount, unit)} ${translate(language, unit)}`;
}

const lower = (text: string) => text.trim().toLowerCase();

/**
 * The word to search nemlig.com for. A Danish name we know is used as typed ("flåede tomater" stays);
 * otherwise the grocery's own nemlig word if it has one, else its Danish name, else the name itself.
 */
export function searchWord(name: string): string {
  const found = recognise(name);
  if (!found?.exact) return danishName(name) ?? name.trim();
  const { grocery } = found;
  const typed = lower(name);
  const saysDanish = grocery.da.some((da) => typed.includes(lower(da))) && !grocery.en.some((en) => typed.includes(lower(en)));
  if (saysDanish) return name.trim();
  return (grocery as Grocery & { nemlig?: string }).nemlig ?? grocery.da[0] ?? name.trim();
}

/** Fruit and veg sit in Vegetables, so "produce" means that section. */
export const isOrganic = (organic: Organic, section: ShopSection) => organic === "all" || (organic === "produce" && section === "Vegetables");

/** Only a real nemlig.com page over https may be stored and opened. Returns the cleaned link, or undefined. */
export function nemligLink(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > maxLink) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" || url.username || url.password) return undefined;
    if (url.hostname !== "nemlig.com" && !url.hostname.endsWith(".nemlig.com")) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

/** Where "Find on nemlig.com" goes: the pasted product, or nemlig's search with "økologisk" in front when organic. */
export const itemUrl = (item: Pick<SendItem, "word" | "link" | "organic">) => item.link ?? nemligSearchUrl(fullWord(item), false);

/**
 * Everything still to buy, in list order: not ticked (always-at-home items are never on the list).
 * `ticked` lets the screen pass ticks the server has not seen yet.
 */
export function buildSendList(
  view: ShoppingView,
  { remembered = {}, organic, ticked = (_key, fromServer) => fromServer }: {
    remembered?: Record<string, Remembered>;
    organic: Organic;
    ticked?: (key: string, fromServer: boolean) => boolean;
  },
): SendItem[] {
  const lines = view.sections.flatMap(({ section, lines }) =>
    lines
      .filter((line) => !ticked(line.key, line.ticked) && !line.ingredient.alwaysAtHome)
      .map((line): SendItem => {
        const kept = remembered[line.ingredient.id];
        const measure = line.packs !== null ? { packs: line.packs } : line.amount !== null && line.unit !== null ? { amount: line.amount, unit: line.unit } : null;
        return {
          key: line.key,
          ingredientId: line.ingredient.id,
          name: line.ingredient.name,
          measure,
          word: kept?.word ?? searchWord(line.ingredient.name),
          link: kept?.link ?? null,
          organic: isOrganic(organic, section),
        };
      }),
  );
  const extras = view.extras
    .filter((extra) => !ticked(extra.key, extra.ticked))
    .map((extra): SendItem => ({
      key: extra.key,
      ingredientId: null,
      name: extra.name,
      measure: null,
      word: searchWord(extra.name),
      link: null,
      organic: isOrganic(organic, guessShopSection(extra.name)),
    }));
  return [...lines, ...extras];
}

/** "2 packs", "600 g", "3 pcs", or "" when there is no amount. */
export function amountOf(item: Pick<SendItem, "measure">, language: Language) {
  const { measure } = item;
  if (!measure) return "";
  if ("packs" in measure) return translate(language, measure.packs === 1 ? "1 pack" : "{n} packs", { n: measure.packs });
  return amountLabel(measure.amount, measure.unit, language);
}

/** The word with "økologisk" in front when the item is organic, as nemlig's search gets it. */
export const fullWord = (item: Pick<SendItem, "word" | "organic">) => (item.organic && !/økolog/i.test(item.word) ? `økologisk ${item.word}` : item.word);

/** The list as plain Danish text, one line per item with its amount, for nemlig's own list tools. */
export function copyText(items: SendItem[]) {
  return items.map((item) => [amountOf(item, "da"), fullWord(item)].filter(Boolean).join(" ")).join("\n");
}
