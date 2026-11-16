import { danish } from "./danish.ts";
import type { Language } from "./profile.ts";

/**
 * Text is written in English in the code. In Danish, the English text is looked up in `danish`; text not there yet
 * stays English. {name} in the text is filled from `values`.
 */
export function translate(language: Language, text: string, values?: Record<string, string | number>) {
  const template = language === "da" ? (danish[text] ?? text) : text;
  return values ? template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole)) : template;
}

export const localeOf = (language: Language) => (language === "da" ? "da-DK" : "en-GB");
