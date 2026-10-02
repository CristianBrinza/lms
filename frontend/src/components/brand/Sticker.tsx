import type { CSSProperties, ReactNode } from 'react';
import { cx } from '@/lib/cx';

/** A label pill stuck on at an angle, like the reference's "Design" and "Marketing" stickers. */
export function Sticker({
  children,
  className,
  delay,
}: {
  children: ReactNode;
  className?: string;
  delay: number;
}) {
  const style: CSSProperties = { animationDelay: `${delay}ms` };
  return (
    <span
      aria-hidden="true"
      style={style}
      className={cx(
        'inline-block animate-pop rounded-pill px-3.5 py-1.5 text-[0.9375rem] font-semibold leading-none tracking-normal text-ink-900 shadow-[0_8px_16px_-10px_rgb(29_29_36/0.45)] sm:text-base',
        className,
      )}
    >
      {children}
    </span>
  );
}
