import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { CheckIcon } from './icons';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  hint?: ReactNode;
}

/** A real checkbox (keyboard, forms, password managers) drawn as a rounded ink box. */
export function Checkbox({ label, hint, className, id, ...rest }: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label htmlFor={inputId} className={cx('group flex min-h-11 cursor-pointer items-start gap-3 py-1.5', className)}>
      <span className="relative mt-px inline-flex size-6 shrink-0">
        <input
          id={inputId}
          type="checkbox"
          className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-lg border-2 border-ink-300 bg-white transition-colors duration-150 checked:border-ink-900 checked:bg-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lav-700"
          {...rest}
        />
        <CheckIcon fontSize="inherit" className="pointer-events-none absolute inset-0 m-auto text-[1.1rem] text-white opacity-0 transition-opacity duration-150 peer-checked:opacity-100" />
      </span>
      <span className="min-w-0">
        <span className="block text-[0.9375rem] font-medium text-ink-900">{label}</span>
        {hint ? <span className="mt-0.5 block text-sm text-ink-600">{hint}</span> : null}
      </span>
    </label>
  );
}
