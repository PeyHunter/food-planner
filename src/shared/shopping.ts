import { shopSections, type ShopSection } from "./recipes.ts";
import { addDays, mondayOf, sameAsDinnerPortion } from "./week.ts";
import { convert, formatAmount, kindOf, roundUp, type Unit } from "./units.ts";

export type ShoppingIngredient = {
  id: string;
  name: string;
  shopSection: ShopSection;
  packAmount: number | null;
  packUnit: Unit | null;
  alwaysAtHome: boolean;
};
export type ShoppingRecipe = {
  title: string;
  feeds: number;
  lines: { amount: number | null; unit: Unit | null; ingredient: ShoppingIngredient }[];
};
export type ShoppingDay = {
  date: string;
  people: number;
  /** Children eating "same as dinner": each adds half a portion. */
  sameAsDinner: number;
  dinner: ShoppingRecipe | null;
  childMeals: { childName: string; recipe: ShoppingRecipe }[];
};

export type ShoppingLine = {
  /** Stable across polls and days picked: ticks are stored by it. */
  key: string;
  ingredient: ShoppingIngredient;
  /** Null for lines like "salt, to taste". */
  amount: number | null;
  unit: Unit | null;
  packs: number | null;
  leftover: string | null;
  /** The same leftover as an amount, for "125 g left over" on the list. */
  spare: { amount: number; unit: Unit } | null;
  /** True when a pack size would help: a weight or volume with no pack size yet. */
  needsPackSize: boolean;
  /** "Mon: Salmon bake", "Tue: Cod mash for Runi Lee". */
  meals: string[];
};
export type ShoppingSection = { section: ShopSection; lines: ShoppingLine[] };

/** The list as the screen shows it, with ticks and the kitchen's extra items for that week. */
export type ShoppingItem = ShoppingLine & { ticked: boolean };
export type ShoppingExtra = { key: string; id: string; name: string; ticked: boolean };
export type ShoppingView = {
  monday: string;
  days: string[];
  sections: { section: ShopSection; lines: ShoppingItem[] }[];
  extras: ShoppingExtra[];
  /** How many ticked items "Clear ticked" hid this week. */
  cleared: number;
};

/** A child recipe day is one serving of that recipe, as written for the child. Only "Same as dinner" counts as half. */
export const childPortion = 1;

type Measure = "mass" | "volume" | "pcs" | "none";
const measureOf = (amount: number | null, unit: Unit | null): Measure => {
  if (amount === null || unit === null) return "none";
  return kindOf(unit);
};
const baseUnit: Record<Exclude<Measure, "none">, Unit> = { mass: "g", volume: "ml", pcs: "pcs" };

/** Default days: today through Sunday of today's week. */
export const restOfWeek = (today: string) => {
  const sunday = addDays(mondayOf(today), 6);
  const days: string[] = [];
  for (let day = today; day <= sunday; day = addDays(day, 1)) days.push(day);
  return days;
};

// One formatter for all calls: building it each time is slow, and Create week builds the list for every day it fills.
const shortDayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
// Formatting is slow even with one formatter, and Reduce waste builds the list for each dish and day it tries.
const shortDays = new Map<string, string>();
const shortDay = (date: string) => {
  let label = shortDays.get(date);
  if (label === undefined) shortDays.set(date, (label = shortDayFormat.format(new Date(`${date}T00:00:00Z`))));
  return label;
};

/** 1400 g reads as 1.4 kg, 0.6 kg as 600 g. Pieces stay as they are. */
function tidy(amount: number, unit: Unit): { amount: number; unit: Unit } {
  const kind = kindOf(unit);
  if (kind !== "mass" && kind !== "volume") return { amount, unit };
  const [small, big] = kind === "mass" ? (["g", "kg"] as const) : (["ml", "l"] as const);
  const inSmall = convert(amount, unit, small);
  return inSmall >= 1000 ? { amount: Number((inSmall / 1000).toFixed(3)), unit: big } : { amount: Number(inSmall.toFixed(1)), unit: small };
}

const show = (amount: number, unit: Unit, name: string) => (unit === "pcs" ? `${formatAmount(amount)} ${name}` : `${formatAmount(amount, unit)} ${unit} ${name}`);

type Part = { amount: number; unit: Unit };
type Group = { ingredient: ShoppingIngredient; measure: Measure; parts: Part[]; meals: string[] };

/** The total of one ingredient in one measure, rounded up once after adding. */
function total(measure: Exclude<Measure, "none">, parts: Part[]): { amount: number; unit: Unit } {
  const units = new Set(parts.map((part) => part.unit));
  const [only] = units;
  if (units.size === 1 && only !== "g" && only !== "ml") {
    return { amount: roundUp(parts.reduce((sum, part) => sum + part.amount, 0), only!), unit: only! };
  }
  const base = baseUnit[measure];
  const sum = parts.reduce((all, part) => all + convert(part.amount, part.unit, base), 0);
  const rounded = roundUp(sum, base);
  return measure === "pcs" ? { amount: rounded, unit: "pcs" } : tidy(rounded, base);
}

function packsFor(amount: number, unit: Unit, ingredient: ShoppingIngredient) {
  const { packAmount, packUnit } = ingredient;
  if (packAmount === null || packUnit === null) return { packs: null, leftover: null, spare: null };
  if (kindOf(unit) !== kindOf(packUnit)) return { packs: null, leftover: null, spare: null };
  const needed = convert(amount, unit, packUnit);
  const packs = Math.max(1, Math.ceil(needed / packAmount - 1e-9));
  const spare = packs * packAmount - needed;
  if (spare <= packAmount * 1e-6) return { packs, leftover: null, spare: null };
  const left = tidy(spare, packUnit);
  return { packs, leftover: `${show(left.amount, left.unit, ingredient.name.toLowerCase())} left`, spare: left };
}

/**
 * Scales each planned meal to its day's eaters, adds the same ingredient across meals (within one kind of unit),
 * rounds up once, then rounds up to whole packs. Always-at-home items are left out.
 */
export function buildShoppingList(days: ShoppingDay[]): ShoppingSection[] {
  const groups = new Map<string, Group>();
  const add = (recipe: ShoppingRecipe, eaters: number, meal: string) => {
    for (const line of recipe.lines) {
      if (line.ingredient.alwaysAtHome) continue;
      const measure = measureOf(line.amount, line.unit);
      const key = `${line.ingredient.id}:${measure}`;
      let group = groups.get(key);
      if (!group) groups.set(key, (group = { ingredient: line.ingredient, measure, parts: [], meals: [] }));
      if (measure !== "none") group.parts.push({ amount: (line.amount! * eaters) / recipe.feeds, unit: line.unit! });
      if (!group.meals.includes(meal)) group.meals.push(meal);
    }
  };
  for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const label = shortDay(day.date);
    if (day.dinner) add(day.dinner, day.people + day.sameAsDinner * sameAsDinnerPortion, `${label}: ${day.dinner.title}`);
    for (const meal of day.childMeals) add(meal.recipe, childPortion, `${label}: ${meal.recipe.title} for ${meal.childName}`);
  }

  const lines: ShoppingLine[] = [];
  for (const [key, group] of groups) {
    const { ingredient, measure, meals } = group;
    if (measure === "none") {
      // "Salt, to taste" next to "5 ml salt" is the same thing to buy.
      const measured = ["mass", "volume", "pcs"].map((other) => groups.get(`${ingredient.id}:${other}`)).find(Boolean);
      if (measured) {
        for (const meal of meals) if (!measured.meals.includes(meal)) measured.meals.push(meal);
        continue;
      }
      lines.push({ key, ingredient, amount: null, unit: null, packs: null, leftover: null, spare: null, needsPackSize: false, meals });
      continue;
    }
    const { amount, unit } = total(measure, group.parts);
    const { packs, leftover, spare } = packsFor(amount, unit, ingredient);
    // Pieces are bought as counted ("3 onions"), so only weights and volumes ask for a pack size.
    lines.push({ key, ingredient, amount, unit, packs, leftover, spare, needsPackSize: ingredient.packAmount === null && measure !== "pcs", meals });
  }

  return shopSections
    .map((section) => ({
      section,
      lines: lines.filter((line) => line.ingredient.shopSection === section).sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name) || a.key.localeCompare(b.key)),
    }))
    .filter((section) => section.lines.length > 0);
}
