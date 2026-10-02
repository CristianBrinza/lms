import { ingredientRows, neededBase, type IngredientRow, type StockInfo } from './ingredients';
import type { FoodCtx } from './kitchen';
import { round } from './units';

/**
 * The plan played forward against the kitchen. Every planned meal from today on, in eating order,
 * takes what it needs from the pieces that are still good on its day (soonest to expire first, or
 * the piece chosen for that meal). What one meal takes is no longer there for a later one or for
 * cooking something else now; what can't be covered is a shortage, needed by that meal's day.
 */

export interface PlannedMealRef {
  id: string;
  title: string;
  date: string;
}

export interface LineAllocation {
  allocated: number;
  short: number;
  /** The earlier meal that took what this one would have used. */
  takenBy: PlannedMealRef | null;
}

export interface PlanAllocation {
  /** Per meal ingredient line. */
  lines: Map<string, LineAllocation>;
  /** Per product: everything planned meals have claimed, and the first meal claiming it. */
  reserved: Map<string, { amount: number; first: PlannedMealRef }>;
  /** Per product: what the plan is short of, and when it is first needed. */
  shortages: Map<string, { short: number; needBy: string; meals: PlannedMealRef[] }>;
  meals: Array<PlannedMealRef & { time: string | null }>;
}

interface LotRow {
  id: string;
  product_id: string;
  quantity: number;
  expires_on: string | null;
  variant: string;
}

const EATING_ORDER = `m.date, coalesce(m.time, CASE m.slot WHEN 'breakfast' THEN time '08:00' WHEN 'lunch' THEN time '13:00' WHEN 'snack' THEN time '16:30' ELSE time '19:00' END), m.created_at`;

export async function allocatePlan(ctx: FoodCtx, stock: Map<string, StockInfo>, today: string): Promise<PlanAllocation> {
  const { rows: meals } = await ctx.db.query<{ id: string; title: string; date: string; time: string | null }>(
    `SELECT m.id, m.title, m.date, to_char(m.time, 'HH24:MI') AS time FROM meals m
      WHERE m.household_id = $1 AND m.status = 'planned' AND m.date >= $2 ORDER BY ${EATING_ORDER}`,
    [ctx.actor.householdId, today],
  );
  const { rows: lots } = await ctx.db.query<LotRow>(
    `SELECT l.id, l.product_id, l.quantity, l.expires_on, l.variant FROM stock_lots l
      WHERE l.household_id = $1 AND l.finished_at IS NULL AND l.quantity > 0
      ORDER BY l.opened_at IS NULL, l.expires_on NULLS LAST, l.added_at`,
    [ctx.actor.householdId],
  );
  const left = new Map(lots.map((lot) => [lot.id, lot.quantity]));
  const lotsByProduct = new Map<string, LotRow[]>();
  for (const lot of lots) lotsByProduct.set(lot.product_id, [...(lotsByProduct.get(lot.product_id) ?? []), lot]);
  const ingredients = await ingredientRows(ctx, 'meal_ingredients', meals.map((m) => m.id));

  const result: PlanAllocation = { lines: new Map(), reserved: new Map(), shortages: new Map(), meals };
  /** Who last took from each product, to explain a shortage. */
  const lastTaker = new Map<string, PlannedMealRef>();

  for (const meal of meals) {
    const ref = { id: meal.id, title: meal.title, date: meal.date };
    for (const row of ingredients.get(meal.id) ?? []) {
      const info = row.product_id ? stock.get(row.product_id) : undefined;
      if (!info || info.product.trackMode !== 'exact' || row.optional) continue;
      const need = wanted(row, info);
      if (need === null) continue;
      // Good on the meal's day, and of the type the line asks for.
      const kind = row.variant?.toLowerCase();
      const usable = (lotsByProduct.get(info.product.id) ?? []).filter(
        (lot) => (!lot.expires_on || lot.expires_on >= meal.date) && (!kind || lot.variant.toLowerCase() === kind),
      );
      const ordered = row.lot_id ? [...usable.filter((l) => l.id === row.lot_id), ...usable.filter((l) => l.id !== row.lot_id)] : usable;
      let remaining = need;
      for (const lot of ordered) {
        if (remaining <= 0) break;
        const take = Math.min(left.get(lot.id) ?? 0, remaining);
        if (take <= 0) continue;
        left.set(lot.id, round((left.get(lot.id) ?? 0) - take));
        remaining = round(remaining - take);
      }
      const allocated = round(need - remaining);
      result.lines.set(row.id, { allocated, short: remaining, takenBy: remaining > 0 ? (lastTaker.get(info.product.id) ?? null) : null });
      if (allocated > 0) {
        const reserved = result.reserved.get(info.product.id);
        result.reserved.set(info.product.id, { amount: round((reserved?.amount ?? 0) + allocated), first: reserved?.first ?? ref });
        lastTaker.set(info.product.id, ref);
      }
      if (remaining > 0) {
        const shortage = result.shortages.get(info.product.id);
        result.shortages.set(info.product.id, {
          short: round((shortage?.short ?? 0) + remaining),
          needBy: shortage?.needBy ?? meal.date,
          meals: shortage?.meals.some((m) => m.id === meal.id) ? shortage.meals : [...(shortage?.meals ?? []), ref],
        });
      }
    }
  }
  return result;
}

/** The base amount a line needs; "some" (no amount) counts as one piece where that means something. */
function wanted(row: IngredientRow, info: StockInfo): number | null {
  const needed = neededBase(row, info.product);
  if (needed !== null) return needed;
  if (row.amount !== null) return null;
  if (info.product.unit === 'pcs') return 1;
  return info.product.pieceSize ?? null;
}
