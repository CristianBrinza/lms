import { CheckIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import type { Meal } from '../types';

/** A meal's state at a glance: eaten, skipped, ready to cook, or how much is missing. */
export function MealStatus({ meal, className }: { meal: Pick<Meal, 'status' | 'availability' | 'ingredients'>; className?: string }) {
  const base = 'inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-pill px-2.5 text-xs font-semibold';
  if (meal.status === 'done') {
    return (
      <span className={cx(base, 'bg-mint-100 text-mint-800', className)}>
        <CheckIcon fontSize="inherit" className="text-sm" />
        Eaten
      </span>
    );
  }
  if (meal.status === 'skipped') return <span className={cx(base, 'bg-ink-100 text-ink-600', className)}>Skipped</span>;
  if (!meal.ingredients.length || meal.availability.total === 0) return null;
  const missing = meal.availability.missing.length;
  return missing ? (
    <span className={cx(base, 'bg-peach-100 text-peach-800', className)}>{missing} missing</span>
  ) : (
    <span className={cx(base, 'bg-mint-100 text-mint-800', className)}>Ready</span>
  );
}
