import type { ReactNode } from 'react';
import type { IconComponent } from '@/components/ui/icons';
import { cx } from '@/lib/cx';

/** One of several, on or off (people going, bags taken). */
export function ToggleChip({
  on,
  onClick,
  icon: Icon,
  leading,
  children,
}: {
  on: boolean;
  onClick: () => void;
  icon?: IconComponent;
  leading?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        'press inline-flex h-10 shrink-0 items-center gap-2 rounded-pill text-sm font-semibold transition-colors',
        leading ? 'pl-1 pr-3.5' : 'px-3.5',
        on ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
      )}
    >
      {leading}
      {Icon ? <Icon fontSize="inherit" className="text-[1.15rem]" /> : null}
      {children}
    </button>
  );
}

/** A labelled block of the trip form. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h2 className="text-[0.8125rem] font-semibold text-ink-700">{label}</h2>
        {hint ? <p className="text-xs text-ink-500">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** A thin bar: how much of the checklist is packed. */
export function PackedBar({
  done,
  total,
  className,
}: {
  done: number;
  total: number;
  className?: string;
}) {
  const share = total ? done / total : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-label="Packed"
      className={cx('h-2 overflow-hidden rounded-full bg-ink-100', className)}
    >
      <div
        className={cx(
          'h-full rounded-full transition-[width] duration-500',
          share >= 1 ? 'bg-mint-800' : 'bg-cyan-400',
        )}
        style={{ width: `${Math.round(share * 100)}%` }}
      />
    </div>
  );
}
