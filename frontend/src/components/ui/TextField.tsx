import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { ErrorIcon, VisibilityIcon, VisibilityOffIcon, type IconComponent } from './icons';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean;
  icon?: IconComponent;
  error?: string;
  hint?: ReactNode;
  trailing?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hideLabel, icon: Icon, error, hint, trailing, className, id, disabled, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = [error ? `${inputId}-error` : null, hint ? `${inputId}-hint` : null].filter(Boolean).join(' ');

  return (
    <div className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className={cx('pl-1 text-sm font-semibold text-ink-800', hideLabel && 'sr-only')}>
        {label}
      </label>
      <div className="relative">
        {Icon ? (
          <Icon
            fontSize="inherit"
            className={cx('pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[1.25rem]', error ? 'text-danger-600' : 'text-ink-500')}
          />
        ) : null}
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cx(
            'h-14 w-full min-w-0 appearance-none rounded-2xl bg-white text-left text-base text-ink-900 outline-none transition-[box-shadow,border-color] duration-150',
            'border placeholder:text-ink-500 disabled:bg-ink-50 disabled:text-ink-500',
            Icon ? 'pl-[3.25rem]' : 'pl-5',
            trailing ? 'pr-14' : 'pr-5',
            error
              ? 'border-danger-600 focus:shadow-[0_0_0_4px_var(--color-danger-100)]'
              : 'border-ink-200 hover:border-ink-300 focus:border-lav-600 focus:shadow-[0_0_0_4px_var(--color-lav-200)]',
          )}
          {...rest}
        />
        {trailing ? <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div> : null}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="flex items-start gap-1.5 pl-1 text-sm font-medium text-danger-600">
          <ErrorIcon fontSize="inherit" className="mt-[0.15rem] text-base" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="pl-1 text-sm text-ink-600">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export const PasswordField = forwardRef<HTMLInputElement, Omit<TextFieldProps, 'type' | 'trailing'>>(function PasswordField(props, ref) {
  const [visible, setVisible] = useState(false);
  const Toggle = visible ? VisibilityOffIcon : VisibilityIcon;
  return (
    <TextField
      ref={ref}
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      {...props}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="press inline-flex size-10 items-center justify-center rounded-full text-[1.3rem] text-ink-600 hover:bg-lav-50"
        >
          <Toggle fontSize="inherit" />
        </button>
      }
    />
  );
});
