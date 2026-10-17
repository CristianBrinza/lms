import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { useUser } from '@/app/auth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Avatar, Button } from '@/components/ui';
import { CheckIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { isApiError } from '@/services/api/client';
import type { Person } from '@/training/types';
import { useConfigured } from '../config';
import { useWatchingT } from '../i18n';
import { percent } from '../logic';
import { useHousehold, useWatchView } from '../people';
import { toggleInView } from '../view';

/** Watching's shared furniture: the screen frame, the top nav, people pickers, small marks. */

const NAV = [
  { to: '/watching', key: 'home', end: true },
  { to: '/watching/library', key: 'library' },
  { to: '/watching/discover', key: 'discover' },
  { to: '/watching/calendar', key: 'calendar' },
  { to: '/watching/stats', key: 'stats' },
] as const;

/** The five main screens as a compact segmented row (the reference app's top chips). */
export function WatchingNav({ className }: { className?: string }) {
  const t = useWatchingT();
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

/**
 * A Watching screen: the header, the nav on the main screens, the not-configured card instead of
 * the content when TMDB has no key, and TMDB's and JustWatch's credit at the bottom.
 */
export function WatchingScreen({
  title,
  subtitle,
  back = '/watching',
  actions,
  nav,
  children,
  error,
  stored,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string;
  actions?: ReactNode;
  /** Show the five-screen nav under the header. */
  nav?: boolean;
  children: ReactNode;
  /** A page's own load error: the TMDB one becomes the calm card too. */
  error?: unknown;
  /** Reads only what is stored (library, stats, lists): still shown without TMDB, under the card. */
  stored?: boolean;
}) {
  const configured = useConfigured();
  const off = configured === false || isApiError(error, 'TMDB_NOT_CONFIGURED');
  return (
    <Screen tone="white">
      <PageHeader compact back={back} title={title} subtitle={subtitle} actions={actions} />
      {nav ? <WatchingNav className="gutter-x mt-2 md:px-5 lg:px-8" /> : null}
      <div className="gutter-x mt-3 md:px-5 lg:px-8">
        {off ? <NotConfigured /> : null}
        {off && !stored ? null : <div className={off ? 'mt-4' : undefined}>{children}</div>}
        <Attribution />
      </div>
    </Screen>
  );
}

/** TMDB has no key yet: a calm card, and for the admin, how to add it. */
export function NotConfigured() {
  const t = useWatchingT().notConfigured;
  const user = useUser();
  return (
    <section className="rounded-[1.5rem] bg-white p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-[1.0625rem] font-bold">{t.title}</h2>
      <p className="mt-1.5 max-w-prose text-sm text-ink-600">{t.body}</p>
      <p className="mt-3 max-w-prose rounded-2xl bg-ink-50 px-3.5 py-3 text-sm text-ink-700">
        {user.role === 'admin' ? t.admin : t.member}
      </p>
    </section>
  );
}

/** The credit TMDB's terms ask for, and JustWatch's for where-to-watch. */
export function Attribution() {
  const t = useWatchingT().attribution;
  return (
    <footer className="mt-8 border-t border-ink-200 pt-3 text-xs leading-relaxed text-ink-500">
      <p>{t.tmdb}</p>
      <p>{t.justwatch}</p>
    </footer>
  );
}

/** A load failed: what happened and a retry. */
export function ErrorCard({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useWatchingT().common;
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

/** A titled block of a screen, with an optional action on the right. */
export function Section({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('mt-6 first:mt-0', className)}>
      <div className="mb-2.5 flex min-h-8 items-center justify-between gap-3 px-0.5">
        <h2 className="text-[1.0625rem] font-bold tracking-[-0.01em]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A thin progress bar (episodes seen of aired). */
export function ProgressBar({
  share,
  label,
  className,
}: {
  share: number;
  label: string;
  className?: string;
}) {
  const value = percent(share);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={cx('h-1.5 overflow-hidden rounded-full bg-ink-100', className)}
    >
      <div
        className="h-full rounded-full bg-ink-900 transition-[width] duration-500"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

/** Small stacked faces: who watched a play together. Nothing for a play of mine alone. */
export function PeopleStack({
  ids,
  className,
}: {
  ids: readonly string[] | undefined;
  className?: string;
}) {
  const { me, people } = useHousehold();
  if (!ids?.length || (ids.length === 1 && ids[0] === me.id)) return null;
  const faces = ids.map((id) => people.find((p) => p.id === id)).filter((p): p is Person => !!p);
  if (!faces.length) return null;
  return (
    <span
      className={cx('inline-flex shrink-0 items-center', className)}
      title={faces.map((p) => p.name).join(', ')}
    >
      {faces.slice(0, 4).map((p, i) => (
        <Avatar
          key={p.id}
          person={p}
          size="sm"
          className={cx('size-6 text-[0.625rem] ring-2 ring-white', i > 0 && '-ml-2')}
        />
      ))}
    </span>
  );
}

/** One face as a pill: picked ink, idle white. */
function FacePill({
  person,
  label,
  on,
  onClick,
  role = 'checkbox',
}: {
  person?: Person;
  label: string;
  on: boolean;
  onClick: () => void;
  role?: 'checkbox' | 'radio' | 'button';
}) {
  return (
    <button
      type="button"
      role={role === 'button' ? undefined : role}
      aria-checked={role === 'button' ? undefined : on}
      aria-pressed={role === 'button' ? on : undefined}
      onClick={() => {
        haptic('tap');
        onClick();
      }}
      className={cx(
        'press flex h-10 shrink-0 items-center gap-2 rounded-full text-sm font-semibold transition-colors',
        person ? 'pl-1 pr-3.5' : 'px-3.5',
        on
          ? 'bg-ink-900 text-white'
          : 'bg-white text-ink-700 shadow-[var(--shadow-xs)] hover:bg-pink-100',
      )}
    >
      {person ? <Avatar person={person} size="sm" className="size-8 ring-0" /> : null}
      {label}
    </button>
  );
}

/**
 * Whose watching the screen shows: me, someone else, several of us together (the Together pill
 * makes the faces multi-select) or everyone. Hidden for a household of one.
 */
export function ViewSwitcher({ className }: { className?: string }) {
  const t = useWatchingT();
  const { view, setView, me, people } = useWatchView();
  if (people.length < 2) return null;
  const together = view.kind === 'together';
  const picked = (id: string) =>
    view.kind === 'me'
      ? id === me.id
      : view.kind === 'person'
        ? id === view.id
        : view.kind === 'together'
          ? view.ids.includes(id)
          : false;
  return (
    <div
      role="group"
      aria-label={t.who.view}
      className={cx('-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 py-1', className)}
    >
      {people.map((p) => (
        <FacePill
          key={p.id}
          person={p}
          label={p.id === me.id ? t.common.you : p.name}
          on={picked(p.id)}
          onClick={() => setView(toggleInView(view, p.id, me.id, together))}
        />
      ))}
      <span aria-hidden="true" className="mx-0.5 h-6 w-px shrink-0 bg-ink-200" />
      <FacePill
        role="button"
        label={t.who.together}
        on={together}
        onClick={() =>
          setView(
            together
              ? { kind: 'me' }
              : {
                  kind: 'together',
                  ids: view.kind === 'person' ? [me.id, view.id] : people.map((p) => p.id),
                },
          )
        }
      />
      <FacePill
        role="button"
        label={t.who.everyone}
        on={view.kind === 'household'}
        onClick={() => setView(view.kind === 'household' ? { kind: 'me' } : { kind: 'household' })}
      />
    </div>
  );
}

/**
 * Who watched, when marking something: the household's faces, several at once. Never empty: the
 * last one picked stays. Hidden for a household of one.
 */
export function WhoPicker({
  value,
  onChange,
  className,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}) {
  const t = useWatchingT();
  const { me, people } = useHousehold();
  if (people.length < 2) return null;
  return (
    <fieldset className={cx('min-w-0', className)}>
      <legend className="mb-2 text-[0.8125rem] font-semibold text-ink-700">{t.who.picker}</legend>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-1">
        {people.map((p) => {
          const on = value.includes(p.id);
          return (
            <FacePill
              key={p.id}
              person={p}
              label={p.id === me.id ? t.common.you : p.name}
              on={on}
              onClick={() => {
                if (on && value.length === 1) return;
                onChange(on ? value.filter((id) => id !== p.id) : [...value, p.id]);
              }}
            />
          );
        })}
      </div>
    </fieldset>
  );
}

/** A small round check, ticked or not (episodes, the next episode). */
export function CheckMark({ on, className }: { on: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'grid size-10 shrink-0 place-items-center rounded-full text-[1.3rem] transition-colors duration-200',
        on ? 'bg-ink-900 text-white' : 'bg-white text-ink-400 ring-1 ring-inset ring-ink-200',
        className,
      )}
    >
      <CheckIcon fontSize="inherit" />
    </span>
  );
}
