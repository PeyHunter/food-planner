import { checkRules, countFor, mealOf, type Dish, type PlanDay, type Rule } from "./rules.ts";
import { weekdayName } from "./week.ts";

export type SwapRecipe = Dish & { lastMadeOn: string | null; forChildren: boolean };

/** Put `recipeId` on `date`, as the dinner (childId null) or as that child's meal. */
export type Suggestion = { id: string; ruleId: string; childId: string | null; date: string; recipeId: string; text: string };

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
 * Tries empty days before planned ones, and dishes not made for the longest time first.
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
    const open = days.filter((day) => day.date >= today);
    const tryDays = [...open.filter((day) => mealOf(day, childId) === null), ...open.filter((day) => mealOf(day, childId) !== null)];
    const used = new Set(days.map((day) => mealOf(day, childId)?.id).filter(Boolean));
    const fits = ordered.filter((recipe) => recipe.forChildren === (childId !== null) && !used.has(recipe.id));

    found: for (const day of tryDays) {
      for (const recipe of fits) {
        const changed = days.map((other) => (other.date === day.date ? place(other, childId, recipe) : other));
        const count = countFor(missed, changed);
        const better = missed.op === "at-least" ? count > missed.count : count < missed.count;
        if (!better || checkRules(metBefore, changed).some((status) => !status.met)) continue;
        suggestions.push({
          id: `${missed.id}:${day.date}:${recipe.id}`,
          ruleId: missed.id,
          childId,
          date: day.date,
          recipeId: recipe.id,
          text: sentence(missed, count, day, recipe, childId === null ? null : (childNames[childId] ?? "the child")),
        });
        break found;
      }
    }
  }
  return suggestions;
}

function place(day: PlanDay, childId: string | null, dish: Dish): PlanDay {
  if (childId === null) return { ...day, dinner: dish };
  return { ...day, children: { ...day.children, [childId]: { kind: "recipe", dish } } };
}

function sentence(rule: Rule, count: number, day: PlanDay, recipe: Dish, child: string | null) {
  const weekday = weekdayName(day.date);
  const empty = mealOf(day, rule.childId) === null;
  const slot = child ? `${child}'s ${weekday}` : weekday;
  const change = empty ? `Add ${recipe.title} on ${slot}` : `Swap ${slot} for ${recipe.title}`;
  const what = rule.what.toLowerCase();
  const goal = rule.op === "at-least" ? `to get ${what} ${count}/${rule.n}` : `to get ${what} down to ${count}`;
  return `${change} ${goal}`;
}
