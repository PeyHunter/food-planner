import type { Profile, ProfileChange } from "../../shared/profile.ts";
import { call, json } from "../recipes/api.ts";

export const getProfile = () => call<Profile>("/api/profile");
export const saveProfile = (change: ProfileChange) => call<Profile>("/api/profile", json("PUT", change));
