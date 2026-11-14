import type { IngredientSuggestion, Recipe, RecipeInput, RecipeSummary, ShareLink } from "../../shared/recipes.ts";

export async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new Error("Can't reach the server right now. Try again in a moment.");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "That didn't work. Try again.");
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const listRecipes = (q: string) => call<RecipeSummary[]>(`/api/recipes?q=${encodeURIComponent(q)}`);
export const getRecipe = (id: string) => call<Recipe>(`/api/recipes/${id}`);
export const createRecipe = (input: RecipeInput) => call<{ id: string }>("/api/recipes", json("POST", input));
export const updateRecipe = (id: string, input: RecipeInput) => call<{ id: string }>(`/api/recipes/${id}`, json("PUT", input));
export const deleteRecipe = (id: string) => call<void>(`/api/recipes/${id}`, { method: "DELETE" });
export const suggestIngredients = (q: string) => call<IngredientSuggestion[]>(`/api/ingredients?q=${encodeURIComponent(q)}`);

export const getShareLink = (id: string) => call<ShareLink>(`/api/recipes/${id}/share`);
export const turnShareOn = (id: string) => call<ShareLink>(`/api/recipes/${id}/share`, { method: "POST" });
export const turnShareOff = (id: string) => call<ShareLink>(`/api/recipes/${id}/share`, { method: "DELETE" });

export function uploadPhoto(recipeId: string, photo: File, role: "main" | "gallery") {
  const form = new FormData();
  form.set("photo", photo);
  form.set("role", role);
  return call(`/api/recipes/${recipeId}/photos`, { method: "POST", body: form });
}

export function logCook(recipeId: string, madeOn: string, photos: File[]) {
  const form = new FormData();
  form.set("madeOn", madeOn);
  for (const photo of photos) form.append("photos", photo);
  return call(`/api/recipes/${recipeId}/cooks`, { method: "POST", body: form });
}

/** Today on the phone's own calendar, as YYYY-MM-DD. */
export function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export const showDate = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

export const go = (path: string) => {
  window.location.hash = path;
};
