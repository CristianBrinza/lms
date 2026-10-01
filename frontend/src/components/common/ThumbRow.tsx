import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronRightIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';

interface ThumbRowProps {
  to: string;
  /** The round picture on the left: a doodle, an avatar. */
  thumb: ReactNode;
  /** The thumbnail circle's colour. */
  thumbClassName?: string;
  title: string;
  detail?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}

/**
 * The learning app's lesson row: a raised rounded block with a round picture on the left, a title
 * that may run to two lines, and a chevron. The whole row is the link.
 */
export function ThumbRow({ to, thumb, thumbClassName, title, detail, trailing, className }: ThumbRowProps) {
  return (
    <Link
      to={to}
      viewTransition
      className={cx(
        'press flex min-h-20 items-center gap-3.5 rounded-[1.375rem] bg-white p-3 pr-4 shadow-[var(--shadow-xs)] ring-1 ring-inset ring-ink-100 transition-[box-shadow,translate] duration-200 hover:-translate-y-px hover:shadow-[var(--shadow-card)]',
        className,
      )}
    >
      <span className={cx('flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full', thumbClassName)}>{thumb}</span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[0.9375rem] font-semibold leading-snug text-ink-900">{title}</span>
        {detail ? <span className="mt-0.5 block truncate text-sm text-ink-600">{detail}</span> : null}
      </span>
      {trailing ?? <ChevronRightIcon fontSize="inherit" className="shrink-0 text-[1.4rem] text-ink-400" />}
    </Link>
  );
}
