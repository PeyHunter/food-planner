import { fitsAge } from "./child-age.ts";
import { isBabyOnly } from "./rule-swaps.ts";
import { checkRules, matches, mealOf, type Dish, type PlanDay, type Rule, type RuleStatus } from "./rules.ts";
import { buildShoppingList, type ShoppingDay, type ShoppingRecipe } from "./shopping.ts";
import { addDays, childRecipeTag } from "./week.ts";

export type PlannerRecipe = Dish &
  ShoppingRecipe & {
    lastMadeOn: string | null;
    ageFromMonths: number | null;
    ageToMonths: number | null;
  };
export type PlannerChild = { id: string; name: string; ageMonths: number | null };
export type PlannerDay = PlanDay & { people: number };
export type CreateWeekInput = {
  rules: Rule[];
  days: PlannerDay[];
  recipes: PlannerRecipe[];
  children: PlannerChild[];
  /** Days before this are past and never filled. Dishes cooked in the 14 days before it are skipped. */
  today: string;
  /** Portions in the freezer by recipe id. Each one can be a dinner "from the freezer". */
  freezer?: Record<string, number>;
};
/** Put `recipeId` on `date`, as the dinner (childId null) or as that child's meal. With sameAsDinner, the child eats that day's dinner (recipeId) mashed. */
export type Fill = { date: string; childId: string | null; recipeId: string; sameAsDinner?: true; fromFreezer?: true };
export type CreateWeekResult = { fills: Fill[]; rules: RuleStatus[]; note: string };

export const recentDays = 14;

export const forChildren = (recipe: PlannerRecipe) => recipe.ageFromMonths !== null || recipe.ageToMonths !== null || recipe.tags.includes(childRecipeTag);

/** A recipe with an age range fits a child of known age inside it; one tagged "for Runi" without a range fits any child. */
function fitsChild(recipe: PlannerRecipe, child: PlannerChild) {
  if (recipe.ageFromMonths === null && recipe.ageToMonths === null) return recipe.tags.includes(childRecipeTag);
  return child.ageMonths !== null && fitsAge(recipe, child.ageMonths);
}

/**
 * Fills only empty dinners, then each child's empty days, one at a time. A child first gets "Same as dinner, mashed" on days
 * whose dinner helps one of the child's at-least rules still short, then child recipes on the days left. Each recipe pick:
 * never pushes an at-most rule over, helps the most at-least rules still short, gives the adults a child recipe only
 * when it meets a rule a grown-up recipe can't, takes a dinner from the freezer when there is a portion, uses up the most leftover packs,
 * then takes the dish not made for the longest time (then by title).
 * Skips dishes made in the last 14 days (unless a portion is in the freezer) and dishes already in the week.
 */
export function createWeek({ rules, days, recipes, children, today, freezer = {} }: CreateWeekInput): CreateWeekResult {
  const plan: PlannerDay[] = days.map((day) => ({ ...day, children: { ...day.children } }));
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const used = new Set<string>();
  for (const day of plan) for (const who of [null, ...children.map((child) => child.id)]) {
    const dish = mealOf(day, who);
    if (dish) used.add(dish.id);
  }
  const recent = addDays(today, -recentDays);
  const frozen = new Map(Object.entries(freezer).filter(([, count]) => count > 0));
  const ordered = recipes
    .filter((recipe) => recipe.lastMadeOn === null || recipe.lastMadeOn < recent || frozen.has(recipe.id))
    .sort((a, b) => (a.lastMadeOn ?? "").localeCompare(b.lastMadeOn ?? "") || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));

  const open = plan.filter((day) => day.date >= today);
  const isEmpty = (day: PlannerDay, child: PlannerChild) => (day.children[child.id] ?? { kind: "empty" }).kind === "empty";
  const slots: { day: PlannerDay; child: PlannerChild | null; mash: boolean }[] = [
    ...open.filter((day) => day.dinner === null).map((day) => ({ day, child: null, mash: false })),
    ...children.flatMap((child) => {
      const empty = open.filter((day) => isEmpty(day, child));
      return [...empty.map((day) => ({ day, child, mash: true })), ...empty.map((day) => ({ day, child, mash: false }))];
    }),
  ];
  const toFill = slots.filter((slot) => !slot.mash).length;

  const fills: Fill[] = [];
  for (const { day, child, mash } of slots) {
    if (child && !isEmpty(day, child)) continue;
    const counts = new Map(checkRules(rules, plan).map((status) => [status.id, status.count]));
    // A dinner also counts for each child eating "same as dinner" that day.
    const eaters = child ? [child.id] : [null, ...children.filter((kid) => day.children[kid.id]?.kind === "same-as-dinner").map((kid) => kid.id)];
    const touched = rules.filter((rule) => eaters.includes(rule.childId));

    if (mash) {
      const dinner = day.dinner;
      if (!dinner) continue;
      const hits = touched.filter((rule) => matches(dinner, rule.what));
      if (hits.some((rule) => rule.op === "at-most" && counts.get(rule.id)! + 1 > rule.n)) continue;
      if (!hits.some((rule) => rule.op === "at-least" && counts.get(rule.id)! < rule.n)) continue;
      day.children[child!.id] = { kind: "same-as-dinner" };
      fills.push({ date: day.date, childId: child!.id, recipeId: dinner.id, sameAsDinner: true });
      continue;
    }

    const spare = leftoverIngredients(plan, children, byId);

    let best: { recipe: PlannerRecipe; score: number[] } | undefined;
    for (const recipe of ordered) {
      if (used.has(recipe.id)) continue;
      const fromFreezer = !child && frozen.has(recipe.id) ? 1 : 0;
      // A dish cooked lately only comes back as a freezer portion.
      if (!fromFreezer && recipe.lastMadeOn !== null && recipe.lastMadeOn >= recent) continue;
      if (child ? !fitsChild(recipe, child) : isBabyOnly(recipe.ageToMonths)) continue;
      const hits = touched.filter((rule) => matches(recipe, rule.what));
      if (hits.some((rule) => rule.op === "at-most" && counts.get(rule.id)! + 1 > rule.n)) continue;
      const helps = hits.filter((rule) => rule.op === "at-least" && counts.get(rule.id)! < rule.n).length;
      const grownUp = child || !forChildren(recipe) ? 1 : 0;
      // Child recipes stay for the children unless the adults need one to meet a rule.
      if (!grownUp && !helps) continue;
      const usesUp = new Set(recipe.lines.filter((line) => spare.has(line.ingredient.id)).map((line) => line.ingredient.id)).size;
      const score = [helps, grownUp, fromFreezer, usesUp];
      if (!best || beats(score, best.score)) best = { recipe, score };
    }
    if (!best) continue;
    const { recipe } = best;
    if (child) day.children[child.id] = { kind: "recipe", dish: recipe };
    else day.dinner = recipe;
    used.add(recipe.id);
    if (!child && frozen.has(recipe.id)) {
      const left = frozen.get(recipe.id)! - 1;
      if (left > 0) frozen.set(recipe.id, left);
      else frozen.delete(recipe.id);
      fills.push({ date: day.date, childId: null, recipeId: recipe.id, fromFreezer: true });
      continue;
    }
    fills.push({ date: day.date, childId: child?.id ?? null, recipeId: recipe.id });
  }

  const statuses = checkRules(rules, plan);
  const stillEmpty = open.filter((day) => day.dinner === null || children.some((child) => isEmpty(day, child))).length;
  return { fills, rules: statuses, note: noteFor(fills, toFill, stillEmpty, statuses, children) };
}

const beats = (score: number[], other: number[]) => {
  for (let index = 0; index < score.length; index++) if (score[index] !== other[index]) return score[index]! > other[index]!;
  return false;
};

/** The plan as the shopping list builder takes it. */
export function toShoppingDays(plan: PlannerDay[], children: PlannerChild[], byId: Map<string, PlannerRecipe>): ShoppingDay[] {
  const recipeOf = (dish: Dish | null) => (dish ? (byId.get(dish.id) ?? null) : null);
  return plan.map((day) => ({
    date: day.date,
    people: day.people,
    sameAsDinner: children.filter((child) => day.children[child.id]?.kind === "same-as-dinner").length,
    dinner: recipeOf(day.dinner),
    childMeals: children.flatMap((child) => {
      const meal = day.children[child.id];
      const recipe = meal?.kind === "recipe" ? recipeOf(meal.dish) : null;
      return recipe ? [{ childName: child.name, recipe }] : [];
    }),
  }));
}

/** Ingredients the shopping list would buy more of than the planned meals use. */
function leftoverIngredients(plan: PlannerDay[], children: PlannerChild[], byId: Map<string, PlannerRecipe>) {
  return new Set(
    buildShoppingList(toShoppingDays(plan, children, byId))
      .flatMap((section) => section.lines)
      .filter((line) => line.leftover !== null)
      .map((line) => line.ingredient.id),
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const fromFreezerNote = (fills: Fill[]) => {
  const n = fills.filter((fill) => fill.fromFreezer).length;
  return n ? ` (${n} from the freezer)` : "";
};

/** "Filled 4 dinners and 2 meals for Runi Lee. 3 days still empty: add more recipes to fill them. Fish 2/2 for Runi Lee ✓" */
function noteFor(fills: Fill[], open: number, stillEmpty: number, statuses: RuleStatus[], children: PlannerChild[]) {
  if (!open) return "Nothing to fill. Every day is already planned.";
  if (!fills.length) return "No recipe fits the empty days. Add more recipes or loosen the rules.";
  const parts = [
    ...(fills.some((fill) => fill.childId === null) ? [plural(fills.filter((fill) => fill.childId === null).length, "dinner") + fromFreezerNote(fills)] : []),
    ...children.flatMap((child) => {
      const n = fills.filter((fill) => fill.childId === child.id).length;
      return n ? [`${plural(n, "meal")} for ${child.name}`] : [];
    }),
  ];
  const goals = statuses
    .filter((status) => status.op === "at-least" && status.n > 0)
    .map((status) => {
      const who = status.childId ? ` for ${children.find((child) => child.id === status.childId)?.name ?? "the child"}` : "";
      return `${status.what} ${status.count}/${status.n}${who} ${status.met ? "✓" : "not met yet"}`;
    });
  const empty = stillEmpty ? `${plural(stillEmpty, "day")} still empty: add more recipes to fill them.` : "";
  return [`Filled ${parts.join(" and ")}.`, empty, goals.join(" · ")].filter(Boolean).join(" ");
}
