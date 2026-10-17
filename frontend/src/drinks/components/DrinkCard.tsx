import { Link } from 'react-router';
import { BookmarkIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import type { Drink } from '../api';
import { drinkLine } from '../format';
import { useDrinksT } from '../i18n';
import { Cover, Stars } from './parts';

/**
 * A drink in the grid: a tall 3:4 cover (bottles are tall), what's at home on it, then the name,
 * the facts that tell it apart, and the household's stars.
 */
export function DrinkCard({ drink, index = 0 }: { drink: Drink; index?: number }) {
  const t = useDrinksT();
  const line = drinkLine(drink, t.years);
  return (
    <Link
      to={`/drinks/${drink.id}`}
      viewTransition
      className="press group block animate-rise"
      style={{ animationDelay: `${Math.min(index, 12) * 28}ms` }}
    >
      <span className="relative block overflow-hidden rounded-[1.5rem] shadow-[var(--shadow-card)] transition-shadow group-hover:shadow-[var(--shadow-raised)]">
        <Cover drink={drink} />
        <span className="absolute inset-x-2 top-2 flex items-start justify-between gap-1">
          {drink.stock > 0 ? (
            <span
              className={cx(
                'tabular inline-flex h-7 items-center gap-1 rounded-pill px-2.5 text-xs font-bold shadow-[var(--shadow-xs)]',
                drink.opened ? 'bg-butter-300 text-ink-900' : 'bg-white/95 text-ink-900',
              )}
            >
              {t.inCellar(drink.stock)}
              {drink.opened ? <span className="font-semibold">· {t.opened}</span> : null}
            </span>
          ) : (
            <span />
          )}
          {drink.wanted ? (
            <span
              aria-label={t.wantedTag}
              className="grid size-7 place-items-center rounded-full bg-white/95 text-[1rem] text-lav-700 shadow-[var(--shadow-xs)]"
            >
              <BookmarkIcon fontSize="inherit" />
            </span>
          ) : null}
        </span>
      </span>
      <span className="mt-2 block px-1">
        <span className="line-clamp-2 text-[0.9375rem] font-semibold leading-snug tracking-[-0.01em]">
          {drink.name}
        </span>
        {line ? (
          <span className="tabular mt-0.5 block truncate text-xs text-ink-500">{line}</span>
        ) : null}
        <span className="mt-1 flex h-4 items-center gap-1.5">
          {drink.rating !== null ? (
            <>
              <Stars value={Math.round(drink.rating)} size="xs" />
              <span className="tabular text-[0.6875rem] font-semibold text-ink-500">
                {drink.tastings > 1 ? `×${drink.tastings}` : ''}
              </span>
            </>
          ) : (
            <span className="text-[0.6875rem] font-medium text-ink-400">
              {drink.tastings ? t.tastedTimes(drink.tastings) : t.notTasted}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
