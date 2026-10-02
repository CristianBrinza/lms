import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { IconButton } from '@/components/ui';
import { ArrowBackIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';

interface PageHeaderProps {
  title: ReactNode;
  /** A line under the title (counts, an email). */
  subtitle?: ReactNode;
  /** Where "back" goes when there is no history (opened from a link or the Home Screen). */
  back?: string;
  /** Round buttons on the right. */
  actions?: ReactNode;
  /**
   * Sub-pages (one person, a form): the learning app's "AI Assistant" header, an outlined back
   * button, the title small and centred, the actions opposite. No big title.
   */
  centered?: boolean;
  className?: string;
}

/** A screen's top: round back button and actions, then a big tight title (both references). */
export function PageHeader({ title, subtitle, back, actions, centered, className }: PageHeaderProps) {
  const navigate = useNavigate();
  const goBack = () => {
    if (back && window.history.state?.idx > 0) navigate(-1);
    else if (back) navigate(back, { replace: true });
  };
  if (centered) {
    return (
      <header className={cx('gutter-x grid grid-cols-[minmax(3rem,auto)_minmax(0,1fr)_minmax(3rem,auto)] items-center gap-2 pt-[calc(var(--safe-top)+1rem)] lg:px-8 lg:pt-7', className)}>
        {back ? <IconButton icon={ArrowBackIcon} label="Back" variant="outline" onClick={goBack} /> : <span />}
        <h1 className="truncate text-center text-[1.0625rem] font-semibold">{title}</h1>
        <div className="flex justify-end">{actions}</div>
      </header>
    );
  }
  return (
    <header className={cx('gutter-x pt-[calc(var(--safe-top)+1rem)] lg:px-8 lg:pt-7', className)}>
      {back || actions ? (
        <div className="flex min-h-12 items-center justify-between gap-3">
          {back ? <IconButton icon={ArrowBackIcon} label="Back" variant="outline" onClick={goBack} /> : <span />}
          {actions ? <div className="flex items-center gap-2.5">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cx(back || actions ? 'mt-5' : 'mt-3')}>
        <h1 className="text-h1 font-bold lg:text-[2.5rem]">{title}</h1>
        {subtitle ? <p className="mt-1.5 max-w-xl text-[0.9375rem] font-medium text-ink-600 [overflow-wrap:anywhere]">{subtitle}</p> : null}
      </div>
    </header>
  );
}
