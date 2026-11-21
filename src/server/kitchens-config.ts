import type { Language } from "../shared/profile.ts";
import type { StartingKitchen, StartingUser } from "./household.ts";

/** One kitchen made at startup. kids: the children's names, empty for a kitchen without kids. */
export type KitchenConfig = {
  logins: string[];
  kids: string[];
  language: Language;
  /** Set for peyton and ronja's kitchen: it must exist, and it was made before starter recipes. */
  home?: { name: string };
};

/** Every kitchen. One is made once every `<LOGIN>_PASSWORD` env var in it is set; the home kitchen's must be set. */
export const kitchenConfigs: readonly KitchenConfig[] = [
  { logins: ["peyton", "ronja"], kids: ["Runi Lee"], language: "en", home: { name: "Our kitchen" } },
  { logins: ["isabel", "christopher"], kids: [], language: "en" },
  { logins: ["magnus", "mads"], kids: [], language: "en" },
  { logins: ["marieke"], kids: [], language: "en" },
  { logins: ["valdemar", "anna"], kids: ["Vilje", "Konrad"], language: "da" },
];

export type ReadyKitchen = StartingKitchen & { people: StartingUser[]; starter: boolean };

const capitalise = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

function kitchenName(logins: string[], language: Language) {
  const names = logins.map(capitalise);
  return language === "da" ? `${names.join(" og ")}s køkken` : `${names.join(" and ")}'s kitchen`;
}

/** The kitchens whose passwords are all set, or an error when only some of a kitchen's are (or a home one is missing). */
export function readKitchens(env: NodeJS.ProcessEnv, configs: readonly KitchenConfig[] = kitchenConfigs): ReadyKitchen[] | { error: string } {
  const ready: ReadyKitchen[] = [];
  for (const { logins, kids, language, home } of configs) {
    const keys = logins.map((login) => `${login.toUpperCase()}_PASSWORD`);
    const passwords = keys.map((key) => env[key]);
    const setCount = passwords.filter(Boolean).length;
    if (home && setCount < logins.length) return { error: `${keys.join(" and ")} must all be set. They are the starting passwords for the ${logins.length === 1 ? "login" : "logins"}.` };
    if (setCount === 0) continue;
    if (setCount < logins.length) return { error: `Set all of ${keys.join(", ")}, or none.` };
    ready.push({
      name: home?.name ?? kitchenName(logins, language),
      kids,
      language,
      starter: !home,
      people: logins.map((username, index) => ({ username, password: passwords[index]! })),
    });
  }
  return ready;
}
