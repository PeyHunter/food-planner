import { mainTypes, type RecipeSummary } from "../../shared/recipes.ts";
import { addDays, mondayOf, weekDates } from "../../shared/week.ts";

/** A filter chip: a main type or a tag. */
export type Chip = { kind: "type" | "tag"; value: string };

export const sameChip = (a: Chip, b: Chip) => a.kind === b.kind && a.value === b.value;

/** Every main type, then the tags the book uses, most used first. */
export function chipsFor(recipes: Pick<RecipeSummary, "tags">[]): Chip[] {
  const uses = new Map<string, number>();
  for (const recipe of recipes) for (const tag of recipe.tags) uses.set(tag, (uses.get(tag) ?? 0) + 1);
  const tags = [...uses].sort(([a, aUses], [b, bUses]) => bUses - aUses || a.localeCompare(b)).map(([tag]) => tag);
  return [...mainTypes.map((value) => ({ kind: "type" as const, value })), ...tags.map((value) => ({ kind: "tag" as const, value }))];
}

/** Types pick any of them ("Fish or Chicken"); tags must all be on the recipe ("freezable and kid-friendly"). */
export function filterBook<T extends Pick<RecipeSummary, "types" | "tags">>(recipes: T[], chosen: Chip[]): T[] {
  const types = chosen.filter((chip) => chip.kind === "type").map((chip) => chip.value);
  const tags = chosen.filter((chip) => chip.kind === "tag").map((chip) => chip.value);
  return recipes.filter(
    (recipe) => (!types.length || types.some((type) => (recipe.types as string[]).includes(type))) && tags.every((tag) => recipe.tags.includes(tag)),
  );
}

/** A random page to open the book on, never the one it opened on last time (when there is another). */
export function pickFirstPage(recipes: { id: string }[], lastFirstId: string | null, random = Math.random): number {
  const choices = recipes.flatMap((recipe, index) => (recipe.id === lastFirstId && recipes.length > 1 ? [] : [index]));
  return choices[Math.floor(random() * choices.length)] ?? 0;
}

/** The days "Add to week" offers: today to Sunday, then all of next week. */
export function daysToPick(today: string) {
  const monday = mondayOf(today);
  return {
    thisWeek: { monday, dates: weekDates(monday).filter((date) => date >= today) },
    nextWeek: { monday: addDays(monday, 7), dates: weekDates(addDays(monday, 7)) },
  };
}
