import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cx } from '@/lib/cx';
import type { IconComponent } from './icons';

type Variant = 'white' | 'outline' | 'soft' | 'ink' | 'accent' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  // The reference's round settings and bell buttons: white circles on the lavender field.
  white: 'bg-white text-ink-900 shadow-[var(--shadow-card)] hover:bg-lav-50',
  // The task app's settings / back circles on a white screen: a hairline ring.
  outline: 'bg-white text-ink-900 ring-1 ring-inset ring-ink-200 hover:bg-ink-50',
  soft: 'bg-lav-100 text-ink-900 hover:bg-lav-200',
  ink: 'bg-ink-900 text-white shadow-[0_10px_20px_-10px_rgb(29_29_36/0.8)] hover:bg-ink-800',
  accent: 'bg-lav-600 text-white hover:bg-lav-700',
  ghost: 'bg-transparent text-ink-800 hover:bg-ink-900/5',
};

const SIZES: Record<Size, string> = {
  sm: 'size-10 text-[1.25rem]',
  md: 'size-12 text-[1.4rem]',
  lg: 'size-14 text-[1.5rem]',
};

interface Common {
  icon: IconComponent;
  /** Accessible name: icon buttons have no visible text. */
  label: string;
  variant?: Variant;
  size?: Size;
  /** A small dot in the corner (something new). */
  dot?: boolean;
}

function classes(variant: Variant, size: Size, className?: string) {
  return cx(
    'press relative inline-flex shrink-0 items-center justify-center rounded-full disabled:opacity-45',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

function Dot() {
  return (
    <span
      aria-hidden="true"
      className="absolute right-[22%] top-[22%] size-2 rounded-full bg-lav-600 ring-2 ring-white"
    />
  );
}

export const IconButton = forwardRef<
  HTMLButtonElement,
  Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>
>(function IconButton(
  { icon: Icon, label, variant = 'white', size = 'md', dot, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={classes(variant, size, className)}
      {...rest}
    >
      <Icon fontSize="inherit" />
      {dot ? <Dot /> : null}
    </button>
  );
});

export function IconLink({
  icon: Icon,
  label,
  variant = 'white',
  size = 'md',
  dot,
  className,
  ...rest
}: Common & Omit<LinkProps, 'children'>) {
  return (
    <Link aria-label={label} title={label} className={classes(variant, size, className)} {...rest}>
      <Icon fontSize="inherit" />
      {dot ? <Dot /> : null}
    </Link>
  );
}
