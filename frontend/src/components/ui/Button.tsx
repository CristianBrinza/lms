import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cx } from '@/lib/cx';
import { Spinner } from './Spinner';
import type { IconComponent } from './icons';

export type ButtonVariant = 'primary' | 'accent' | 'soft' | 'tint' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'lg' | 'md' | 'sm';

const VARIANTS: Record<ButtonVariant, string> = {
  // The one action colour: an ink pill (the reference's "Today" / "All Tasks").
  primary: 'bg-ink-900 text-white hover:bg-ink-800 shadow-[0_1px_2px_rgb(29_29_36/0.3),0_12px_22px_-12px_rgb(29_29_36/0.85)]',
  // The indigo accent, for the single most important action on a lavender screen.
  accent: 'bg-lav-600 text-white hover:bg-lav-700 shadow-fab',
  // A white pill on the lavender field (the reference's "In Progress" chip as a button).
  soft: 'bg-white text-ink-900 shadow-[var(--shadow-card)] hover:bg-lav-50',
  // Its counterpart on white sheets: a lavender pill.
  tint: 'bg-lav-100 text-ink-900 hover:bg-lav-200',
  outline: 'bg-white/30 text-ink-900 ring-1 ring-inset ring-ink-900/20 hover:bg-white/60',
  ghost: 'bg-transparent text-ink-900 hover:bg-ink-900/5',
  danger: 'bg-danger-600 text-white shadow-[0_12px_22px_-12px_rgb(161_29_56/0.8)] hover:bg-danger-700',
};

// 56 / 48 / 40 px: a full-width call to action, the everyday button, a compact inline one.
const SIZES: Record<ButtonSize, string> = {
  lg: 'h-14 px-7 text-base gap-2.5',
  md: 'h-12 px-5 text-[0.9375rem] gap-2',
  sm: 'h-10 px-4 text-sm gap-1.5',
};

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconComponent;
  trailingIcon?: IconComponent;
  fullWidth?: boolean;
  children?: ReactNode;
}

function classes({ variant = 'primary', size = 'lg', fullWidth }: CommonProps, className?: string) {
  return cx(
    'press group/btn relative inline-flex select-none items-center justify-center whitespace-nowrap rounded-pill font-semibold',
    'disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:cursor-not-allowed aria-disabled:opacity-45',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    className,
  );
}

function Content({ icon: Icon, trailingIcon: Trailing, loading, children, size = 'lg' }: CommonProps & { loading?: boolean }) {
  const iconSize = size === 'sm' ? 'text-lg' : 'text-[1.3rem]';
  return (
    <>
      {loading ? <Spinner className="size-5" /> : Icon ? <Icon className={iconSize} fontSize="inherit" /> : null}
      {children ? <span className="truncate">{children}</span> : null}
      {Trailing && !loading ? (
        <Trailing
          className={cx(iconSize, 'transition-transform duration-200 ease-(--ease-out) group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5')}
          fontSize="inherit"
        />
      ) : null}
    </>
  );
}

export interface ButtonProps extends CommonProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, icon, trailingIcon, fullWidth, loading, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes({ variant, size, fullWidth }, className)}
      {...rest}
    >
      <Content icon={icon} trailingIcon={trailingIcon} loading={loading} size={size}>
        {children}
      </Content>
    </button>
  );
});

export interface ButtonLinkProps extends CommonProps, Omit<LinkProps, 'children'> {}

/** A router link that looks like a button. */
export function ButtonLink({ variant, size, icon, trailingIcon, fullWidth, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={classes({ variant, size, fullWidth }, className)} {...rest}>
      <Content icon={icon} trailingIcon={trailingIcon} size={size}>
        {children}
      </Content>
    </Link>
  );
}

/** A plain anchor with button styling (mailto:, external links, downloads). */
export function ButtonAnchor({
  variant,
  size,
  icon,
  trailingIcon,
  fullWidth,
  className,
  children,
  ...rest
}: CommonProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'>) {
  return (
    <a className={classes({ variant, size, fullWidth }, className)} {...rest}>
      <Content icon={icon} trailingIcon={trailingIcon} size={size}>
        {children}
      </Content>
    </a>
  );
}
