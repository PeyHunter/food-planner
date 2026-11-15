/** Whole months from birthday to `on` (both YYYY-MM-DD). A child born on the 31st turns a month older on the last day of a shorter month. */
export function monthsOld(birthday: string, on: string) {
  const [by, bm, bd] = birthday.split("-").map(Number) as [number, number, number];
  const [y, m, d] = on.split("-").map(Number) as [number, number, number];
  let months = (y - by) * 12 + (m - bm);
  const lastDayOfMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d < bd && d < lastDayOfMonth) months -= 1;
  return Math.max(0, months);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "7 months", "1 year 2 months", "2 years". */
export function ageInWords(months: number) {
  if (months < 1) return "under 1 month";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (!years) return plural(rest, "month");
  return rest ? `${plural(years, "year")} ${plural(rest, "month")}` : plural(years, "year");
}

export type AgeRange = { ageFromMonths: number | null; ageToMonths: number | null };

/** A range with no end on one side is open on that side. A recipe with no range fits no age. */
export function fitsAge(range: AgeRange, months: number) {
  if (range.ageFromMonths === null && range.ageToMonths === null) return false;
  return (range.ageFromMonths ?? 0) <= months && months <= (range.ageToMonths ?? Infinity);
}

/** "For 6–12 months", "For 6+ months", "For up to 12 months", or null without a range. */
export function ageRangeLabel(range: AgeRange) {
  const { ageFromMonths: from, ageToMonths: to } = range;
  if (from !== null && to !== null) return `For ${from}–${to} months`;
  if (from !== null) return `For ${from}+ months`;
  if (to !== null) return `For up to ${to} months`;
  return null;
}
