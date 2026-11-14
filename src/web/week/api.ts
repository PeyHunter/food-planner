import type { RuleOp } from "../../shared/rules.ts";
import type { ChildDayKind, WeekView } from "../../shared/week.ts";
import { call, json, today } from "../recipes/api.ts";

export type RuleInput = { childId: string | null; op: RuleOp; n: number; what: string };

export const getWeek = (monday: string) => call<WeekView>(`/api/plan/weeks/${monday}?today=${today()}`);
export const setDinner = (date: string, dinnerRecipeId: string | null) => call<void>(`/api/plan/days/${date}`, json("PUT", { dinnerRecipeId }));
export const setPeople = (date: string, people: number) => call<void>(`/api/plan/days/${date}`, json("PUT", { people }));
export const setChildDay = (date: string, childId: string, kind: ChildDayKind, recipeId?: string) =>
  call<void>(`/api/plan/days/${date}/children/${childId}`, json("PUT", { kind, recipeId }));
export const acceptSuggestion = (id: string) => call<void>("/api/plan/suggestions/accept", json("POST", { id, today: today() }));
export const addRule = (rule: RuleInput) => call<{ id: string }>("/api/rules", json("POST", rule));
export const updateRule = (id: string, rule: RuleInput) => call<{ id: string }>(`/api/rules/${id}`, json("PUT", rule));
export const deleteRule = (id: string) => call<void>(`/api/rules/${id}`, { method: "DELETE" });
