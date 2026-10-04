import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { haptic } from '@/lib/haptics';
import { CheckIcon } from './icons';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  hint?: ReactNode;
}

/**
 * An option you turn on or off, as a whole row (the yellow app's chips): a grey well at rest, a
 * butter one with a filled check when on. Still a real checkbox for keyboards, forms and
 * password managers.
 */
export function Checkbox({ label, hint, className, id, onChange, ...rest }: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label
      htmlFor={inputId}
      className={cx(
        'group relative flex min-h-14 cursor-pointer items-center gap-3 rounded-[1.125rem] bg-ink-50 px-4 py-3 transition-colors duration-200',
        'has-[:checked]:bg-butter-100 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-lav-700 hover:bg-ink-100 has-[:checked]:hover:bg-butter-200',
        className,
      )}
    >
      <input
        id={inputId}
        type="checkbox"
        className="peer sr-only"
        onChange={(event) => {
          haptic('tap');
          onChange?.(event);
        }}
        {...rest}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-semibold text-ink-900">{label}</span>
        {hint ? <span className="mt-0.5 block text-sm text-ink-600">{hint}</span> : null}
      </span>
      <span
        aria-hidden="true"
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-[1.1rem] text-transparent shadow-[inset_0_0_0_2px_var(--color-ink-300)] transition-[background-color,box-shadow,color] duration-200 peer-checked:bg-butter-300 peer-checked:text-ink-900 peer-checked:shadow-none"
      >
        <CheckIcon
          fontSize="inherit"
          className="scale-50 transition-[scale] duration-300 ease-(--ease-lift) group-has-[:checked]:scale-100"
        />
      </span>
    </label>
  );
}
