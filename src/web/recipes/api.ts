import type { Ingredient, IngredientRow, IngredientSettings, IngredientSuggestion, PhotoRecipeDraft, Recipe, RecipeInput, RecipeSummary, ShareLink, SharedRecipe } from "../../shared/recipes.ts";
import { childRecipeTag, type FreezerItem } from "../../shared/week.ts";
import { locale, t } from "../i18n.ts";

export async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new Error(t("Can't reach the server right now. Try again in a moment."));
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    // The server answers in English; known messages show in the app's language.
    throw new Error(t(body.error ?? "That didn't work. Try again."));
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const listRecipes = (q: string) => call<RecipeSummary[]>(`/api/recipes?q=${encodeURIComponent(q)}`);
/** The grown-ups' recipe book: Runi's own recipes (tagged "for Runi") live on the Runi & kids tab instead. */
export const listBookRecipes = async (q: string) => (await listRecipes(q)).filter((recipe) => !recipe.tags.includes(childRecipeTag));
export const getRecipe = (id: string) => call<Recipe>(`/api/recipes/${id}`);
export const createRecipe = (input: RecipeInput) => call<{ id: string }>("/api/recipes", json("POST", input));
export const updateRecipe = (id: string, input: RecipeInput) => call<{ id: string }>(`/api/recipes/${id}`, json("PUT", input));
export const deleteRecipe = (id: string) => call<void>(`/api/recipes/${id}`, { method: "DELETE" });
export const listIngredients = (q: string) => call<IngredientRow[]>(`/api/ingredients?all=1&q=${encodeURIComponent(q)}`);
export const saveIngredient = (id: string, settings: IngredientSettings) => call<Ingredient>(`/api/ingredients/${id}`, json("PUT", settings));
export const deleteIngredient = (id: string) => call<void>(`/api/ingredients/${id}`, { method: "DELETE" });
export const getFreezer = () => call<FreezerItem[]>("/api/freezer");
/** A negative `add` takes portions out. */
export const addToFreezer = (recipeId: string, add: number) => call<{ count: number }>(`/api/freezer/${recipeId}`, json("POST", { add }));
export const suggestIngredients = (q: string) => call<IngredientSuggestion[]>(`/api/ingredients?q=${encodeURIComponent(q)}`);

export const turnShareOn = (id: string) => call<ShareLink>(`/api/recipes/${id}/share`, { method: "POST" });
export const turnShareOff = (id: string) => call<ShareLink>(`/api/recipes/${id}/share`, { method: "DELETE" });
export const getShared = (token: string) => call<SharedRecipe>(`/api/share/${encodeURIComponent(token)}`);
export const saveShared = (token: string) => call<{ id: string; alreadyYours: boolean }>(`/api/share/${encodeURIComponent(token)}/save`, { method: "POST" });

/** XMLHttpRequest rather than fetch, because only it reports how much of the photo has been sent. `onProgress` gets 0 to 1. */
export function uploadPhoto(recipeId: string, photo: File, role: "main" | "gallery", onProgress?: (sent: number) => void) {
  const form = new FormData();
  form.set("photo", photo);
  form.set("role", role);
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `/api/recipes/${recipeId}/photos`);
    request.upload.onprogress = (event) => event.lengthComputable && onProgress?.(event.loaded / event.total);
    request.onerror = () => reject(new Error("Can't reach the server right now. Try again in a moment."));
    request.onload = () => {
      if (request.status < 300) return resolve();
      let error: string | undefined;
      try {
        error = (JSON.parse(request.responseText) as { error?: string }).error;
      } catch {}
      reject(new Error(error ?? "That didn't work. Try again."));
    };
    request.send(form);
  });
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

export const showDate = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short" });

export const photoRecipeReady = () => call<{ ready: boolean }>("/api/photo-recipe");

/** Sends 1 to 10 photos of a written recipe; the server reads them into a draft for the edit form. */
const readSide = 2400;

/** A phone photo as a JPEG at most 2400 px on the long side, so ten of them fit in one upload.
 * The server shrinks further to read it; 2400 keeps the cut-out dish picture sharp. Falls back to the original. */
async function shrinkForReading(photo: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(photo, { imageOrientation: "from-image" });
    const scale = Math.min(1, readSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && photo.type === "image/jpeg") return photo;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    return blob ?? photo;
  } catch {
    return photo;
  }
}

export async function readRecipePhotos(photos: File[]) {
  const form = new FormData();
  for (const photo of photos) form.append("photos", await shrinkForReading(photo), photo.name);
  return call<PhotoRecipeDraft>("/api/recipes/from-photo", { method: "POST", body: form });
}

export const go = (path: string) => {
  window.location.hash = path;
};

/** Sends a recipe page's address; the server reads it into a draft for the edit form, like Photo to recipe. */
export const readRecipeLink = (url: string) => call<PhotoRecipeDraft>("/api/recipes/from-link", json("POST", { url: url.trim() }));
