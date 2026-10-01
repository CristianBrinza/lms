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
  /** `well` (default) sits on a white card; `raised` is a white field for the grey page itself (search). */
  surface?: 'well' | 'raised';
}

/**
 * LMS fields are filled, like the mood apps' search bar: a soft grey well with no border at rest,
 * turning white with a crisp ink outline while you type. Errors tint the well and outline it red.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hideLabel, icon: Icon, error, hint, trailing, surface = 'well', className, id, disabled, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = [error ? `${inputId}-error` : null, hint ? `${inputId}-hint` : null].filter(Boolean).join(' ');

  return (
    <div className={cx('flex min-w-0 flex-col gap-2', className)}>
      <label htmlFor={inputId} className={cx('text-[0.8125rem] font-semibold text-ink-700', hideLabel && 'sr-only')}>
        {label}
      </label>
      <div className="group/field relative">
        {Icon ? (
          <Icon
            fontSize="inherit"
            className={cx(
              'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[1.25rem] transition-colors',
              error ? 'text-danger-600' : 'text-ink-400 group-focus-within/field:text-ink-900',
            )}
          />
        ) : null}
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cx(
            'h-14 w-full min-w-0 appearance-none rounded-[1.125rem] text-left text-base text-ink-900 outline-none transition-[background-color,box-shadow] duration-150',
            'placeholder:text-ink-500 disabled:cursor-not-allowed disabled:text-ink-500',
            Icon ? 'pl-12' : 'pl-4',
            trailing ? 'pr-14' : 'pr-4',
            error
              ? 'bg-danger-50 shadow-[inset_0_0_0_2px_var(--color-danger-600)]'
              : surface === 'raised'
                ? 'bg-white shadow-[var(--shadow-xs),inset_0_0_0_1px_var(--color-ink-100)] focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]'
                : 'bg-ink-50 hover:bg-ink-100 focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)] disabled:hover:bg-ink-50',
          )}
          {...rest}
        />
        {trailing ? <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div> : null}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="flex items-start gap-1.5 text-sm font-medium text-danger-600">
          <ErrorIcon fontSize="inherit" className="mt-[0.15rem] text-base" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-ink-600">
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
          className="press inline-flex size-10 items-center justify-center rounded-[0.875rem] text-[1.25rem] text-ink-500 hover:bg-white hover:text-ink-900"
        >
          <Toggle fontSize="inherit" />
        </button>
      }
    />
  );
});
