import { cx } from '@/lib/cx';

/** A placeholder shape while content loads: a soft lavender shimmer. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx('block animate-shimmer rounded-xl bg-[linear-gradient(90deg,var(--color-lav-100)_25%,var(--color-lav-50)_50%,var(--color-lav-100)_75%)] bg-[length:200%_100%]', className)}
    />
  );
}
