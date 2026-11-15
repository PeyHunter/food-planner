import type { ChildInput, ChildRecipes, ChildView } from "../../shared/children.ts";
import { call, json, today } from "../recipes/api.ts";

export const getChildren = () => call<ChildView[]>(`/api/children?today=${today()}`);
export const addChild = (input: ChildInput) => call<{ id: string }>("/api/children", json("POST", input));
export const updateChild = (id: string, input: ChildInput) => call<{ id: string }>(`/api/children/${id}`, json("PUT", input));
export const getChildRecipes = (id: string) => call<ChildRecipes>(`/api/children/${id}/recipes?today=${today()}`);
