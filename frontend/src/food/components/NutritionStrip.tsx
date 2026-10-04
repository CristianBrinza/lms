import { cx } from '@/lib/cx';
import { formatKcal, macroText } from '../nutrition';
import type { DishNutrition } from '../types';

/** A serving's energy and macros, quietly under the servings; the whole for the servings shown below. */
export function NutritionStrip({
  nutrition,
  servings,
  className = 'mt-2 px-1',
}: {
  nutrition: DishNutrition;
  servings: number;
  className?: string;
}) {
  if (!nutrition.known) return null;
  const { perServing, total, unknown } = nutrition;
  return (
    <div className={cx('text-sm', className)}>
      <p className="tabular text-ink-700">
        <span className="font-bold text-ink-900">{formatKcal(perServing.kcal)} kcal</span> a serving
        · {macroText(perServing)}
      </p>
      {servings > 1 ? (
        <p className="tabular text-xs text-ink-500">
          All {servings}: {formatKcal(total.kcal)} kcal · {macroText(total)}
        </p>
      ) : null}
      {unknown.length ? (
        <p className="text-xs text-ink-500">Without: {unknown.join(', ')} (values unknown)</p>
      ) : null}
    </div>
  );
}
