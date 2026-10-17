import { cx } from '@/lib/cx';
import { dayLong, expiry, type ExpiryTone } from '../format';
import { foodUiT } from './components.i18n';

const TONE: Record<ExpiryTone, string> = {
  expired: 'bg-danger-50 text-danger-700',
  today: 'bg-peach-200 text-peach-800',
  soon: 'bg-peach-100 text-peach-800',
  later: 'bg-ink-100 text-ink-700',
  none: 'bg-ink-100 text-ink-500',
};

/** How long food keeps, as a small pill: red when past, peach within three days, grey after. */
export function ExpiryChip({
  expiresOn,
  today,
  compact,
  className,
}: {
  expiresOn: string | null;
  today?: string;
  compact?: boolean;
  className?: string;
}) {
  const t = foodUiT().expiry;
  const state = expiry(expiresOn, today);
  if (compact && state.tone === 'none') return null;
  const label = compact && state.tone === 'expired' ? t.expired : state.label;
  return (
    <span
      title={expiresOn ? t.bestBefore(dayLong(expiresOn)) : t.noBestBefore}
      className={cx(
        'tabular inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-pill px-2 text-xs font-semibold',
        TONE[state.tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
