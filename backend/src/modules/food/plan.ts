import { ingredientRows, neededBase, stockSnapshot } from './ingredients';
import type { FoodCtx } from './kitchen';
import { CATEGORIES, type Category, type FoodIcon } from './presets';
import type { Product } from './products';
import { toBase, amountIn, canConvert, displayUnit, round, type BaseUnit, type Unit } from './units';

/**
 * What the plan needs from the shops: for the planned meals between two days, every ingredient
 * added up per item, minus what is in the kitchen and what is already on a list. Lines that are
 * covered stay in the answer (so they can be checked at home), with nothing to buy.
 */

export interface NeedLine {
  productId: string;
  name: string;
  icon: FoodIcon;
  category: Category;
  unit: BaseUnit;
  needed: number;
  inStock: number;
  onList: number;
  toBuy: number;
  /** toBuy said the way a person would ("1.25 kg"). */
  toBuyAmount: number;
  toBuyUnit: Unit;
  storeId: string | null;
  /** Level items: low or out (toBuy is then one, with no amount). */
  level: 'low' | 'out' | null;
  meals: Array<{ id: string; title: string; date: string }>;
}

function levelLine(product: Product, total: number): NeedLine {
  return {
    productId: product.id,
    name: product.name,
    icon: product.icon,
    category: product.category,
    unit: product.unit,
    needed: 0,
    inStock: round(total),
    onList: 0,
    toBuy: 1,
    toBuyAmount: 1,
    toBuyUnit: 'pcs',
    storeId: product.storeId,
    level: product.level === 'full' ? null : product.level,
    meals: [],
  };
}

export async function planNeeds(ctx: FoodCtx, from: string, to: string): Promise<{ lines: NeedLine[]; toCheck: Array<{ name: string; meal: string }> }> {
  const { rows: meals } = await ctx.db.query<{ id: string; title: string; date: string }>(
    `SELECT id, title, date FROM meals WHERE household_id = $1 AND status = 'planned' AND date BETWEEN $2 AND $3 ORDER BY date`,
    [ctx.actor.householdId, from, to],
  );
  const stock = await stockSnapshot(ctx);
  const ingredients = await ingredientRows(ctx, 'meal_ingredients', meals.map((m) => m.id));
  const lines = new Map<string, NeedLine>();
  const toCheck: Array<{ name: string; meal: string }> = [];

  for (const meal of meals) {
    for (const row of ingredients.get(meal.id) ?? []) {
      if (row.optional) continue;
      const info = row.product_id ? stock.get(row.product_id) : undefined;
      if (!info || info.product.trackMode === 'none') continue;
      const product = info.product;
      if (product.trackMode === 'level') {
        // Not measured: on the list when it is low or out.
        if (product.level === 'full') continue;
        const line = lines.get(product.id) ?? levelLine(product, info.total);
        if (!line.meals.some((m) => m.id === meal.id)) line.meals.push(meal);
        lines.set(product.id, line);
        continue;
      }
      let needed = neededBase(row, product);
      if (needed === null) {
        // "Some parsley": one piece when the item comes in pieces; otherwise just check.
        if (product.unit === 'pcs') needed = 1;
        else if (product.pieceSize) needed = product.pieceSize;
        else {
          toCheck.push({ name: row.name, meal: meal.title });
          continue;
        }
      }
      const line = lines.get(product.id) ?? {
        productId: product.id,
        name: product.name,
        icon: product.icon,
        category: product.category,
        unit: product.unit,
        needed: 0,
        inStock: round(info.total),
        onList: 0,
        toBuy: 0,
        toBuyAmount: 0,
        toBuyUnit: product.unit as Unit,
        storeId: product.storeId,
        level: null,
        meals: [],
      };
      line.needed = round(line.needed + needed);
      if (!line.meals.some((m) => m.id === meal.id)) line.meals.push(meal);
      lines.set(product.id, line);
    }
  }

  if (lines.size) {
    const { rows: listed } = await ctx.db.query<{ product_id: string; amount: number | null; unit: Unit | null }>(
      `SELECT product_id, amount, unit FROM shopping_items WHERE household_id = $1 AND trip_id IS NULL AND product_id = ANY($2::uuid[])`,
      [ctx.actor.householdId, [...lines.keys()]],
    );
    for (const item of listed) {
      const line = lines.get(item.product_id)!;
      if (line.level) {
        line.onList += 1;
        continue;
      }
      const product = stock.get(item.product_id)!.product;
      const unit = item.unit ?? product.unit;
      // A line with no amount still counts as one piece (or as "enough" when it can't be counted).
      const base = item.amount !== null && canConvert(unit, product) ? toBase(item.amount, unit, product) : product.unit === 'pcs' ? 1 : (product.pieceSize ?? line.needed);
      line.onList = round(line.onList + base);
    }
  }

  const order = (category: Category) => CATEGORIES.indexOf(category);
  const result = [...lines.values()].map((line) => {
    if (line.level) return { ...line, toBuy: line.onList ? 0 : 1, toBuyAmount: line.onList ? 0 : 1 };
    const product = stock.get(line.productId)!.product;
    let toBuy = Math.max(0, round(line.needed - line.inStock - line.onList));
    if (line.unit === 'pcs') toBuy = Math.ceil(toBuy - 1e-9);
    const toBuyUnit = displayUnit(toBuy, product);
    return { ...line, toBuy, toBuyUnit, toBuyAmount: amountIn(toBuy, toBuyUnit, product) };
  });
  result.sort((a, b) => order(a.category) - order(b.category) || a.name.localeCompare(b.name));
  return { lines: result, toCheck };
}
