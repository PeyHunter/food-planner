/** "at least / at most N per week with main type or tag X", for the adults (childId null) or one child. */
export type RuleOp = "at-least" | "at-most";
export type Rule = { id: string; childId: string | null; op: RuleOp; n: number; what: string };
export type RuleStatus = Rule & { count: number; met: boolean };

export type Dish = { id: string; title: string; types: readonly string[]; tags: readonly string[] };
export type ChildMeal = { kind: "empty" } | { kind: "same-as-dinner" } | { kind: "recipe"; dish: Dish };
export type PlanDay = { date: string; dinner: Dish | null; children: Record<string, ChildMeal> };

export const ruleOps: RuleOp[] = ["at-least", "at-most"];

/** Main types and tags compare without case, so the rule "Freezable" matches the tag "freezable". */
export const matches = (dish: Dish, what: string) => {
  const wanted = what.toLowerCase();
  return [...dish.types, ...dish.tags].some((value) => value.toLowerCase() === wanted);
};

/** What the adults (childId null) or a child eats that day. "Same as dinner" is the dinner. */
export function mealOf(day: PlanDay, childId: string | null): Dish | null {
  if (childId === null) return day.dinner;
  const meal = day.children[childId] ?? { kind: "empty" };
  if (meal.kind === "same-as-dinner") return day.dinner;
  return meal.kind === "recipe" ? meal.dish : null;
}

export const countFor = (rule: Rule, days: PlanDay[]) =>
  days.filter((day) => {
    const dish = mealOf(day, rule.childId);
    return dish !== null && matches(dish, rule.what);
  }).length;

export const isMet = (rule: Rule, count: number) => (rule.op === "at-least" ? count >= rule.n : count <= rule.n);

export function checkRules(rules: Rule[], days: PlanDay[]): RuleStatus[] {
  return rules.map((rule) => {
    const count = countFor(rule, days);
    return { ...rule, count, met: isMet(rule, count) };
  });
}

/** "Runi Lee: Fish at least 2 a week" */
export const ruleSentence = (rule: Pick<Rule, "op" | "n" | "what">, who: string) =>
  `${who}: ${rule.what} ${rule.op === "at-least" ? "at least" : "at most"} ${rule.n} a week`;
