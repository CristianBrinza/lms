import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/cx';

/**
 * A bar docked flush on top of the bottom menu, edge to edge, square: the cart while shopping,
 * "Plan it / Cook now" on a recipe. On desktop (no bottom menu) it sticks to the bottom of the page
 * panel instead. Rendered in <body> on phones: the page's entrance animation transforms its box,
 * which would re-anchor `fixed`.
 */
export function DockBar({ children, tone = 'ink', className }: { children: ReactNode; tone?: 'ink' | 'white'; className?: string }) {
  const surface = tone === 'ink' ? 'bg-ink-900 text-white' : 'bg-white text-ink-900 shadow-[0_-1px_0_var(--color-ink-100)]';
  return (
    <>
      {createPortal(
        <div
          className={cx('fixed inset-x-0 z-[41] animate-rise px-4 py-2.5 lg:hidden', surface, className)}
          style={{ bottom: 'var(--tabbar-real, calc(var(--tabbar-h) + var(--safe-bottom)))' }}
        >
          <div className="mx-auto flex max-w-md items-center gap-3">{children}</div>
        </div>,
        document.body,
      )}
      <div className={cx('sticky bottom-0 z-30 mt-6 hidden px-8 py-3 lg:block lg:rounded-b-3xl', surface, className)}>
        <div className="mx-auto flex max-w-3xl items-center gap-3">{children}</div>
      </div>
    </>
  );
}
