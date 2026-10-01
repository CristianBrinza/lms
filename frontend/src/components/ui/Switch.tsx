import { useId, type ReactNode } from 'react';
import { cx } from '@/lib/cx';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/** An on/off setting: role="switch" on a real button, the knob slides on the indigo track. */
export function Switch({ checked, onChange, label, hint, disabled, className }: SwitchProps) {
  const id = useId();
  return (
    <div className={cx('flex items-start justify-between gap-4 py-1', className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[0.9375rem] font-medium text-ink-900">
          {label}
        </label>
        {hint ? <p className="mt-0.5 text-sm text-ink-600">{hint}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-pill transition-colors duration-200 disabled:opacity-45',
          checked ? 'bg-lav-600' : 'bg-ink-300',
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            'absolute left-0.5 size-6 rounded-full bg-white shadow-[0_2px_6px_rgb(29_29_36/0.25)] transition-transform duration-250 ease-(--ease-lift)',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}
