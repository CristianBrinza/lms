import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui';
import { StarBorderIcon, StarHalfIcon, StarIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import type { Category, Drink } from '../api';
import { LOOK } from '../catalog';
import { stars } from '../format';
import { useDrinksT } from '../i18n';

/** Drinks' furniture: the screen frame and its nav, stars, the bottle drawing, pickers. */

const NAV = [
  { to: '/drinks', key: 'cellar', end: true },
  { to: '/drinks/journal', key: 'journal' },
  { to: '/drinks/stats', key: 'stats' },
] as const;

export function DrinksNav({ className }: { className?: string }) {
  const t = useDrinksT();
  return (
    <nav aria-label={t.nav.label} className={className}>
      <ul className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none]">
        {NAV.map((item) => (
          <li key={item.to} className="shrink-0">
            <NavLink
              to={item.to}
              end={'end' in item}
              viewTransition
              className={({ isActive }) =>
                cx(
                  'press inline-flex h-9 items-center rounded-pill px-3.5 text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-ink-900 text-white'
                    : 'bg-white text-ink-700 shadow-[var(--shadow-xs)] hover:bg-pink-100',
                )
              }
            >
              {t.nav[item.key]}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** A Drinks screen: the header, the nav on the three main screens, the content in a column. */
export function DrinksScreen({
  title,
  subtitle,
  back = '/drinks',
  actions,
  nav,
  wide,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string;
  actions?: ReactNode;
  nav?: boolean;
  /** The cellar's grid uses the whole width; reading screens keep a column. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <Screen tone="white">
      <PageHeader compact back={back} title={title} subtitle={subtitle} actions={actions} />
      <div className="gutter-x mt-2 md:px-5 lg:px-8">
        <div className={cx('mx-auto', wide ? 'max-w-6xl' : 'max-w-3xl')}>
          {nav ? <DrinksNav className="mb-3" /> : null}
          {children}
        </div>
      </div>
    </Screen>
  );
}

export function Section({
  title,
  aside,
  children,
  className,
}: {
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('mt-7', className)}>
      <div className="mb-2.5 flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-[1.0625rem] font-bold tracking-[-0.01em]">{title}</h2>
        {aside ? <div className="text-sm text-ink-500">{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function ErrorCard({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useDrinksT();
  return (
    <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]">
      <p className="font-semibold text-danger-700">{t.loadFailed}</p>
      <p className="mt-1 text-sm text-ink-600">{errorMessage(error)}</p>
      <Button size="sm" variant="tint" className="mt-3" onClick={onRetry}>
        {t.tryAgain}
      </Button>
    </div>
  );
}

/** Five stars in half steps, for reading (1–10). */
export function Stars({
  value,
  size = 'sm',
  className,
}: {
  value: number | null;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}) {
  const t = useDrinksT();
  if (value === null) return null;
  return (
    <span
      role="img"
      aria-label={t.ratingValue(stars(value))}
      className={cx(
        'inline-flex items-center text-butter-400',
        size === 'xs' ? 'text-[0.8125rem]' : size === 'sm' ? 'text-base' : 'text-[1.375rem]',
        className,
      )}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const Icon = value >= star * 2 ? StarIcon : value === star * 2 - 1 ? StarHalfIcon : StarBorderIcon;
        return (
          <Icon
            key={star}
            fontSize="inherit"
            className={value >= star * 2 - 1 ? undefined : 'text-ink-200'}
          />
        );
      })}
    </span>
  );
}

/**
 * A rating as five stars in half steps (stored 1–10). The left half of a star gives the half, the
 * right half the whole star; tapping the current value again clears it.
 */
export function RatingPicker({
  value,
  onChange,
  label,
  size = 'md',
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  label: string;
  size?: 'md' | 'lg';
}) {
  const t = useDrinksT();
  const choose = (n: number) => {
    haptic('tap');
    onChange(value === n ? null : n);
  };
  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label={label} className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => {
          const full = value !== null && value >= star * 2;
          const half = value !== null && value === star * 2 - 1;
          const Icon = full ? StarIcon : half ? StarHalfIcon : StarBorderIcon;
          return (
            <span
              key={star}
              className={cx(
                'relative grid place-items-center transition-transform',
                size === 'lg' ? 'size-12 text-[2.6rem]' : 'size-10 text-[2rem]',
                full || half ? 'text-butter-400' : 'text-ink-300',
              )}
            >
              <Icon fontSize="inherit" />
              {[star * 2 - 1, star * 2].map((n, i) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={value === n}
                  aria-label={t.ratingValue(stars(n))}
                  onClick={() => choose(n)}
                  className={cx(
                    'press absolute inset-y-0 w-1/2 focus-visible:outline-2 focus-visible:outline-ink-900',
                    i === 0 ? 'left-0 rounded-l-full' : 'right-0 rounded-r-full',
                  )}
                />
              ))}
            </span>
          );
        })}
      </div>
      {value !== null ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={t.clearRating}
          className="tabular rounded-pill bg-butter-100 px-2.5 py-1 text-[1.0625rem] font-bold text-ink-900"
        >
          {stars(value)}
        </button>
      ) : null}
    </div>
  );
}

const BOTTLES: Record<(typeof LOOK)[Category]['bottle'], { body: string; label: string }> = {
  wine: {
    body: 'M42 8h16v62c0 14 20 22 20 46v108a8 8 0 0 1-8 8H30a8 8 0 0 1-8-8V116c0-24 20-32 20-46z',
    label: 'M24 140h52v52H24z',
  },
  sparkling: {
    body: 'M43 8h14v40c0 30 23 44 23 72v102a8 8 0 0 1-8 8H28a8 8 0 0 1-8-8V120c0-28 23-42 23-72z',
    label: 'M22 146h56v50H22z',
  },
  square: {
    body: 'M42 22h16v34h4a4 4 0 0 1 4 4v4c10 2 16 8 16 18v134a8 8 0 0 1-8 8H26a8 8 0 0 1-8-8V82c0-10 6-16 16-18v-4a4 4 0 0 1 4-4h4z',
    label: 'M18 118h64v58H18z',
  },
  tall: {
    body: 'M44 8h12v52c0 10 16 14 16 30v132a8 8 0 0 1-8 8H36a8 8 0 0 1-8-8V90c0-16 16-20 16-30z',
    label: 'M28 132h44v56H28z',
  },
  beer: {
    body: 'M44 38h12v42c0 16 16 24 16 40v102a8 8 0 0 1-8 8H36a8 8 0 0 1-8-8V120c0-16 16-24 16-40z',
    label: 'M28 150h44v44H28z',
  },
  round: {
    body: 'M44 22h12v48c22 10 32 32 32 66 0 52-20 94-38 94S12 188 12 136c0-34 10-56 32-66z',
    label: 'M18 140h64v40H18z',
  },
};

/** A drawn bottle of the kind's shape, for a drink without a photo. */
export function Bottle({ category, className }: { category: Category; className?: string }) {
  const shape = BOTTLES[LOOK[category].bottle];
  return (
    <svg viewBox="0 0 100 240" aria-hidden="true" className={className}>
      <path d={shape.body} fill="currentColor" opacity="0.2" />
      <path d={shape.label} fill="currentColor" opacity="0.16" />
    </svg>
  );
}

/** The cover in a box of fixed aspect (3:4 by default): the photo, or the kind's bottle drawn. */
export function Cover({
  drink,
  size = 'thumb',
  className,
  eager,
}: {
  drink: Pick<Drink, 'category' | 'cover'>;
  size?: 'thumb' | 'full';
  className?: string;
  eager?: boolean;
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'broken'>('loading');
  const look = LOOK[drink.category];
  const src = drink.cover ? drink.cover[size] : null;
  return (
    <span
      className={cx(
        'relative block aspect-[3/4] overflow-hidden',
        look.tint,
        look.ink,
        className,
      )}
    >
      {!src || state !== 'ok' ? (
        <Bottle
          category={drink.category}
          className="absolute inset-x-0 bottom-0 mx-auto h-[82%] w-auto"
        />
      ) : null}
      {src && state !== 'broken' ? (
        <img
          src={src}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setState('ok')}
          onError={() => setState('broken')}
          className={cx(
            'absolute inset-0 size-full object-cover transition-opacity duration-300',
            state === 'ok' ? 'opacity-100' : 'opacity-0',
          )}
        />
      ) : null}
    </span>
  );
}

/**
 * One value of a scale. Ordinal scales (light → pronounced) draw as a joined bar, so the choice
 * reads as a level; others as pills. Tapping the chosen one again clears it.
 */
export function ScalePicker({
  label,
  options,
  value,
  onChange,
  ordinal,
  swatches,
}: {
  label: string;
  options: string[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  ordinal?: boolean;
  swatches?: Record<string, string>;
}) {
  const t = useDrinksT();
  const pick = (option: string) => {
    haptic('tap');
    onChange(value === option ? undefined : option);
  };
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink-700">{label}</span>
        {ordinal && value ? (
          <span className="text-sm font-semibold text-ink-900">{t.scale[value] ?? value}</span>
        ) : null}
      </div>
      {ordinal ? (
        <div role="radiogroup" aria-label={label} className="flex gap-1">
          {options.map((option, index) => {
            const chosen = value !== undefined ? options.indexOf(value) : -1;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={value === option}
                aria-label={t.scale[option] ?? option}
                title={t.scale[option] ?? option}
                onClick={() => pick(option)}
                className={cx(
                  'press h-9 min-w-0 flex-1 rounded-md transition-colors first:rounded-l-pill last:rounded-r-pill',
                  index <= chosen ? 'bg-ink-900' : 'bg-ink-100 hover:bg-ink-200',
                )}
              />
            );
          })}
        </div>
      ) : (
        <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={value === option}
              onClick={() => pick(option)}
              className={cx(
                'press inline-flex h-9 items-center gap-1.5 rounded-pill px-3 text-sm font-semibold transition-colors',
                value === option ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
              )}
            >
              {swatches?.[option] ? (
                <span
                  aria-hidden="true"
                  className="size-3.5 rounded-full ring-1 ring-black/10"
                  style={{ background: swatches[option] }}
                />
              ) : null}
              {t.scale[option] ?? option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Many of a few: chips that toggle. */
export function ChipSet({
  label,
  options,
  values,
  onChange,
  word,
  tone = 'ink',
}: {
  label: string;
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
  word: (id: string) => string;
  tone?: 'ink' | 'pink' | 'butter' | 'peach' | 'mint';
}) {
  const on: Record<string, string> = {
    ink: 'bg-ink-900 text-white',
    pink: 'bg-pink-200 text-pink-800 ring-1 ring-inset ring-pink-400',
    butter: 'bg-butter-300 text-ink-900',
    peach: 'bg-peach-200 text-peach-800',
    mint: 'bg-mint-200 text-mint-800',
  };
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = values.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => {
              haptic('tap');
              onChange(active ? values.filter((v) => v !== option) : [...values, option]);
            }}
            className={cx(
              'press inline-flex h-8 items-center rounded-pill px-3 text-[0.8125rem] font-semibold transition-colors',
              active ? on[tone] : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
            )}
          >
            {word(option)}
          </button>
        );
      })}
    </div>
  );
}

/** A two- or three-way switch, full width (Quick | Full sheet; Yes | No | Not sure). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-pill bg-ink-100 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => {
            haptic('tap');
            onChange(option.value);
          }}
          className={cx(
            'press h-9 flex-1 rounded-pill px-3 text-sm font-semibold transition-colors',
            value === option.value
              ? 'bg-white text-ink-900 shadow-[var(--shadow-xs)]'
              : 'text-ink-600 hover:text-ink-900',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
