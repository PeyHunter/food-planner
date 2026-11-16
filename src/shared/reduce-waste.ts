import { forChildren, toShoppingDays, type CreateWeekInput, type PlannerDay, type PlannerRecipe } from "./create-week.ts";
import { isBabyOnly } from "./rule-swaps.ts";
import { checkRules } from "./rules.ts";
import { buildShoppingList, type ShoppingLine } from "./shopping.ts";
import { convert } from "./units.ts";
import { localeOf, translate } from "./i18n.ts";
import { weekdayName } from "./week.ts";

/** Put `recipeId` as the dinner on `date`. `replaces` is the dinner it takes the place of, so undo can put it back. */
export type WasteSwap = { date: string; recipeId: string; replaces: string | null; text: string };
export type ReduceWaste = { swap: WasteSwap | null; text: string };

export const nothingToSwap = "Nothing to swap. This week wastes very little.";

type Spare = { packs: number; leftover: string; ingredientId: string; name: string };

/** Each shopping line with a leftover: how much of a pack is left (0.6 for 600 g of a 1 kg bag) and its "600 g carrots left". */
function spareOf(days: PlannerDay[], input: CreateWeekInput, byId: Map<string, PlannerRecipe>) {
  const spare = new Map<string, Spare>();
  for (const line of buildShoppingList(toShoppingDays(days, input.children, byId)).flatMap((section) => section.lines)) {
    const packs = leftPacks(line);
    if (packs > 0) spare.set(line.key, { packs, leftover: line.leftover!, ingredientId: line.ingredient.id, name: line.ingredient.name });
  }
  return spare;
}

function leftPacks({ packs, amount, unit, leftover, ingredient }: ShoppingLine) {
  if (packs === null || leftover === null || amount === null || unit === null || !ingredient.packAmount || !ingredient.packUnit) return 0;
  return packs - convert(amount, unit, ingredient.packUnit) / ingredient.packAmount;
}

const total = (spare: Spare[]) => spare.reduce((sum, line) => sum + line.packs, 0);
const uses = (recipe: PlannerRecipe | undefined, ingredientId: string) => !!recipe?.lines.some((line) => line.ingredient.id === ingredientId);

/**
 * One dinner change that lowers the week's leftovers, counted in packs: fill an empty day or swap a planned dinner
 * that is not past, with a grown-up recipe not yet in the week that uses a leftover. Never breaks a rule that is met now.
 * Takes the biggest drop, then empty days before planned ones, then the earliest day, then the title.
 */
export function reduceWaste(input: CreateWeekInput): ReduceWaste {
  const { rules, days, recipes, children, today } = input;
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const before = spareOf(days, input, byId);
  if (!before.size) return { swap: null, text: translate(input.language ?? "en", nothingToSwap) };
  const metBefore = checkRules(rules, days).filter((status) => status.met);
  const spareIngredients = new Set([...before.values()].map((line) => line.ingredientId));

  const inWeek = new Set<string>();
  for (const day of days) {
    if (day.dinner) inWeek.add(day.dinner.id);
    for (const meal of Object.values(day.children)) if (meal.kind === "recipe") inWeek.add(meal.dish.id);
  }
  const weekRecipes = [...inWeek].flatMap((id) => byId.get(id) ?? []);
  const candidates = recipes
    .filter((recipe) => !inWeek.has(recipe.id) && !forChildren(recipe) && !isBabyOnly(recipe.ageToMonths))
    .filter((recipe) => recipe.lines.some((line) => spareIngredients.has(line.ingredient.id)))
    .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  const slots = days
    .map((day, index) => ({ day, index }))
    .filter(({ day }) => day.date >= today && !day.away)
    .sort((a, b) => Number(a.day.dinner !== null) - Number(b.day.dinner !== null) || a.index - b.index);

  // Leftovers add up per ingredient over the whole week. So one ingredient's leftover after a change depends only on
  // the day's eaters, the dinner taken out, and the new dish's lines for that ingredient, and many dishes share those.
  const sparePacks = new Map<string, number>();
  for (const line of before.values()) sparePacks.set(line.ingredientId, (sparePacks.get(line.ingredientId) ?? 0) + line.packs);
  const weekOnly = new Map<string, Map<string, PlannerRecipe>>();
  const onlyOf = (id: string) => {
    let week = weekOnly.get(id);
    if (!week) weekOnly.set(id, (week = new Map(weekRecipes.map((dish) => [dish.id, { ...dish, lines: dish.lines.filter((line) => line.ingredient.id === id) }]))));
    return week;
  };
  const spareAfter = new Map<string, Map<string, number>>();
  const afterFor = (index: number, slotKey: string, recipe: PlannerRecipe, id: string) => {
    const lines = recipe.lines.filter((line) => line.ingredient.id === id);
    const key = `${id}|${slotKey}|${recipe.feeds}|${lines.map((line) => `${line.amount}${line.unit}`).join(",")}`;
    let result = spareAfter.get(key);
    if (!result) {
      const narrow = new Map(onlyOf(id)).set(recipe.id, { ...recipe, lines });
      const changed = days.map((other, at) => (at === index ? { ...other, dinner: recipe } : other));
      spareAfter.set(key, (result = new Map([...spareOf(changed, input, narrow)].map(([lineKey, line]) => [lineKey, line.packs]))));
    }
    return result;
  };

  let best: { drop: number; index: number; recipe: PlannerRecipe; used: Spare } | undefined;
  for (const { day, index } of slots) {
    const current = day.dinner ? byId.get(day.dinner.id) : undefined;
    const sameAsDinner = Object.values(day.children).filter((meal) => meal.kind === "same-as-dinner").length;
    const slotKey = `${current?.id ?? ""}|${day.people}|${sameAsDinner}`;
    for (const recipe of candidates) {
      const touched = new Set([...recipe.lines, ...(current?.lines ?? [])].map((line) => line.ingredient.id));
      let drop = 0;
      for (const id of touched) {
        drop += sparePacks.get(id) ?? 0;
        for (const packs of afterFor(index, slotKey, recipe, id).values()) drop -= packs;
      }
      if (drop <= 1e-6 || (best && drop <= best.drop + 1e-6)) continue;
      // The leftover the new dish uses up most, and not one the swapped-out dinner was making.
      const used = [...before]
        .filter(([, line]) => uses(recipe, line.ingredientId) && !uses(current, line.ingredientId))
        .map(([key, line]) => ({ line, less: line.packs - (afterFor(index, slotKey, recipe, line.ingredientId).get(key) ?? 0) }))
        .filter(({ less }) => less > 1e-6)
        .sort((a, b) => b.less - a.less || a.line.name.localeCompare(b.line.name))[0]?.line;
      if (!used) continue;
      const changed = days.map((other, at) => (at === index ? { ...other, dinner: recipe } : other));
      if (checkRules(metBefore, changed).some((status) => !status.met)) continue;
      best = { drop, index, recipe, used };
    }
  }
  if (!best) return { swap: null, text: translate(input.language ?? "en", nothingToSwap) };

  const language = input.language ?? "en";
  const tr = (text: string, values: Record<string, string | number>) => translate(language, text, values);
  const day = days[best.index]!;
  const fromDay = days.find((other) => [other.dinner, ...Object.values(other.children).map((meal) => (meal.kind === "recipe" ? meal.dish : null))].some((dish) => dish && uses(byId.get(dish.id), best.used.ingredientId)));
  const weekday = weekdayName(day.date, localeOf(language));
  const change = day.dinner ? tr("Swap {slot} for {title}", { slot: weekday, title: best.recipe.title }) : tr("Add {title} on {slot}", { title: best.recipe.title, slot: weekday });
  const from = fromDay ? ` ${tr("from {day}", { day: weekdayName(fromDay.date, localeOf(language)) })}` : "";
  const text = `${change} ${tr("to use the {leftover}", { leftover: best.used.leftover })}${from}.`;
  return { swap: { date: day.date, recipeId: best.recipe.id, replaces: day.dinner?.id ?? null, text }, text };
}
