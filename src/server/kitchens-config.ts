import { annaKitchenExtras } from "../shared/extra-recipes.ts";
import type { Language } from "../shared/profile.ts";
import type { RecipeInput } from "../shared/recipes.ts";
import type { StartingKitchen, StartingUser } from "./household.ts";

/** One kitchen made at startup. kids: the children's names, empty for a kitchen without kids. */
export type KitchenConfig = {
  logins: string[];
  /** A longer name to show for a login, e.g. annad -> "Anna D". The kitchen name uses it too. */
  displayNames?: Record<string, string>;
  kids: string[];
  language: Language;
  /** Recipes that go in once at creation, on top of the starter recipes. */
  extras?: RecipeInput[];
  /** Set for peyton and ronja's kitchen: it must exist, and it was made before starter recipes. */
  home?: { name: string };
};

/** Every kitchen. One is made once every `<LOGIN>_PASSWORD` env var in it is set; the home kitchen's must be set. */
export const kitchenConfigs: readonly KitchenConfig[] = [
  { logins: ["peyton", "ronja"], kids: ["Runi Lee"], language: "en", home: { name: "Our kitchen" } },
  { logins: ["isabel", "christopher"], kids: [], language: "en" },
  { logins: ["magnus", "mads"], kids: [], language: "en" },
  { logins: ["annad", "mathias"], displayNames: { annad: "Anna D" }, kids: [], language: "en", extras: annaKitchenExtras },
  { logins: ["annaa", "jacob"], displayNames: { annaa: "Anna A" }, kids: [], language: "en", extras: annaKitchenExtras },
  { logins: ["marieke"], kids: [], language: "en" },
  { logins: ["valdemar", "anna"], kids: ["Vilje", "Konrad"], language: "da" },
];

export type ReadyKitchen = StartingKitchen & { people: StartingUser[]; starter: boolean; extras?: RecipeInput[] };

const capitalise = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

function kitchenName(logins: string[], displayNames: Record<string, string>, language: Language) {
  const names = logins.map((login) => displayNames[login] ?? capitalise(login));
  return language === "da" ? `${names.join(" og ")}s køkken` : `${names.join(" and ")}'s kitchen`;
}

/** The kitchens whose passwords are all set, or an error when only some of a kitchen's are (or a home one is missing). */
export function readKitchens(env: NodeJS.ProcessEnv, configs: readonly KitchenConfig[] = kitchenConfigs): ReadyKitchen[] | { error: string } {
  const ready: ReadyKitchen[] = [];
  for (const { logins, displayNames, kids, language, extras, home } of configs) {
    const keys = logins.map((login) => `${login.toUpperCase()}_PASSWORD`);
    const passwords = keys.map((key) => env[key]);
    const setCount = passwords.filter(Boolean).length;
    if (home && setCount < logins.length) return { error: `${keys.join(" and ")} must all be set. They are the starting passwords for the ${logins.length === 1 ? "login" : "logins"}.` };
    if (setCount === 0) continue;
    if (setCount < logins.length) return { error: `Set all of ${keys.join(", ")}, or none.` };
    ready.push({
      name: home?.name ?? kitchenName(logins, displayNames ?? {}, language),
      kids,
      language,
      starter: !home,
      ...(extras ? { extras } : {}),
      people: logins.map((username, index) => ({ username, password: passwords[index]!, ...(displayNames?.[username] ? { displayName: displayNames[username] } : {}) })),
    });
  }
  return ready;
}
