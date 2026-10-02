import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cx } from '@/lib/cx';
import { ChevronRightIcon, type IconComponent } from './icons';

interface RowBase {
  icon?: IconComponent;
  label: ReactNode;
  detail?: ReactNode;
  /** Right side: a value, a badge, a switch. A chevron shows for links and buttons without it. */
  trailing?: ReactNode;
  tone?: 'default' | 'danger';
}

function Inner({ icon: Icon, label, detail, trailing, tone = 'default', chevron }: RowBase & { chevron?: boolean }) {
  return (
    <>
      {Icon ? <Icon fontSize="inherit" className={cx('shrink-0 text-[1.45rem]', tone === 'danger' ? 'text-danger-600' : 'text-ink-800')} /> : null}
      <span className="min-w-0 flex-1">
        <span className={cx('block truncate text-[0.9375rem] font-semibold', tone === 'danger' ? 'text-danger-600' : 'text-ink-900')}>{label}</span>
        {detail ? <span className="mt-0.5 line-clamp-2 text-sm leading-snug text-ink-600">{detail}</span> : null}
      </span>
      {trailing ?? (chevron ? <ChevronRightIcon fontSize="inherit" className="shrink-0 text-[1.4rem] text-ink-400" /> : null)}
    </>
  );
}

const rowClass = 'flex min-h-16 w-full items-center gap-3.5 px-4 py-3 text-left';
const interactive = 'press transition-colors hover:bg-ink-50 active:bg-ink-100';

/** A settings row (the mood apps' "Notifications / Language / FAQ" list): outlined icon, label, detail, chevron. */
export function ListRow(props: RowBase) {
  return (
    <div className={rowClass}>
      <Inner {...props} />
    </div>
  );
}

export function ListRowLink({ to, ...props }: RowBase & { to: string }) {
  return (
    <Link to={to} className={cx(rowClass, interactive)}>
      <Inner {...props} chevron />
    </Link>
  );
}

export function ListRowButton({ onClick, disabled, ...props }: RowBase & { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cx(rowClass, interactive, 'disabled:opacity-50')}>
      <Inner {...props} chevron={props.trailing === undefined && props.tone !== 'danger'} />
    </button>
  );
}

/** Rows on a white screen, in a hairline-ringed group, separated by hairlines. */
export function ListGroup({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      {title ? <h2 className="mb-2.5 px-1 text-h3 font-bold text-ink-900">{title}</h2> : null}
      <div className="divide-y divide-ink-100 overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70">{children}</div>
    </section>
  );
}
