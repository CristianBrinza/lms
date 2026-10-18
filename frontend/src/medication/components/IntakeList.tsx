import { cx } from '@/lib/cx';
import { formatDate, formatTime } from '@/lib/format';
import type { Dose } from '../api';
import { useMedicationT } from '../i18n';

/** Intake as a list: the day, the time, who, and whether it was taken, skipped or missed. */
export function IntakeList({ doses }: { doses: Dose[] }) {
  const t = useMedicationT();
  return (
    <ul className="divide-y divide-ink-100 rounded-3xl bg-white px-4 shadow-[var(--shadow-card)]">
      {doses.map((dose) => (
        <li key={dose.id} className="flex items-center gap-3 py-2.5">
          <span className="tabular w-24 shrink-0 text-sm font-semibold">{formatDate(dose.dueOn)}</span>
          <span className="tabular w-12 shrink-0 text-sm text-ink-600">
            {dose.dueTime ?? (dose.takenAt ? formatTime(dose.takenAt) : '')}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">
            {dose.personName}
            {dose.asNeeded ? <span className="text-ink-500"> · {t.asNeededTag}</span> : null}
          </span>
          <span
            className={cx(
              'inline-flex h-6 shrink-0 items-center rounded-pill px-2.5 text-xs font-bold',
              dose.state === 'taken'
                ? 'bg-mint-200 text-mint-800'
                : dose.state === 'missed'
                  ? 'bg-danger-100 text-danger-700'
                  : 'bg-ink-100 text-ink-700',
            )}
          >
            {t.state[dose.state]}
          </span>
        </li>
      ))}
    </ul>
  );
}
