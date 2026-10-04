/**
 * Quantities. Every product counts in one base unit — pieces, grams or millilitres — and stock is
 * stored in it. People and recipes speak in more units than that (1.3 kg, 2 tbsp, 200 g of
 * tomatoes); these helpers convert, and refuse what cannot be converted rather than guess.
 */

export const BASE_UNITS = ['pcs', 'g', 'ml'] as const;
export type BaseUnit = (typeof BASE_UNITS)[number];

export const UNITS = ['pcs', 'g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup'] as const;
export type Unit = (typeof UNITS)[number];

type Family = 'count' | 'mass' | 'volume';

const MEASURES: Record<Unit, { family: Family; factor: number }> = {
  pcs: { family: 'count', factor: 1 },
  g: { family: 'mass', factor: 1 },
  kg: { family: 'mass', factor: 1000 },
  ml: { family: 'volume', factor: 1 },
  l: { family: 'volume', factor: 1000 },
  tsp: { family: 'volume', factor: 5 },
  tbsp: { family: 'volume', factor: 15 },
  cup: { family: 'volume', factor: 240 },
};

const BASE_FAMILY: Record<BaseUnit, Family> = { pcs: 'count', g: 'mass', ml: 'volume' };

/** A unit of the item's own: a slice of bread, a pack of pasta, a square of processed cheese. */
export interface CustomUnit {
  name: string;
  /** Plural, when it isn't name + "s" (e.g. "boxes"). */
  plural?: string;
  /** How much one usually holds, in the item's base unit (a loaf = 20 slices; a jar of honey = 400 g). */
  size: number;
  /** The sizes it comes in, to pick from when adding one (a bottle of cola: 500, 1000, 1250… ml). */
  sizes?: number[];
}

/** What a product says about its own unit: the base, how big one piece is, and its own units. */
export interface Measured {
  unit: BaseUnit;
  /** One piece in grams or millilitres (pieceUnit): a tomato ≈ 120 g, a bottle = 1500 ml. */
  pieceSize: number | null;
  pieceUnit: 'g' | 'ml' | null;
  units?: CustomUnit[];
  /** Its kind: things poured or spooned (dairy, drinks, sauces, pantry) convert between grams and millilitres. */
  category?: string;
}

/** Kinds weighed and poured alike: 300 g of milk is about 300 ml; a litre of steak is nothing. */
const POURABLE = new Set(['dairy', 'drinks', 'spices', 'pantry']);

/** The item's own unit a word names ("slice", "Slices"), if any. */
export function customUnit(unit: string, product: Measured): CustomUnit | null {
  const word = unit.trim().toLowerCase();
  return (
    product.units?.find(
      (u) => u.name.toLowerCase() === word || (u.plural ?? `${u.name}s`).toLowerCase() === word,
    ) ?? null
  );
}

export class UnitMismatchError extends Error {
  constructor(unit: string, product: Measured) {
    super(
      `This item is counted in ${product.unit}; ${unit} can’t be converted${product.pieceSize ? '' : ' without a piece size'}`,
    );
    this.name = 'UnitMismatchError';
  }
}

/** Three decimals: enough for 0.833 of a tomato, and no 0.30000000000000004. */
export const round = (value: number) => Math.round(value * 1000) / 1000;

/** How many base units one unit of `unit` is for this product, or null when not convertible. */
function factorOf(unit: string, product: Measured): number | null {
  const custom = customUnit(unit, product);
  if (custom) return custom.size;
  const measure = MEASURES[unit as Unit];
  if (!measure) return null;
  const base = BASE_FAMILY[product.unit];
  if (measure.family === base) return measure.factor;
  // Spoons and cups of something weighed: about a gram per millilitre, unless the item says (honey: 21 g a tablespoon).
  if (base === 'mass' && (unit === 'tsp' || unit === 'tbsp' || unit === 'cup'))
    return measure.factor;
  // Grams of milk, millilitres of honey: about the same, for things poured or spooned.
  if (
    product.category &&
    POURABLE.has(product.category) &&
    ((base === 'mass' && measure.family === 'volume') ||
      (base === 'volume' && measure.family === 'mass'))
  ) {
    return measure.factor;
  }
  if (!product.pieceSize || product.pieceSize <= 0) return null;
  if (product.unit === 'pcs') {
    // 240 g of tomatoes = 2 pieces, when one piece is 120 g.
    const pieceFamily = BASE_FAMILY[product.pieceUnit ?? 'g'];
    return measure.family === pieceFamily ? measure.factor / product.pieceSize : null;
  }
  // 2 bottles of water = 3000 ml, when one bottle is 1500 ml.
  return measure.family === 'count' ? product.pieceSize : null;
}

export function canConvert(unit: string, product: Measured): boolean {
  return factorOf(unit, product) !== null;
}

/** `quantity` of `unit` in the product's base unit. Throws UnitMismatchError when impossible. */
export function toBase(quantity: number, unit: string, product: Measured): number {
  const factor = factorOf(unit, product);
  if (factor === null) throw new UnitMismatchError(unit, product);
  return round(quantity * factor);
}

/** A base quantity expressed in `unit` (the reverse of toBase). */
export function amountIn(base: number, unit: string, product: Measured): number {
  const factor = factorOf(unit, product);
  if (factor === null) throw new UnitMismatchError(unit, product);
  return round(base / factor);
}

/** The unit a person would say for this amount: 1.3 kg rather than 1300 g, 300 g rather than 0.3 kg. */
export function displayUnit(base: number, product: Measured): Unit {
  if (product.unit === 'g') return Math.abs(base) >= 1000 ? 'kg' : 'g';
  if (product.unit === 'ml') return Math.abs(base) >= 1000 ? 'l' : 'ml';
  return 'pcs';
}

export function isUnit(value: unknown): value is Unit {
  return typeof value === 'string' && (UNITS as readonly string[]).includes(value);
}
