import { useId } from 'react';
import { AddIcon, RemoveIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { haptic } from '@/lib/haptics';

interface StepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** How the value reads ("3 h 15 min"); the bare number by default. */
  format?: (value: number) => string;
  className?: string;
}

/** A count between − and +: 44px round buttons either side of a big number. Steps land on multiples of `step`. */
export function Stepper({ label, value, onChange, min = 0, max = 500, step = 1, format, className }: StepperProps) {
  const id = useId();
  const set = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next));
    if (clamped === value) return;
    haptic('tap');
    onChange(clamped);
  };
  const button =
    'press grid size-11 shrink-0 place-items-center rounded-full bg-white text-[1.35rem] text-ink-900 shadow-[var(--shadow-xs)] ring-1 ring-inset ring-ink-100 hover:bg-lav-50 disabled:opacity-35';
  return (
    <div className={cx('flex items-center justify-between gap-3 rounded-[1.125rem] bg-ink-50 p-1.5 pl-4', className)}>
      <span id={id} className="text-[0.9375rem] font-semibold text-ink-800">
        {label}
      </span>
      <span role="group" aria-labelledby={id} className="flex items-center gap-1">
        <button type="button" className={button} onClick={() => set(Math.ceil(value / step) * step - step)} disabled={value <= min} aria-label={`Fewer: ${label}`}>
          <RemoveIcon fontSize="inherit" />
        </button>
        <output aria-live="polite" className="tabular min-w-[3.25rem] px-1 text-center text-[1.125rem] font-bold">
          {format ? format(value) : value}
        </output>
        <button type="button" className={button} onClick={() => set(Math.floor(value / step) * step + step)} disabled={value >= max} aria-label={`More: ${label}`}>
          <AddIcon fontSize="inherit" />
        </button>
      </span>
    </div>
  );
}
