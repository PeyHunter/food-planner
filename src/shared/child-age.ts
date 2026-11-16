import type { Language } from "./profile.ts";

/** Whole months from birthday to `on` (both YYYY-MM-DD). A child born on the 31st turns a month older on the last day of a shorter month. */
export function monthsOld(birthday: string, on: string) {
  const [by, bm, bd] = birthday.split("-").map(Number) as [number, number, number];
  const [y, m, d] = on.split("-").map(Number) as [number, number, number];
  let months = (y - by) * 12 + (m - bm);
  const lastDayOfMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d < bd && d < lastDayOfMonth) months -= 1;
  return Math.max(0, months);
}

const words = {
  en: { under: "under 1 month", month: ["month", "months"], year: ["year", "years"] },
  da: { under: "under 1 måned", month: ["måned", "måneder"], year: ["år", "år"] },
} as const;

/** "7 months", "1 year 2 months", "2 years"; in Danish "7 måneder", "1 år 2 måneder". */
export function ageInWords(months: number, language: Language = "en") {
  const word = words[language];
  const plural = (n: number, [one, many]: readonly [string, string]) => `${n} ${n === 1 ? one : many}`;
  if (months < 1) return word.under;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (!years) return plural(rest, word.month);
  return rest ? `${plural(years, word.year)} ${plural(rest, word.month)}` : plural(years, word.year);
}

export type AgeRange = { ageFromMonths: number | null; ageToMonths: number | null };

/** A range with no end on one side is open on that side. A recipe with no range fits no age. */
export function fitsAge(range: AgeRange, months: number) {
  if (range.ageFromMonths === null && range.ageToMonths === null) return false;
  return (range.ageFromMonths ?? 0) <= months && months <= (range.ageToMonths ?? Infinity);
}

/** "For 6–12 months", "For 6+ months", "For up to 12 months", or null without a range. */
export function ageRangeLabel(range: AgeRange, language: Language = "en") {
  const { ageFromMonths: from, ageToMonths: to } = range;
  const da = language === "da";
  if (from !== null && to !== null) return da ? `${from}–${to} måneder` : `For ${from}–${to} months`;
  if (from !== null) return da ? `Fra ${from} måneder` : `For ${from}+ months`;
  if (to !== null) return da ? `Op til ${to} måneder` : `For up to ${to} months`;
  return null;
}
