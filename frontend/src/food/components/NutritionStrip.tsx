import { formatList } from '@/i18n';
import { cx } from '@/lib/cx';
import { formatKcal, kcalUnit, macroText } from '../nutrition';
import type { DishNutrition } from '../types';
import { foodUiT } from './components.i18n';

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
  const t = foodUiT().nutrition;
  if (!nutrition.known) return null;
  const { perServing, total, unknown } = nutrition;
  const kcal = kcalUnit();
  return (
    <div className={cx('text-sm', className)}>
      <p className="tabular text-ink-700">
        <span className="font-bold text-ink-900">
          {formatKcal(perServing.kcal)} {kcal}
        </span>{' '}
        {t.aServing} · {macroText(perServing)}
      </p>
      {servings > 1 ? (
        <p className="tabular text-xs text-ink-500">
          {t.all(servings)}: {formatKcal(total.kcal)} {kcal} · {macroText(total)}
        </p>
      ) : null}
      {unknown.length ? (
        <p className="text-xs text-ink-500">{t.without(formatList(unknown))}</p>
      ) : null}
    </div>
  );
}
