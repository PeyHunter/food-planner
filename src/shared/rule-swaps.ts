import { checkRules, countFor, mealOf, type Dish, type PlanDay, type Rule, type RuleStatus } from "./rules.ts";
import { weekdayName } from "./week.ts";

/** `babyOnly`: the recipe's age range ends before `adultFoodFromMonths`, so it is never offered to adults. */
export type SwapRecipe = Dish & { lastMadeOn: string | null; forChildren: boolean; babyOnly: boolean };

export const adultFoodFromMonths = 18;
export const isBabyOnly = (ageToMonths: number | null) => ageToMonths !== null && ageToMonths < adultFoodFromMonths;

/**
 * "recipe": put `recipeId` on `date`, as the dinner (childId null) or as that child's meal.
 * "same-as-dinner": the child eats that day's dinner, mashed.
 * "note": no single change helps; `text` says what to do and there is nothing to accept.
 */
export type Suggestion = { id: string; ruleId: string; childId: string | null; text: string } & (
  | { kind: "recipe"; date: string; recipeId: string }
  | { kind: "same-as-dinner"; date: string; recipeId: null }
  | { kind: "note"; date: null; recipeId: null }
);

export type SwapInput = {
  rules: Rule[];
  days: PlanDay[];
  recipes: SwapRecipe[];
  childNames: Record<string, string>;
  /** Days before this are past and never changed. */
  today: string;
};

/**
 * For each missed rule, the first single change that moves it toward met without breaking a rule that is met now.
 * For a child, eating a matching dinner mashed comes first. Then empty days before planned ones,
 * and dishes not made for the longest time first. When nothing helps, a plain note.
 */
export function suggestSwaps({ rules, days, recipes, childNames, today }: SwapInput): Suggestion[] {
  const before = checkRules(rules, days);
  const metBefore = before.filter((status) => status.met);
  const ordered = [...recipes].sort(
    (a, b) => (a.lastMadeOn ?? "").localeCompare(b.lastMadeOn ?? "") || a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
  );
  const suggestions: Suggestion[] = [];

  for (const missed of before.filter((status) => !status.met)) {
    const { childId } = missed;
    const child = childId === null ? null : (childNames[childId] ?? "the child");
    // The adults' dinner on a day out or with takeout is not swapped.
    const open = days.filter((day) => day.date >= today && !(childId === null && day.away));
    const tryDays = [...open.filter((day) => mealOf(day, childId) === null), ...open.filter((day) => mealOf(day, childId) !== null)];
    const used = new Set(days.map((day) => mealOf(day, childId)?.id).filter(Boolean));
    const unused = ordered.filter((recipe) => !used.has(recipe.id));
    // Adults may eat child recipes, but only when no grown-up recipe can meet the rule.
    const tiers =
      childId === null
        ? [unused.filter((recipe) => !recipe.forChildren), unused.filter((recipe) => recipe.forChildren && !recipe.babyOnly)]
        : [unused.filter((recipe) => recipe.forChildren)];
    const mashed = childId === null ? [] : tryDays.filter((day) => day.dinner !== null).map((day) => ({ day, recipe: null }));
    const tries: { day: PlanDay; recipe: SwapRecipe | null }[] = [
      ...mashed,
      ...tiers.flatMap((fits) => tryDays.flatMap((day) => fits.map((recipe) => ({ day, recipe })))),
    ];

    const found = tries.some(({ day, recipe }) => {
      const changed = days.map((other) => (other.date === day.date ? place(other, childId, recipe) : other));
      const count = countFor(missed, changed);
      const better = missed.op === "at-least" ? count > missed.count : count < missed.count;
      if (!better || checkRules(metBefore, changed).some((status) => !status.met)) return false;
      const base = { ruleId: missed.id, childId, date: day.date, text: sentence(missed, count, day, recipe, child) };
      suggestions.push(
        recipe
          ? { ...base, id: `${missed.id}:${day.date}:${recipe.id}`, kind: "recipe", recipeId: recipe.id }
          : { ...base, id: `${missed.id}:${day.date}:same-as-dinner`, kind: "same-as-dinner", recipeId: null },
      );
      return true;
    });
    if (!found) suggestions.push({ id: `${missed.id}:note`, ruleId: missed.id, childId, kind: "note", date: null, recipeId: null, text: note(missed, child) });
  }
  return suggestions;
}

/** `dish` null: the child eats that day's dinner, mashed. */
function place(day: PlanDay, childId: string | null, dish: Dish | null): PlanDay {
  if (childId === null) return { ...day, dinner: dish };
  return { ...day, children: { ...day.children, [childId]: dish ? { kind: "recipe", dish } : { kind: "same-as-dinner" } } };
}

function sentence(rule: Rule, count: number, day: PlanDay, recipe: Dish | null, child: string | null) {
  const weekday = weekdayName(day.date);
  const empty = mealOf(day, rule.childId) === null;
  const slot = child ? `${child}'s ${weekday}` : weekday;
  const change = !recipe
    ? `Give ${child} ${weekday}'s dinner (${day.dinner!.title}), mashed,`
    : empty
      ? `Add ${recipe.title} on ${slot}`
      : `Swap ${slot} for ${recipe.title}`;
  const what = rule.what.toLowerCase();
  const goal = rule.op === "at-least" ? `to get ${what} ${count}/${rule.n}` : `to get ${what} down to ${count}`;
  return `${change} ${goal}`;
}

const meals = (n: number, what: string) => `${n} ${what} ${n === 1 ? "meal" : "meals"}`;

/** What to do when no single change this week helps. */
function note(rule: RuleStatus, child: string | null) {
  const what = rule.what.toLowerCase();
  if (rule.op === "at-most") return `${child ?? "Adults"}: ${meals(rule.count - rule.n, what)} too many this week. Swap one for something else.`;
  const missing = rule.n - rule.count;
  const more = `${missing} more ${what} ${missing === 1 ? "meal" : "meals"}`;
  if (child) return `${child} needs ${more} this week. Plan a ${what} dinner and choose Same as dinner, or add a ${what} recipe for ${child}.`;
  return `Adults need ${more} this week. Add a ${what} recipe to the book, then plan it on a free day.`;
}
