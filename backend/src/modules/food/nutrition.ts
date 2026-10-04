import { z } from 'zod';
import type { FoodCtx } from './kitchen';
import { NUTRITION, type Nutrients, type NutritionEntry } from './nutrition-data';
import { productsByIds, type Product } from './products';
import { toBase } from './units';

/**
 * What food holds: energy (kcal), protein, fat, carbohydrates (sugar, fibre, salt when known).
 * An item's values are its own (the household's, from a label or Claude's search) or else the
 * catalog's typical ones; a kind can differ (Cola Zero has none). Values are per 100 g, per
 * 100 ml, or per piece; amounts in the kitchen's units convert through the item's piece weight.
 */

export type { Nutrients, NutritionEntry };

export const NUTRIENT_KEYS = ['kcal', 'protein', 'fat', 'carbs', 'sugar', 'fiber', 'salt'] as const;

const nutrientField = z.number().min(0).max(5000);
export const NutrientsInput = z.object({
  kcal: nutrientField,
  protein: nutrientField,
  fat: nutrientField,
  carbs: nutrientField,
  sugar: nutrientField.optional(),
  fiber: nutrientField.optional(),
  salt: nutrientField.optional(),
});

export const NutritionInput = z
  .object({
    per: z
      .enum(['100g', '100ml', 'piece'])
      .describe('What the numbers are for: 100 g, 100 ml or one piece'),
    base: NutrientsInput,
    kinds: z
      .record(z.string().max(40), NutrientsInput)
      .optional()
      .describe('Kinds that differ (Zero, 2.5%…)'),
  })
  .nullable()
  .describe('Per 100 g / 100 ml / piece; null goes back to the catalog’s typical values');

export interface Nutrition {
  entry: NutritionEntry;
  source: 'own' | 'catalog';
}

/** The values that count for an item: its own, else the catalog's (by its catalog name). */
export function nutritionOf(product: {
  name: string;
  ownNutrition?: NutritionEntry | null;
}): Nutrition | null {
  if (product.ownNutrition) return { entry: product.ownNutrition, source: 'own' };
  const catalog = NUTRITION[product.name];
  return catalog ? { entry: catalog, source: 'catalog' } : null;
}

/** The values for one kind (case-insensitive), else the item's base values. */
export function kindValues(entry: NutritionEntry, variant: string | null | undefined): Nutrients {
  if (variant && entry.kinds) {
    const wanted = variant.toLowerCase();
    const found = Object.entries(entry.kinds).find(([kind]) => kind.toLowerCase() === wanted);
    if (found) return found[1];
  }
  return entry.base;
}

const ZERO: Nutrients = { kcal: 0, protein: 0, fat: 0, carbs: 0 };

export function addNutrients(a: Nutrients, b: Nutrients, times = 1): Nutrients {
  const out: Nutrients = { ...a };
  for (const key of NUTRIENT_KEYS) {
    const value = (b[key] ?? 0) * times;
    if (key === 'sugar' || key === 'fiber' || key === 'salt') {
      if (b[key] === undefined && a[key] === undefined) continue;
      out[key] = (a[key] ?? 0) + value;
    } else out[key] = a[key] + value;
  }
  return out;
}

export const roundNutrients = (n: Nutrients): Nutrients =>
  Object.fromEntries(
    Object.entries(n as unknown as Record<string, number>).map(([k, v]) => [
      k,
      k === 'kcal' ? Math.round(v) : Math.round(v * 10) / 10,
    ]),
  ) as unknown as Nutrients;

/**
 * How much of the values an amount holds. Base amounts are in the item's base unit: grams and
 * millilitres count as 100 g / 100 ml (1 g ≈ 1 ml when the values are the other one); pieces
 * count through the piece weight, or as pieces when the values are per piece.
 */
export function factorFor(
  product: Pick<Product, 'unit' | 'pieceSize'>,
  per: NutritionEntry['per'],
  baseAmount: number,
): number | null {
  if (per === 'piece') {
    if (product.unit === 'pcs') return baseAmount;
    return product.pieceSize ? baseAmount / product.pieceSize : null;
  }
  const grams =
    product.unit === 'pcs'
      ? product.pieceSize
        ? baseAmount * product.pieceSize
        : null
      : baseAmount;
  return grams === null ? null : grams / 100;
}

/** The nutrients in an amount of an item (in any of its units), or null when its values are unknown. */
export function nutrientsIn(
  product: Product,
  amount: number,
  unit: string | null,
  variant?: string | null,
): Nutrients | null {
  const n = nutritionOf(product);
  if (!n) return null;
  let base: number;
  try {
    base = toBase(amount, unit ?? product.unit, product);
  } catch {
    return null;
  }
  const factor = factorFor(product, n.entry.per, base);
  if (factor === null) return null;
  return addNutrients(ZERO, kindValues(n.entry, variant), factor);
}

export interface LineForNutrition {
  productId: string | null;
  name: string;
  amount: number | null;
  unit: string | null;
  variant?: string | null;
  optional?: boolean;
}

export interface DishNutrition {
  total: Nutrients;
  /** Lines with an amount whose values are known, of all lines with an amount. */
  known: number;
  counted: number;
  /** Lines left out: no values for the item, or no amount ("to taste"). */
  unknown: string[];
}

/** The sum over lines, with the items at hand. */
export function sumLines(
  lines: LineForNutrition[],
  productOf: (id: string) => Product | undefined,
): DishNutrition {
  let total: Nutrients = { ...ZERO };
  let known = 0;
  let counted = 0;
  const unknown: string[] = [];
  for (const line of lines) {
    // Optional lines and "to taste" ones have nothing to count, and nothing to warn about.
    if (line.optional || line.amount === null || line.amount === undefined) continue;
    counted++;
    const product = line.productId ? productOf(line.productId) : undefined;
    const n = product ? nutrientsIn(product, line.amount, line.unit, line.variant) : null;
    if (!n) {
      unknown.push(line.name);
      continue;
    }
    known++;
    total = addNutrients(total, n);
  }
  return { total: roundNutrients(total), known, counted, unknown };
}

/** The sum over ingredient lines, loading the items they use. */
export async function linesNutrition(
  ctx: FoodCtx,
  lines: LineForNutrition[],
): Promise<DishNutrition> {
  const ids = [...new Set(lines.map((l) => l.productId).filter((id): id is string => Boolean(id)))];
  const products = new Map((await productsByIds(ctx, ids)).map((p) => [p.id, p]));
  return sumLines(lines, (id) => products.get(id));
}

/** A described line as it will be cooked: the option chosen (an alternative) or the main item. */
export function lineAsCooked(line: {
  productId: string | null;
  name: string;
  amount: number | null;
  unit: string | null;
  variant: string;
  optional: boolean;
  chosen: number;
  alternatives: Array<{
    productId: string | null;
    name: string;
    amount: number | null;
    unit: string | null;
    variant: string;
  }>;
}): LineForNutrition {
  const alt = line.chosen > 0 ? line.alternatives[line.chosen - 1] : undefined;
  return alt
    ? {
        productId: alt.productId,
        name: alt.name,
        amount: alt.amount,
        unit: alt.unit,
        variant: alt.variant,
        optional: line.optional,
      }
    : {
        productId: line.productId,
        name: line.name,
        amount: line.amount,
        unit: line.unit,
        variant: line.variant,
        optional: line.optional,
      };
}

/** A dish's nutrition: the whole and one serving, and how much of it is known. */
export interface DishSummary {
  perServing: Nutrients;
  total: Nutrients;
  known: number;
  counted: number;
  unknown: string[];
}

export function dishSummary(dish: DishNutrition, servings: number): DishSummary {
  return { ...dish, perServing: perServing(dish, servings) };
}

/** Per serving, rounded. */
export function perServing(dish: DishNutrition, servings: number): Nutrients {
  const out = { ...dish.total };
  for (const key of NUTRIENT_KEYS)
    if (out[key] !== undefined) out[key] = out[key]! / Math.max(1, servings);
  return roundNutrients(out);
}
