import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui';
import { MedicationIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import type { ExpiryState, Package, PhotoRef, Person } from '../api';
import { useMedicationT } from '../i18n';
import { TONES, expiryText } from '../logic';

/** Medication's furniture: the screen frame, the expiry chips, the pill thumbnail, small pickers. */

export function MedScreen({
  title,
  subtitle,
  back = '/medication',
  actions,
  wide,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string;
  actions?: ReactNode;
  /** The cabinet uses the whole width; reading screens keep a column. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <Screen tone="white">
      <PageHeader compact back={back} title={title} subtitle={subtitle} actions={actions} />
      <div className="gutter-x mt-2 md:px-5 lg:px-8">
        <div className={cx('mx-auto', wide ? 'max-w-5xl' : 'max-w-3xl')}>{children}</div>
      </div>
    </Screen>
  );
}

export function ErrorCard({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useMedicationT();
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

export function EmptyCard({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-3xl bg-white p-6 text-center shadow-[var(--shadow-card)]">
      <span
        aria-hidden="true"
        className="mx-auto grid size-14 place-items-center rounded-full bg-mint-200 text-[1.75rem] text-mint-800"
      >
        <MedicationIcon fontSize="inherit" />
      </span>
      <p className="mt-3 text-[1.0625rem] font-bold">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-600">{detail}</p>
      {children ? <div className="mt-4 flex justify-center">{children}</div> : null}
    </div>
  );
}

/** A medicine's photo, or a pill on a mint tile when it has none. */
export function Thumb({
  cover,
  className,
}: {
  cover: PhotoRef | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-[1rem] bg-mint-200 text-[1.5rem] text-mint-800',
        className ?? 'size-14',
      )}
    >
      {cover ? (
        <img src={cover.thumb} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
      ) : (
        <MedicationIcon fontSize="inherit" />
      )}
    </span>
  );
}

/** green ok, amber expiring within 30 days, red expired: with the date or how soon. */
export function ExpiryChip({ pkg, className }: { pkg: Package; className?: string }) {
  const t = useMedicationT();
  const state: ExpiryState = pkg.expiry.state;
  const date = pkg.effectiveExpiry
    ? pkg.effectiveExpiry === pkg.expiresOn
      ? expiryText(pkg.expiresOn, pkg.monthOnly)
      : formatDate(pkg.effectiveExpiry)
    : '';
  const label =
    state === 'none'
      ? t.expiry.none
      : state === 'expired'
        ? t.expiry.expired(date)
        : state === 'soon'
          ? t.expiry.soon(pkg.expiry.days ?? 0)
          : t.expiry.ok(date);
  return (
    <span
      className={cx(
        'tabular inline-flex h-7 items-center rounded-pill px-2.5 text-xs font-bold',
        TONES[state],
        className,
      )}
    >
      <span className="sr-only">{t.expiryState[state]}: </span>
      {label}
    </span>
  );
}

/** Whose doses: "Everyone" and each person, as chips. */
export function PersonChips({
  people,
  value,
  onChange,
  all,
}: {
  people: Person[];
  value: string;
  onChange: (id: string) => void;
  /** Offer "Everyone" (value ''). */
  all?: boolean;
}) {
  const t = useMedicationT();
  const options = [...(all ? [{ id: '', name: t.everyone }] : []), ...people.map((p) => ({ id: p.id, name: p.name }))];
  return (
    <div role="radiogroup" aria-label={t.person} className="-mx-1 flex flex-wrap gap-1.5 px-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          onClick={() => onChange(option.id)}
          className={cx(
            'press h-9 rounded-pill px-3.5 text-sm font-semibold transition-colors',
            value === option.id ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
          )}
        >
          {option.name}
        </button>
      ))}
    </div>
  );
}

export function Disclaimer() {
  const t = useMedicationT();
  return <p className="mt-8 px-1 text-center text-xs text-ink-500">{t.disclaimer}</p>;
}

