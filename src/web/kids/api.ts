import type { ChildInput, ChildRecipes, ChildView, KidDocument } from "../../shared/children.ts";
import { call, json, today } from "../recipes/api.ts";

export const getChildren = () => call<ChildView[]>(`/api/children?today=${today()}`);
export const addChild = (input: ChildInput) => call<{ id: string }>("/api/children", json("POST", input));
export const updateChild = (id: string, input: ChildInput) => call<{ id: string }>(`/api/children/${id}`, json("PUT", input));
export const getChildRecipes = (id: string) => call<ChildRecipes>(`/api/children/${id}/recipes?today=${today()}`);

export const getKidDocuments = () => call<KidDocument[]>("/api/kid-documents");
export const deleteKidDocument = (id: string) => call<void>(`/api/kid-documents/${id}`, { method: "DELETE" });
export function uploadKidDocument(file: File, title: string) {
  const form = new FormData();
  form.set("file", file);
  form.set("title", title);
  return call<{ id: string }>("/api/kid-documents", { method: "POST", body: form });
}
