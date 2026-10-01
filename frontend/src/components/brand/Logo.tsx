import logoUrl from '@/assets/logo.svg';
import { cx } from '@/lib/cx';

/**
 * The LMS logo: the red tile with its white sparkle (brand/logo.svg, copied to src/assets by
 * scripts/brand-assets.mjs). Red lives here and nowhere else in the interface.
 */
export function LogoTile({ className, label = 'LMS' }: { className?: string; label?: string | null }) {
  return (
    <img
      src={logoUrl}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      width={56}
      height={56}
      draggable={false}
      className={cx('block aspect-square select-none rounded-[26%] shadow-[0_8px_18px_-10px_rgb(42_43_102/0.45)]', className)}
    />
  );
}

/** Tile + wordmark, for the start, sign-in and install screens. */
export function Lockup({ className }: { className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <LogoTile className="size-9" label={null} />
      <span className="text-[1.375rem] font-extrabold tracking-[-0.04em] text-ink-900">LMS</span>
    </span>
  );
}
