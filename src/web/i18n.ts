import { localeOf, translate } from "../shared/i18n.ts";
import { isLanguage, type Language } from "../shared/profile.ts";

const key = "language";

/** Remembered on the phone too, so the login screen and the first paint are in the right language. */
let language: Language = (() => {
  try {
    const stored = localStorage.getItem(key);
    return isLanguage(stored) ? stored : "en";
  } catch {
    return "en";
  }
})();

export const t = (text: string, values?: Record<string, string | number>) => translate(language, text, values);
export const currentLanguage = () => language;
export const locale = () => localeOf(language);

/** Returns true when the language changed. Some text is made once when the app starts, so the caller reloads the page then. */
export function switchLanguage(next: Language) {
  if (next === language) return false;
  language = next;
  try {
    localStorage.setItem(key, next);
  } catch {
    // Not remembered; the server still knows it.
  }
  return true;
}
