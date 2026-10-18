import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Avatar, Button, Sheet } from '@/components/ui';
import { CheckIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import type { Cover, Person, Place } from '../api';
import { COLORS, type ClosetColor } from '../catalog';
import { useClosetT } from '../i18n';
import { childrenOf, placeName } from '../places';
import { STUDIO } from '../state';

/** The closet's furniture: the screen and its nav, whose closet, the studio tile, swatches. */

// ---------------------------------------------------------------- whose closet

/** Me, each person at home, everyone: a row of faces. Hidden for a household of one. */
export function PersonSwitcher({
  people,
  meId,
  value,
  onChange,
}: {
  people: Person[];
  meId: string;
  value: string;
  onChange: (owner: string) => void;
}) {
  const t = useClosetT();
  if (people.length < 2) return null;
  const current = value === meId ? 'me' : value;
  const pill = (on: boolean) =>
    cx(
      'press flex h-10 shrink-0 items-center gap-2 rounded-full text-sm font-semibold transition-colors',
      on ? 'bg-ink-900 text-white' : 'bg-white text-ink-700 shadow-[var(--shadow-xs)] hover:bg-lav-100',
    );
  return (
    <div role="radiogroup" aria-label={t.whose} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none]">
      {people.map((p) => {
        const key = p.id === meId ? 'me' : p.id;
        const on = current === key;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              haptic('tap');
              onChange(key);
            }}
            className={cx(pill(on), 'pl-1 pr-3.5')}
          >
            <Avatar person={p} size="sm" className="size-8 ring-0" />
            {p.id === meId ? t.you : p.name}
          </button>
        );
      })}
      <button
        type="button"
        role="radio"
        aria-checked={current === 'all'}
        onClick={() => {
          haptic('tap');
          onChange('all');
        }}
        className={cx(pill(current === 'all'), 'px-3.5')}
      >
        {t.everyone}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- the frame

const NAV = [
  { to: '/closet', key: 'closet', end: true },
  { to: '/closet/places', key: 'places' },
] as const;

export function ClosetNav({ className }: { className?: string }) {
  const t = useClosetT();
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
                  isActive ? 'bg-ink-900 text-white' : 'bg-white text-ink-700 shadow-[var(--shadow-xs)] hover:bg-lav-100',
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

export function ClosetScreen({
  title,
  subtitle,
  back = '/closet',
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
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <Screen tone="white">
      <PageHeader compact back={back} title={title} subtitle={subtitle} actions={actions} />
      <div className="gutter-x mt-2 md:px-5 lg:px-8">
        <div className={cx('mx-auto', wide ? 'max-w-6xl' : 'max-w-3xl')}>
          {nav ? <ClosetNav className="mb-3" /> : null}
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
  const t = useClosetT();
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

// ---------------------------------------------------------------- the studio

/**
 * The studio backdrop: a soft pool of light from above, fading to a cool grey floor, with a faint
 * contact shadow where the piece rests. Cut-outs float on it; a photo with its background fills it.
 */
export function Studio({
  cover,
  size = 'thumb',
  alt = '',
  eager,
  className,
  children,
}: {
  cover: Cover | null;
  size?: 'thumb' | 'full';
  alt?: string;
  eager?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'broken'>('loading');
  const src = cover ? cover[size] : null;
  const floating = Boolean(cover?.hasAlpha);
  return (
    <span className={cx('relative block overflow-hidden', className)} style={STUDIO}>
      {floating ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-[18%] bottom-[7%] h-[6%] rounded-[50%] bg-ink-900/10 blur-md"
        />
      ) : null}
      {!src || state === 'broken' ? <Hanger className="absolute inset-0 m-auto h-[46%] w-auto text-ink-300" /> : null}
      {src && state !== 'broken' ? (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setState('ok')}
          onError={() => setState('broken')}
          className={cx(
            'absolute inset-0 size-full transition-opacity duration-300',
            floating
              ? 'object-contain p-[9%] pb-[12%] [filter:drop-shadow(0_10px_12px_rgb(29_29_36/0.12))]'
              : 'object-cover',
            state === 'ok' ? 'opacity-100' : 'opacity-0',
          )}
        />
      ) : null}
      {children}
    </span>
  );
}

/** A thin-line hanger: the closet's own mark, for empty states and pieces without a photo. */
export function Hanger({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M48 20v-3.5a6.5 6.5 0 1 0-6.5-6.5" />
      <path d="M48 20 7.5 47.5A4 4 0 0 0 9.8 55h76.4a4 4 0 0 0 2.3-7.5z" />
    </svg>
  );
}

// ---------------------------------------------------------------- swatches

export function Swatch({ color, className }: { color: ClosetColor; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx('inline-block shrink-0 rounded-full ring-1 ring-inset ring-black/10', className ?? 'size-3.5')}
      style={{ background: COLORS[color] }}
    />
  );
}

/** Colours as rings to tap: the chosen ones get a ring and a tick. */
export function ColorPicker({
  value,
  onChange,
  suggested = [],
  label,
}: {
  value: ClosetColor[];
  onChange: (colors: ClosetColor[]) => void;
  suggested?: ClosetColor[];
  label: string;
}) {
  const t = useClosetT();
  const order = [...suggested, ...(Object.keys(COLORS) as ClosetColor[]).filter((c) => !suggested.includes(c))];
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {order.map((color) => {
        const on = value.includes(color);
        return (
          <button
            key={color}
            type="button"
            aria-pressed={on}
            title={t.color[color]}
            aria-label={`${t.color[color]}${suggested.includes(color) ? ` (${t.suggested})` : ''}`}
            onClick={() => {
              haptic('tap');
              onChange(on ? value.filter((c) => c !== color) : [...value, color].slice(-6));
            }}
            className={cx(
              'press relative grid size-10 place-items-center rounded-full transition-shadow',
              on ? 'shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--color-ink-900)]' : '',
              suggested.includes(color) && !on ? 'shadow-[0_0_0_2px_#fff,0_0_0_3.5px_var(--color-lav-400)]' : '',
            )}
          >
            <Swatch color={color} className="size-9" />
            {on ? (
              <CheckIcon
                fontSize="inherit"
                className={cx(
                  'absolute text-lg',
                  ['white', 'cream', 'beige', 'yellow', 'light_blue', 'silver', 'pink', 'lilac', 'khaki', 'gold'].includes(color)
                    ? 'text-ink-900'
                    : 'text-white',
                )}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Many of a few: chips that toggle. */
export function ChipSet<T extends string>({
  label,
  options,
  values,
  onChange,
  word,
}: {
  label: string;
  options: readonly T[];
  values: string[];
  onChange: (values: T[]) => void;
  word: (id: T) => string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const on = values.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={on}
            onClick={() => {
              haptic('tap');
              onChange((on ? values.filter((v) => v !== option) : [...values, option]) as T[]);
            }}
            className={cx(
              'press inline-flex h-9 items-center rounded-pill px-3.5 text-[0.8125rem] font-semibold transition-colors',
              on ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
            )}
          >
            {word(option)}
          </button>
        );
      })}
    </div>
  );
}

/** One of a few: pills, tapping the chosen one again clears it (when allowed). */
export function PickOne<T extends string>({
  label,
  options,
  value,
  onChange,
  word,
  clearable = true,
}: {
  label: string;
  options: readonly T[];
  value: string;
  onChange: (value: T | '') => void;
  word: (id: T) => string;
  clearable?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const on = value === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              haptic('tap');
              onChange(on && clearable ? '' : option);
            }}
            className={cx(
              'press inline-flex h-9 items-center rounded-pill px-3.5 text-[0.8125rem] font-semibold transition-colors',
              on ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
            )}
          >
            {word(option)}
          </button>
        );
      })}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[0.8125rem] font-semibold text-ink-700">{label}</p>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------- picking a place

/**
 * Where a piece is kept: tap through rooms, furniture and sections. Recent places come first as
 * chips; "No place" clears it.
 */
export function PlacePicker({
  open,
  onClose,
  places,
  value,
  onChange,
  recent = [],
}: {
  open: boolean;
  onClose: () => void;
  places: Place[];
  value: string | null;
  onChange: (placeId: string | null) => void;
  recent?: string[];
}) {
  const t = useClosetT();
  const byId = new Map(places.map((p) => [p.id, p]));
  const [at, setAt] = useState<string | null>(null);
  const here = at ? byId.get(at) : undefined;
  const list = childrenOf(places, at);
  const choose = (id: string | null) => {
    haptic('tap');
    onChange(id);
    onClose();
  };
  const trail: Place[] = [];
  for (let p = here; p; p = p.parentId ? byId.get(p.parentId) : undefined) trail.unshift(p);
  const recents = recent.map((id) => byId.get(id)).filter((p): p is Place => Boolean(p)).slice(0, 4);

  return (
    <Sheet open={open} onClose={onClose} title={t.pickPlace}>
      {recents.length && !at ? (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {recents.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => choose(p.id)}
              className="press inline-flex h-9 items-center rounded-pill bg-lav-100 px-3.5 text-[0.8125rem] font-semibold text-ink-900"
            >
              {placeName(p)}
            </button>
          ))}
        </div>
      ) : null}
      <div className="mb-3 flex flex-wrap items-center gap-1 text-sm font-semibold text-ink-600">
        <button type="button" className="press rounded-pill px-2 py-1 hover:bg-ink-50" onClick={() => setAt(null)}>
          {t.placesTitle}
        </button>
        {trail.map((p) => (
          <span key={p.id} className="flex items-center gap-1">
            <span aria-hidden="true">›</span>
            <button type="button" className="press rounded-pill px-2 py-1 hover:bg-ink-50" onClick={() => setAt(p.id)}>
              {placeName(p)}
            </button>
          </span>
        ))}
      </div>
      <ul className="flex flex-col gap-1.5">
        {here ? (
          <li>
            <button
              type="button"
              onClick={() => choose(here.id)}
              className={cx(
                'press flex h-12 w-full items-center justify-between rounded-2xl px-4 text-left text-[0.9375rem] font-semibold',
                value === here.id ? 'bg-ink-900 text-white' : 'bg-butter-100 text-ink-900',
              )}
            >
              {placeName(here)}
              {value === here.id ? <CheckIcon fontSize="inherit" className="text-xl" /> : null}
            </button>
          </li>
        ) : null}
        {list.map((p) => {
          const deeper = places.some((c) => c.parentId === p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => (deeper ? setAt(p.id) : choose(p.id))}
                className={cx(
                  'press flex h-12 w-full items-center justify-between gap-3 rounded-2xl px-4 text-left text-[0.9375rem] font-medium',
                  value === p.id ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-900 hover:bg-ink-100',
                )}
              >
                <span className="min-w-0 truncate">{placeName(p)}</span>
                <span className={cx('text-sm', value === p.id ? 'text-white/70' : 'text-ink-500')}>
                  {deeper ? '›' : p.items ? t.inside(p.items) : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {!places.length ? <p className="text-sm text-ink-600">{t.placesEmpty}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" onClick={() => choose(null)}>
          {t.noPlace}
        </Button>
        <Button size="sm" variant="tint" onClick={onClose}>
          {t.done}
        </Button>
      </div>
    </Sheet>
  );
}

