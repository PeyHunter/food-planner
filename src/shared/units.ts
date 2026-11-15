export const units = ["g", "kg", "ml", "dl", "l", "pcs"] as const;
export type Unit = (typeof units)[number];
export type Kind = "mass" | "volume" | "pcs";

// Size of each unit in its kind's base unit (g for mass, ml for volume).
const table: Record<Unit, { kind: Kind; base: number }> = {
  g: { kind: "mass", base: 1 },
  kg: { kind: "mass", base: 1000 },
  ml: { kind: "volume", base: 1 },
  dl: { kind: "volume", base: 100 },
  l: { kind: "volume", base: 1000 },
  pcs: { kind: "pcs", base: 1 },
};

export const isUnit = (value: unknown): value is Unit => typeof value === "string" && Object.hasOwn(table, value);

export const kindOf = (unit: Unit) => table[unit].kind;

/** Mass converts to mass, volume to volume. Pieces never convert. */
export function canConvert(from: Unit, to: Unit) {
  if (from === to) return true;
  const [a, b] = [kindOf(from), kindOf(to)];
  return a !== "pcs" && a === b;
}

export function convert(amount: number, from: Unit, to: Unit) {
  if (!canConvert(from, to)) throw new Error(`Can't convert ${from} to ${to}`);
  return (amount * table[from].base) / table[to].base;
}

// Float error must not push an exact amount (e.g. 0.1 * 3 * 1000) up a whole step.
const ceilTo = (amount: number, step: number) => Math.ceil(amount / step - 1e-9) * step;

/** g and ml go up to 1 below 10 (spice amounts), 5 below 100, 25 below 1000, 50 above. */
function tidyStep(amount: number) {
  if (amount < 10) return 1;
  if (amount < 100) return 5;
  if (amount < 1000) return 25;
  return 50;
}

/** Rounds a scaled amount up: pcs to whole, g/ml (and kg, dl, l through them) to a tidy step. */
export function roundUp(amount: number, unit: Unit) {
  if (amount <= 0) return 0;
  const { kind, base } = table[unit];
  if (kind === "pcs") return ceilTo(amount, 1);
  const inBase = amount * base;
  // Avoid trailing float noise like 1.2500000000000002 kg.
  return Number((ceilTo(inBase, tidyStep(inBase)) / base).toFixed(6));
}

/** Scales an amount written for `from` people to `to` people. The recipe's own amounts stay exactly as written. */
export function scale(amount: number, unit: Unit, from: number, to: number) {
  if (from === to) return amount;
  return roundUp((amount * to) / from, unit);
}

const fractions: Record<string, string> = { "0.25": "¼", "0.5": "½", "0.75": "¾" };

/** 1.5 → "1½", 0.5 → "½", 2 → "2", 1.25 → "1¼", 0.333 → "0.33". g and ml stay decimal: 2.5 ml, not 2½ ml. */
export function formatAmount(amount: number, unit?: Unit) {
  if (unit === "g" || unit === "ml") return String(Number(amount.toFixed(amount < 10 ? 2 : 1)));
  const whole = Math.floor(amount);
  const fraction = fractions[String(Number((amount - whole).toFixed(2)))];
  if (fraction) return `${whole || ""}${fraction}`;
  return String(Number(amount.toFixed(2)));
}
