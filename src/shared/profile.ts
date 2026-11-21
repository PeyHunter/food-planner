export const languages = ["en", "da"] as const;
export type Language = (typeof languages)[number];
export const isLanguage = (value: unknown): value is Language => (languages as readonly unknown[]).includes(value);

/**
 * Your own language, and the kitchen's settings both of you share.
 * nemlig: sending the shopping list to nemlig.com. The app only opens nemlig's pages; you fill the basket and pay there.
 */
export type Profile = {
  language: Language;
  kids: boolean;
  nemlig: { on: boolean; day: number; organic: Organic };
};
/** Which items get "økologisk" in the nemlig.com search: none, fruit and veg, or everything. */
export const organicChoices = ["none", "produce", "all"] as const;
export type Organic = (typeof organicChoices)[number];
export const isOrganic = (value: unknown): value is Organic => (organicChoices as readonly unknown[]).includes(value);
export type ProfileChange = Partial<Pick<Profile, "language" | "kids">> & { nemlig?: Partial<Profile["nemlig"]> };

/** nemlig.com's own search, so each item opens there. Organic adds "økologisk" to the search. */
export const nemligSearchUrl = (name: string, organic: boolean) => `https://www.nemlig.com/?search=${encodeURIComponent(organic ? `økologisk ${name}` : name)}`;
