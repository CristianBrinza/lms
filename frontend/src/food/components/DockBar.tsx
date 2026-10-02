import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/cx';

/**
 * A bar docked flush on top of the bottom menu, edge to edge, square: the cart while shopping,
 * "Plan it / Cook now" on a recipe. On tablets and desktop (no bottom menu) it floats as a bar
 * stuck to the bottom of the page panel instead. Rendered in <body> on phones: the page's entrance animation transforms its box,
 * which would re-anchor `fixed`.
 */
export function DockBar({ children, tone = 'ink', className }: { children: ReactNode; tone?: 'ink' | 'white'; className?: string }) {
  const surface = tone === 'ink' ? 'bg-ink-900 text-white' : 'bg-white text-ink-900 shadow-[0_-1px_0_var(--color-ink-100)]';
  return (
    <>
      {createPortal(
        <div
          className={cx('fixed inset-x-0 z-[41] animate-rise px-4 py-2.5 md:hidden', surface, className)}
          style={{ bottom: 'var(--tabbar-real, calc(var(--tabbar-h) + var(--safe-bottom)))' }}
        >
          <div className="mx-auto flex max-w-md items-center gap-3">{children}</div>
        </div>,
        document.body,
      )}
      <div className={cx('sticky bottom-[max(0.75rem,var(--safe-bottom))] z-30 mt-6 hidden rounded-3xl px-6 py-3 shadow-card md:mx-4 md:block lg:mx-8', surface, className)}>
        <div className="mx-auto flex max-w-3xl items-center gap-3">{children}</div>
      </div>
    </>
  );
}
