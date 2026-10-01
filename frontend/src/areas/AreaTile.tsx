import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { toast } from '@/components/ui';
import { ArrowOutIcon, HourglassIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { TONES, type Area } from './registry';

/**
 * A life area as a dashboard tile (the references' "Emotional Balance / Calm Relaxation" pair):
 * the name large at the top, a round butter button and a small pill at the bottom. The whole tile
 * is one button: a link once the area has a screen, until then a tap says it's being built.
 */
export function AreaTile({ area, index = 0 }: { area: Area; index?: number }) {
  const tone = TONES[area.tone];
  const Icon = area.icon;
  const classes = cx(
    'group/tile relative flex aspect-[4/5] w-full flex-col rounded-[1.75rem] p-4 text-left sm:aspect-[5/5] sm:p-5',
    'animate-rise transition-[translate,box-shadow] duration-300 ease-(--ease-lift)',
    'hover:-translate-y-1 focus-visible:-translate-y-1 active:translate-y-0 active:duration-100',
    tone.surface,
    tone.text,
  );
  const style = { animationDelay: `${80 + index * 70}ms` };
  const content: ReactNode = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="text-[1.375rem] font-bold leading-[1.1] tracking-[-0.025em]">{area.name}</span>
        <Icon fontSize="inherit" className={cx('mt-0.5 shrink-0 text-[1.35rem]', tone.muted)} />
      </span>
      <span className={cx('mt-1.5 line-clamp-3 text-sm font-medium', tone.muted)}>{area.summary}</span>
      <span className="mt-auto flex items-center justify-between gap-2">
        <span
          aria-hidden="true"
          className={cx(
            'flex size-12 shrink-0 items-center justify-center rounded-full text-[1.35rem]',
            area.to ? cx(tone.button, 'transition-transform duration-300 ease-(--ease-lift) group-hover/tile:rotate-45') : cx(tone.chip, 'opacity-80'),
          )}
        >
          {area.to ? <ArrowOutIcon fontSize="inherit" /> : <HourglassIcon fontSize="inherit" />}
        </span>
        {area.to ? null : <span className={cx('inline-flex h-8 items-center rounded-pill px-3 text-xs font-semibold', tone.chip)}>Soon</span>}
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
      onClick={() => toast.info(`${area.name} is being built`, { id: `area-${area.id}`, description: 'Its screen arrives in a coming update.' })}
    >
      {content}
    </button>
  );
}

/** Every area, two to a row on phones, more on wider screens: built for 10+. */
export function AreaGrid({ areas, className }: { areas: readonly Area[]; className?: string }) {
  return (
    <ul className={cx('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4', className)} aria-label="Your areas">
      {areas.map((area, index) => (
        <li key={area.id}>
          <AreaTile area={area} index={index} />
        </li>
      ))}
    </ul>
  );
}
