import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button, toast } from '@/components/ui';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { formatTime } from '@/lib/format';
import { medicationApi, medicationKeys, type Dose, type DoseState } from '../api';
import { useMedicationT } from '../i18n';

const STATE_TONE: Record<DoseState, string> = {
  due: 'bg-lav-100 text-lav-800',
  taken: 'bg-mint-200 text-mint-800',
  skipped: 'bg-ink-100 text-ink-700',
  snoozed: 'bg-butter-300 text-ink-900',
  missed: 'bg-danger-100 text-danger-700',
};

/** One dose of the day: its time, what and how much, and the three answers: taken, skip, later. */
export function DoseCard({ dose, highlight }: { dose: Dose; highlight?: boolean }) {
  const t = useMedicationT();
  const client = useQueryClient();
  const [later, setLater] = useState(false);
  const done = dose.state === 'taken' || dose.state === 'skipped';

  const run = useMutation({
    mutationFn: (action: 'take' | 'skip' | 'undo' | 10 | 30) =>
      action === 'take'
        ? medicationApi.take(dose.id)
        : action === 'skip'
          ? medicationApi.skip(dose.id)
          : action === 'undo'
            ? medicationApi.undo(dose.id)
            : medicationApi.snooze(dose.id, action),
    onSuccess: (result, action) => {
      haptic(action === 'take' ? 'success' : 'tap');
      setLater(false);
      if (action === 'take' && result.dose.shortfall > 0) toast.info(t.shortfall);
    },
    onError: (error) => toast.error(t.failed, { description: errorMessage(error) }),
    onSettled: () => client.invalidateQueries({ queryKey: medicationKeys.all }),
  });

  const detail = [dose.personName, t.qty(dose.amount, dose.unit, dose.form)].join(' · ');
  const snoozed = dose.snoozedUntil && dose.state === 'snoozed' ? formatTime(dose.snoozedUntil) : null;
  return (
    <article
      id={`dose-${dose.id}`}
      className={cx(
        'rounded-3xl bg-white p-4 shadow-[var(--shadow-card)]',
        highlight && 'ring-2 ring-inset ring-ink-900',
        done && 'opacity-80',
      )}
    >
      <div className="flex items-start gap-3">
        <span className="tabular w-[3.75rem] shrink-0 text-[1.375rem] font-bold leading-tight tracking-[-0.02em]">
          {dose.dueTime ?? (dose.takenAt ? formatTime(dose.takenAt) : '')}
        </span>
        <div className="min-w-0 flex-1">
          <Link
            to={`/medication/${dose.medicineId}`}
            viewTransition
            className="block text-[1.0625rem] font-semibold leading-snug tracking-[-0.01em]"
          >
            {dose.medicineName}
            {dose.strength ? <span className="font-medium text-ink-600"> {dose.strength}</span> : null}
          </Link>
          <p className="mt-0.5 text-sm text-ink-600">{detail}</p>
          {dose.instructions.length ? (
            <p className="mt-1.5 flex flex-wrap gap-1.5">
              {dose.instructions.map((i) => (
                <span key={i} className="inline-flex h-6 items-center rounded-pill bg-mint-200 px-2.5 text-xs font-semibold text-mint-800">
                  {t.instruction[i]}
                </span>
              ))}
            </p>
          ) : null}
        </div>
        <span
          className={cx(
            'inline-flex h-7 shrink-0 items-center rounded-pill px-2.5 text-xs font-bold',
            STATE_TONE[dose.state],
          )}
        >
          {t.state[dose.state]}
        </span>
      </div>

      {done ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-ink-600">
            {dose.state === 'taken' && dose.takenAt
              ? t.takenAt(formatTime(dose.takenAt))
              : dose.skipReason || t.skippedLabel}
          </p>
          <Button size="sm" variant="ghost" loading={run.isPending} onClick={() => run.mutate('undo')}>
            {t.undo}
          </Button>
        </div>
      ) : (
        <div className="mt-3">
          {snoozed ? <p className="mb-2 text-sm text-ink-600">{t.snoozedUntil(snoozed)}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" loading={run.isPending && run.variables === 'take'} onClick={() => run.mutate('take')}>
              {t.take}
            </Button>
            <Button size="sm" variant="tint" disabled={run.isPending} onClick={() => run.mutate('skip')}>
              {t.skip}
            </Button>
            <Button size="sm" variant="ghost" aria-expanded={later} onClick={() => setLater((v) => !v)}>
              {t.snooze}
            </Button>
          </div>
          {later ? (
            <div className="mt-2 flex gap-2">
              {([10, 30] as const).map((minutes) => (
                <Button key={minutes} size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate(minutes)}>
                  {t.snoozeFor(minutes)}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </article>
  );
}
