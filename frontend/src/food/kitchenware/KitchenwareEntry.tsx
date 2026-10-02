import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Skeleton } from '@/components/ui';
import { ChevronRightIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { kitchenwareApi, foodKeys } from '../api';
import { FoodIconTile } from '../icons/FoodIcon';
import { statusLine, washState } from './status';

/**
 * Kitchenware's door on Food home: one compact row under the four section cards, with a small
 * drawing and where the washing-up stands ("All clean", "3 dirty · dishwasher until 21:40").
 */
export function KitchenwareEntry({ className }: { className?: string }) {
  const list = useQuery({ queryKey: foodKeys.kitchenware, queryFn: kitchenwareApi.list });
  const state = list.data ? washState(list.data.tools) : null;
  const busy = state ? state.dirty > 0 || state.washing > 0 : false;

  return (
    <Link
      to="/food/kitchenware"
      viewTransition
      className={cx(
        'press group/entry flex min-h-16 items-center gap-3 rounded-[1.25rem] bg-white py-2.5 pl-2.5 pr-3 shadow-[var(--shadow-card)]',
        'transition-[translate,box-shadow] duration-300 ease-(--ease-lift) hover:-translate-y-0.5 hover:shadow-[var(--shadow-raised)]',
        className,
      )}
    >
      <FoodIconTile name="pot" tone="bg-lav-100" className="size-11 rounded-[0.875rem] [&>svg]:size-8" />
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-bold leading-tight">Kitchenware</span>
        {state ? (
          <span className={cx('mt-0.5 block truncate text-[0.8125rem] font-medium', busy ? 'text-peach-800' : 'text-ink-600')}>{statusLine(state)}</span>
        ) : list.isError ? (
          <span className="mt-0.5 block truncate text-[0.8125rem] font-medium text-ink-500">Pots, pans, glasses</span>
        ) : (
          <Skeleton className="mt-1 h-3.5 w-32" />
        )}
      </span>
      <ChevronRightIcon fontSize="inherit" className="shrink-0 text-[1.4rem] text-ink-400 transition-transform duration-200 group-hover/entry:translate-x-0.5" />
    </Link>
  );
}
