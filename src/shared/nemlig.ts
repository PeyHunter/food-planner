import { danishName, groceryOf, guessShopSection, recognise } from "./groceries.ts";
import { translate } from "./i18n.ts";
import { sameIngredient } from "./ingredient-names.ts";
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
  /** Null for an extra ("milk") with no ingredient of the same name on the list to remember a word on. */
  ingredientId: string | null;
  name: string;
  /** What the dinners need; null for "salt, to taste" or an extra. */
  need: { amount: number; unit: Unit } | null;
  /** Whole packs to buy, when the shopping list knows the pack size. */
  pack: { packs: number; amount: number; unit: Unit } | null;
  /** What goes in nemlig's search box, without the organic word. */
  word: string;
  link: string | null;
  /** nemlig.com's product for the catalog pack, when the kitchen kept that pack size and saved no word or link of its own. */
  productId: string | null;
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
 * Words that find the right thing on nemlig.com where the plain Danish name finds too much
 * ("løg" also finds hvidløg and løgringe, "ris" finds rismel and riskiks). Keyed by the grocery's first English name.
 */
const nemligWords: Record<string, string> = {
  onion: "gule løg",
  rice: "jasminris",
  tortilla: "tortilla wraps",
  coriander: "frisk koriander",
  "chicken breast": "kyllingefilet",
  "soy sauce": "soja",
  lime: "lime",
};

/**
 * The word to search nemlig.com for. A Danish name more exact than the plain one is used as typed ("flåede tomater" stays);
 * otherwise the grocery's nemlig word if it has one, else its Danish name, else the name itself.
 */
export function searchWord(name: string): string {
  const found = recognise(name);
  if (!found?.exact) return danishName(name) ?? name.trim();
  const { grocery } = found;
  const typed = lower(name);
  const better = nemligWords[grocery.en[0]!];
  const saysDanish = grocery.da.some((da) => typed.includes(lower(da))) && !grocery.en.some((en) => typed.includes(lower(en)));
  if (saysDanish) return better && grocery.da.some((da) => lower(da) === typed) ? better : name.trim();
  return better ?? grocery.da[0] ?? name.trim();
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

export const productUrl = (id: string) => `https://www.nemlig.com/produkt/${encodeURIComponent(id)}`;

/** Where "Find on nemlig.com" goes: the pasted product, the catalog's product, or nemlig's search with "økologisk" in front when organic. */
export const itemUrl = (item: Pick<SendItem, "word" | "link" | "organic" | "productId">) =>
  item.link ?? (item.productId ? productUrl(item.productId) : nemligSearchUrl(fullWord(item), false));

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
        const need = line.amount !== null && line.unit !== null ? { amount: line.amount, unit: line.unit } : null;
        const { packAmount, packUnit } = line.ingredient;
        const pack = line.packs !== null && packAmount !== null && packUnit !== null ? { packs: line.packs, amount: packAmount, unit: packUnit } : null;
        const organicItem = isOrganic(organic, section);
        // The catalog's product is one size and not organic: a typed pack size or the organic word needs the search.
        const catalog = groceryOf(line.ingredient.name)?.pack;
        const productId =
          !kept && !organicItem && pack && catalog?.nemligId && catalog.amount === pack.amount && catalog.unit === pack.unit ? catalog.nemligId : null;
        return {
          key: line.key,
          ingredientId: line.ingredient.id,
          name: line.ingredient.name,
          need,
          pack,
          word: kept?.word ?? searchWord(line.ingredient.name),
          link: kept?.link ?? null,
          productId,
          organic: organicItem,
        };
      }),
  );
  const allLines = view.sections.flatMap((section) => section.lines);
  const extras = view.extras
    .filter((extra) => !ticked(extra.key, extra.ticked))
    .map((extra): SendItem => {
      // An extra named like an ingredient on the list ("laksefilt") searches with that ingredient's remembered word.
      const same = allLines.find((line) => sameIngredient(line.ingredient.name, extra.name) || sameIngredient(extra.name, line.ingredient.name));
      const kept = same ? remembered[same.ingredient.id] : undefined;
      return {
        key: extra.key,
        ingredientId: same?.ingredient.id ?? null,
        name: extra.name,
        need: null,
        pack: null,
        word: kept?.word ?? searchWord(extra.name),
        link: kept?.link ?? null,
        productId: null,
        organic: isOrganic(organic, guessShopSection(extra.name)),
      };
    });
  return [...lines, ...extras];
}

/** "600 g", "3 pcs", or "" when there is no amount: what the dinners need. */
export const needOf = ({ need }: Pick<SendItem, "need">, language: Language) => (need ? amountLabel(need.amount, need.unit, language) : "");

/** Sold one at a time (a courgette, a lemon): the packs are just pieces. */
const onePiece = (pack: NonNullable<SendItem["pack"]>) => pack.unit === "pcs" && pack.amount === 1;

/** What to put in the basket: "3 pcs" for things sold one at a time, "1 pack · 500 ml", "2 packs · 1 kg" (the size of one pack) when known, else "" (the screen says what is needed). */
export function buyOf({ pack }: Pick<SendItem, "pack">, language: Language) {
  if (!pack) return "";
  if (onePiece(pack)) return amountLabel(pack.packs, "pcs", language);
  const size = amountLabel(pack.amount, pack.unit, language);
  return translate(language, pack.packs === 1 ? "1 pack · {pack}" : "{n} packs · {pack}", { n: pack.packs, pack: size });
}

/** The word with "økologisk" in front when the item is organic, as nemlig's search gets it. */
export const fullWord = (item: Pick<SendItem, "word" | "organic">) => (item.organic && !/økolog/i.test(item.word) ? `økologisk ${item.word}` : item.word);

/** The list as plain Danish text, one line per item: packs to buy when known ("2 x 500 g"), else the amount needed. */
export function copyText(items: SendItem[]) {
  const amount = ({ pack, need }: SendItem) =>
    pack ? (onePiece(pack) ? amountLabel(pack.packs, "pcs", "da") : `${pack.packs} x ${amountLabel(pack.amount, pack.unit, "da")}`) : needOf({ need }, "da");
  return items.map((item) => [amount(item), fullWord(item)].filter(Boolean).join(" ")).join("\n");
}
