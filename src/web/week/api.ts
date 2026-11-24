import type { ReduceWaste } from "../../shared/reduce-waste.ts";
import type { RuleOp } from "../../shared/rules.ts";
import type { Away, ChildDayKind, CreatedWeek, WeekView } from "../../shared/week.ts";
import { call, json, today } from "../recipes/api.ts";

export type RuleInput = { childId: string | null; op: RuleOp; n: number; what: string };

export const getWeek = (monday: string) => call<WeekView>(`/api/plan/weeks/${monday}?today=${today()}`);
export const setDinner = (date: string, dinnerRecipeId: string | null, fromFreezer = false) =>
  call<void>(`/api/plan/days/${date}`, json("PUT", { dinnerRecipeId, fromFreezer }));
export const setAway = (date: string, away: Away) => call<void>(`/api/plan/days/${date}`, json("PUT", { away }));
export const addSide = (date: string, recipeId: string) => call<void>(`/api/plan/days/${date}/sides`, json("POST", { recipeId }));
export const removeSide = (date: string, position: number) => call<void>(`/api/plan/days/${date}/sides/${position}`, { method: "DELETE" });
export const setPeople = (date: string, people: number) => call<void>(`/api/plan/days/${date}`, json("PUT", { people }));
export const setChildDay = (date: string, childId: string, kind: ChildDayKind, recipeId?: string, fromFreezer?: boolean) =>
  call<void>(`/api/plan/days/${date}/children/${childId}`, json("PUT", { kind, recipeId, fromFreezer }));
export const acceptSuggestion = (id: string) => call<void>("/api/plan/suggestions/accept", json("POST", { id, today: today() }));
export const addRule = (rule: RuleInput) => call<{ id: string }>("/api/rules", json("POST", rule));
export const updateRule = (id: string, rule: RuleInput) => call<{ id: string }>(`/api/rules/${id}`, json("PUT", rule));
export const deleteRule = (id: string) => call<void>(`/api/rules/${id}`, { method: "DELETE" });
export const createWeek = (monday: string) => call<CreatedWeek>(`/api/plan/weeks/${monday}/create`, json("POST", { today: today() }));
export const undoCreateWeek = (monday: string, fills: CreatedWeek["fills"]) => call<void>(`/api/plan/weeks/${monday}/undo-create`, json("POST", { fills }));
export const reduceWaste = (monday: string) => call<ReduceWaste>(`/api/plan/weeks/${monday}/reduce-waste`, json("POST", { today: today() }));
