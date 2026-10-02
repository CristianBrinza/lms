import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

const TONES = {
  ink: 'bg-ink-900 text-white',
  lav: 'bg-lav-100 text-lav-800',
  muted: 'bg-ink-100 text-ink-700',
  danger: 'bg-danger-50 text-danger-700',
  mint: 'bg-mint-100 text-mint-800',
  peach: 'bg-peach-100 text-peach-800',
  butter: 'bg-butter-100 text-butter-800',
} as const;

export function Badge({ tone = 'lav', children, className }: { tone?: keyof typeof TONES; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-pill px-2.5 text-xs font-semibold', TONES[tone], className)}>
      {children}
    </span>
  );
}
