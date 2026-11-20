import type { Unit } from "./units.ts";

/**
 * How a Danish shop sells one grocery: the usual pack, grams in one piece when recipes count it, and the words that find it on nemlig.com.
 * Sizes are from Netto, Rema 1000, Meny, Lidl and nemlig.com (docs/research/danish-pack-sizes.md).
 */
export type Pack = { amount: number; unit: Unit; pieceGrams?: number; nemlig?: string };

/** Bump when the sizes change, so kitchens' ingredients that still use the catalog's sizes get the new ones. */
export const packsVersion = 1;

type Row = [amount: number, unit: Unit, pieceGrams?: number | null, nemlig?: string];

// Keyed by the grocery's first English name in groceries.ts.
const rows: Record<string, Row> = {};

export function packOf(name: string): Pack | undefined {
  const row = rows[name];
  if (!row) return undefined;
  const [amount, unit, pieceGrams, nemlig] = row;
  return { amount, unit, ...(pieceGrams ? { pieceGrams } : {}), ...(nemlig ? { nemlig } : {}) };
}

/** Every key, so a test can check each one names a grocery. */
export const packNames = () => Object.keys(rows);
