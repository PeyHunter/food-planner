import type { Remembered } from "../../shared/nemlig.ts";
import type { ShoppingView } from "../../shared/shopping.ts";
import { call, json } from "../recipes/api.ts";

export const getShopping = (monday: string, days: string[]) => call<ShoppingView>(`/api/shopping/${monday}?days=${days.join(",")}`);
export const setTick = (monday: string, key: string, ticked: boolean) => call<void>(`/api/shopping/${monday}/ticks`, json("PUT", { key, ticked }));
export const addExtra = (monday: string, name: string) => call<{ id: string }>(`/api/shopping/${monday}/extras`, json("POST", { name }));
export const removeExtra = (monday: string, id: string) => call<void>(`/api/shopping/${monday}/extras/${id}`, { method: "DELETE" });
export const clearTicked = (monday: string) => call<void>(`/api/shopping/${monday}/clear`, { method: "POST" });
export const bringBack = (monday: string) => call<void>(`/api/shopping/${monday}/bring-back`, { method: "POST" });
export const boughtAll = (monday: string, keys: string[]) => call<void>(`/api/shopping/${monday}/bought`, json("POST", { keys }));
export const getRemembered = () => call<Record<string, Remembered>>("/api/nemlig/remembered");
export const remember = (ingredientId: string, change: Partial<Remembered>) => call<Remembered>(`/api/nemlig/ingredients/${ingredientId}`, json("PUT", change));
