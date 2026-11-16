export const languages = ["en", "da"] as const;
export type Language = (typeof languages)[number];
export const isLanguage = (value: unknown): value is Language => (languages as readonly unknown[]).includes(value);

/**
 * Your own language, and the kitchen's settings both of you share.
 * nemlig: getting ready to send the shopping list to nemlig.com for home delivery. Nothing is sent yet.
 */
export type Profile = {
  language: Language;
  kids: boolean;
  nemlig: { on: boolean; day: number; organic: boolean };
};
export type ProfileChange = Partial<Pick<Profile, "language" | "kids">> & { nemlig?: Partial<Profile["nemlig"]> };

/** nemlig.com's own search, so each item opens there. Organic adds "økologisk" to the search. */
export const nemligSearchUrl = (name: string, organic: boolean) => `https://www.nemlig.com/?search=${encodeURIComponent(organic ? `økologisk ${name}` : name)}`;
