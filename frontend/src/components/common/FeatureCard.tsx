import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowOutIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';

interface FeatureCardProps {
  to: string;
  title: string;
  /** Small pills under the title (the yellow app's "10 min · Evening"). */
  pills: string[];
  tone: 'butter' | 'white' | 'cyan';
  /** Optional corner control (a dismiss button). */
  corner?: ReactNode;
  className?: string;
}

const TONES = {
  butter: { card: 'bg-butter-300', pill: ['bg-white text-ink-900', 'bg-butter-200 text-butter-800'], button: 'bg-white text-ink-900' },
  white: { card: 'bg-white ring-1 ring-inset ring-ink-100', pill: ['bg-butter-100 text-butter-800', 'bg-white ring-1 ring-inset ring-ink-200 text-ink-700'], button: 'bg-butter-300 text-ink-900' },
  cyan: { card: 'bg-cyan-200', pill: ['bg-white text-ink-900', 'bg-cyan-100 text-cyan-800'], button: 'bg-white text-ink-900' },
} as const;

/** A "Featured for you" row card: title, pills, and a round button on the right. The whole card is the link. */
export function FeatureCard({ to, title, pills, tone, corner, className }: FeatureCardProps) {
  const t = TONES[tone];
  return (
    <div className={cx('relative animate-rise rounded-3xl', t.card, className)}>
      <Link to={to} viewTransition className="press group/feature flex items-center gap-3 rounded-3xl p-4 pr-3.5 sm:p-5">
        <span className="min-w-0 flex-1">
          <span className="block text-[1.0625rem] font-bold leading-snug text-ink-900">{title}</span>
          <span className="mt-2.5 flex flex-wrap gap-1.5">
            {pills.map((pill, index) => (
              <span key={pill} className={cx('inline-flex h-7 items-center rounded-pill px-2.5 text-xs font-semibold', t.pill[index % 2])}>
                {pill}
              </span>
            ))}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={cx('flex size-12 shrink-0 items-center justify-center rounded-full text-[1.3rem] shadow-[0_6px_14px_-8px_rgb(29_29_36/0.45)] transition-transform duration-300 ease-(--ease-lift) group-hover/feature:rotate-45', t.button)}
        >
          <ArrowOutIcon fontSize="inherit" />
        </span>
      </Link>
      {corner}
    </div>
  );
}
