import { ingredientRows, neededBase, type Alternative, type IngredientRow, type StockInfo } from './ingredients';
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
  /** Covered by this option: 0 (or absent) the main item, 1… an alternative. */
  option?: number;
  /** Short because what there is goes off before the meal's day (not because it was taken). */
  spoils?: boolean;
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

  /** Takes `need` of a product for a meal from its lots still good that day (or only says how much it could). */
  const take = (productId: string, need: number, date: string | null, variant: string | undefined, lotId: string | null | undefined, dry: boolean): number => {
    const kind = variant?.toLowerCase();
    // date null: any lot, however soon it goes off (to tell "goes off first" from "not there").
    const usable = (lotsByProduct.get(productId) ?? []).filter((lot) => (!date || !lot.expires_on || lot.expires_on >= date) && (!kind || lot.variant.toLowerCase() === kind));
    const ordered = lotId ? [...usable.filter((l) => l.id === lotId), ...usable.filter((l) => l.id !== lotId)] : usable;
    let remaining = need;
    for (const lot of ordered) {
      if (remaining <= 0) break;
      const got = Math.min(left.get(lot.id) ?? 0, remaining);
      if (got <= 0) continue;
      if (!dry) left.set(lot.id, round((left.get(lot.id) ?? 0) - got));
      remaining = round(remaining - got);
    }
    return round(need - remaining);
  };
  const claim = (productId: string, amount: number, ref: PlannedMealRef) => {
    if (amount <= 0) return;
    const reserved = result.reserved.get(productId);
    result.reserved.set(productId, { amount: round((reserved?.amount ?? 0) + amount), first: reserved?.first ?? ref });
    lastTaker.set(productId, ref);
  };

  for (const meal of meals) {
    const ref = { id: meal.id, title: meal.title, date: meal.date };
    for (const row of ingredients.get(meal.id) ?? []) {
      const info = row.product_id ? stock.get(row.product_id) : undefined;
      if (!info || info.product.trackMode !== 'exact' || row.optional) continue;
      const need = wanted(row, info);
      if (need === null) continue;
      // Picked for this meal: that option, enough or not.
      const choice = row.choice ?? null;
      if (choice !== null && choice > 0) {
        const alt = row.alternatives?.[choice - 1];
        const altInfo = alt?.product_id ? stock.get(alt.product_id) : undefined;
        const altNeed = alt && altInfo && altInfo.product.trackMode === 'exact' ? neededBase(alt.amount === null ? row : alt, altInfo.product) : null;
        if (alt && altInfo && altNeed !== null) {
          const got = take(altInfo.product.id, altNeed, meal.date, alt.variant || undefined, null, false);
          const short = round(altNeed - got);
          claim(altInfo.product.id, got, ref);
          result.lines.set(row.id, { allocated: got, short, takenBy: short > 0 ? (lastTaker.get(altInfo.product.id) ?? null) : null, option: choice });
          if (short > 0) {
            const shortage = result.shortages.get(altInfo.product.id);
            result.shortages.set(altInfo.product.id, {
              short: round((shortage?.short ?? 0) + short),
              needBy: shortage?.needBy ?? meal.date,
              meals: shortage?.meals.some((m) => m.id === meal.id) ? shortage.meals : [...(shortage?.meals ?? []), ref],
            });
          }
        }
        continue;
      }
      // Not picked: the main item when there is enough of it; else the first alternative that covers it all.
      if (choice === null && take(info.product.id, need, meal.date, row.variant, row.lot_id, true) + 1e-9 < need) {
        const alt = coveringAlternative(row, stock, (id, amount, variant) => take(id, amount, meal.date, variant, null, true) + 1e-9 >= amount);
        if (alt) {
          take(alt.productId, alt.need, meal.date, alt.variant, null, false);
          claim(alt.productId, alt.need, ref);
          result.lines.set(row.id, { allocated: need, short: 0, takenBy: null, option: (row.alternatives ?? []).indexOf(alt.alt) + 1 });
          continue;
        }
      }
      const allocated = take(info.product.id, need, meal.date, row.variant, row.lot_id, false);
      const remaining = round(need - allocated);
      // There would be enough, but some of it goes off before this meal.
      const spoils = remaining > 0 && allocated + take(info.product.id, remaining, null, row.variant, null, true) + 1e-9 >= need;
      result.lines.set(row.id, { allocated, short: remaining, takenBy: remaining > 0 && !spoils ? (lastTaker.get(info.product.id) ?? null) : null, ...(spoils ? { spoils } : {}) });
      claim(info.product.id, allocated, ref);
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

/** The first alternative of a line that `covers` (enough of it), with how much of it is needed. */
export function coveringAlternative(
  row: IngredientRow,
  stock: Map<string, StockInfo>,
  covers: (productId: string, amount: number, variant: string | undefined) => boolean,
): { productId: string; need: number; variant: string | undefined; alt: Alternative } | null {
  for (const alt of row.alternatives ?? []) {
    const info = alt.product_id ? stock.get(alt.product_id) : undefined;
    if (!info || info.product.trackMode !== 'exact') continue;
    const need = neededBase(alt.amount === null ? row : alt, info.product);
    if (need === null) continue;
    if (covers(info.product.id, need, alt.variant || undefined)) return { productId: info.product.id, need, variant: alt.variant || undefined, alt };
  }
  return null;
}
