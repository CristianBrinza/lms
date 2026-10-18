import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

/**
 * A section of a meal or recipe — Felul întâi, Felul doi, Băuturi — named at its top left, in the
 * same type as the meal sheet's "Who eats".
 */
export function SectionHeading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={cx('text-[0.8125rem] font-semibold text-ink-700', className)}>{children}</h3>
  );
}
