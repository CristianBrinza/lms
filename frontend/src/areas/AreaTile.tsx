import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { toast } from '@/components/ui';
import { ArrowOutIcon, ChevronRightIcon, HourglassIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { areasT } from './i18n';
import { TONES, type Area } from './registry';

/**
 * A life area as a dashboard tile (the references' "Emotional Balance / Calm Relaxation" pair):
 * the name large at the top, a round butter button and a small pill at the bottom. The whole tile
 * is one button: a link once the area has a screen, until then a tap says it's being built.
 */
export function AreaTile({ area, index = 0 }: { area: Area; index?: number }) {
  const tone = TONES[area.tone];
  const Icon = area.icon;
  if (area.wide && area.to) return <AreaRow area={{ ...area, to: area.to }} index={index} />;
  const classes = cx(
    'group/tile relative flex aspect-[4/5] w-full flex-col rounded-[1.75rem] p-4 text-left sm:aspect-[5/5] sm:p-5 lg:aspect-[6/5] lg:p-6',
    'animate-deal transition-[translate,box-shadow] duration-300 ease-(--ease-lift)',
    'hover:-translate-y-1 focus-visible:-translate-y-1 active:translate-y-0 active:duration-100',
    tone.surface,
    tone.text,
  );
  const style = { animationDelay: `${80 + index * 70}ms` };
  const content: ReactNode = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0 hyphens-auto break-words text-[1.375rem] font-bold leading-[1.1] tracking-[-0.025em]">
          {area.name}
        </span>
        <Icon fontSize="inherit" className={cx('mt-0.5 shrink-0 text-[1.35rem]', tone.muted)} />
      </span>
      <span className={cx('mt-1.5 line-clamp-3 text-sm font-medium', tone.muted)}>
        {area.summary}
      </span>
      <span className="mt-auto flex items-center justify-between gap-2">
        <span
          aria-hidden="true"
          className={cx(
            'flex size-12 shrink-0 items-center justify-center rounded-full text-[1.35rem]',
            area.to
              ? cx(
                  tone.button,
                  'transition-transform duration-300 ease-(--ease-lift) group-hover/tile:rotate-45',
                )
              : cx(tone.chip, 'opacity-80'),
          )}
        >
          {area.to ? <ArrowOutIcon fontSize="inherit" /> : <HourglassIcon fontSize="inherit" />}
        </span>
        {area.to ? null : (
          <span
            className={cx(
              'inline-flex h-8 items-center rounded-pill px-3 text-xs font-semibold',
              tone.chip,
            )}
          >
            {areasT().soon}
          </span>
        )}
      </span>
    </>
  );

  return area.to ? (
    <Link to={area.to} viewTransition className={classes} style={style}>
      {content}
    </Link>
  ) : (
    <button
      type="button"
      className={classes}
      style={style}
      onClick={() =>
        toast.info(areasT().building(area.name), {
          id: `area-${area.id}`,
          description: areasT().buildingDetail,
        })
      }
    >
      {content}
    </button>
  );
}

/**
 * A full-width area (Shopping) as one compact row, like Kitchenware on Food home: the icon in a
 * small square, the name and its line, a chevron.
 */
function AreaRow({ area, index }: { area: Area & { to: string }; index: number }) {
  const tone = TONES[area.tone];
  const Icon = area.icon;
  return (
    <Link
      to={area.to}
      viewTransition
      style={{ animationDelay: `${80 + index * 70}ms` }}
      className={cx(
        'press group/tile flex min-h-16 items-center gap-3 rounded-[1.25rem] py-2.5 pl-2.5 pr-3 shadow-[var(--shadow-card)]',
        'animate-deal transition-[translate,box-shadow] duration-300 ease-(--ease-lift) hover:-translate-y-0.5 hover:shadow-[var(--shadow-raised)]',
        tone.surface,
        tone.text,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'grid size-11 shrink-0 place-items-center rounded-[0.875rem] text-[1.4rem]',
          tone.button,
        )}
      >
        <Icon fontSize="inherit" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-bold leading-tight">{area.name}</span>
        <span className={cx('mt-0.5 block truncate text-[0.8125rem] font-medium', tone.muted)}>
          {area.summary}
        </span>
      </span>
      <ChevronRightIcon
        fontSize="inherit"
        className={cx(
          'shrink-0 text-[1.4rem] transition-transform duration-200 group-hover/tile:translate-x-0.5',
          tone.muted,
        )}
      />
    </Link>
  );
}

/**
 * Every area: two to a row on phones, three on tablets, as many as fit on desktop (at least 12rem,
 * a lone pair stretching to fill the row). Built for 10+. `children` are full-width rows that lead
 * the grid (Home's paydays), each its own `<li className="col-span-full">`.
 */
export function AreaGrid({
  areas,
  className,
  children,
}: {
  areas: readonly Area[];
  className?: string;
  children?: ReactNode;
}) {
  return (
    <ul
      className={cx(
        'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] lg:gap-4',
        className,
      )}
      aria-label={areasT().yourAreas}
    >
      {children}
      {areas.map((area, index) => (
        <li key={area.id} className={area.wide ? 'col-span-full' : undefined}>
          <AreaTile area={area} index={index} />
        </li>
      ))}
    </ul>
  );
}
