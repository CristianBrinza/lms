import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Button, toast } from '@/components/ui';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { formatDate } from '@/lib/format';
import { wishlistKeys } from '@/wishlist/api';
import { medicationApi, type Treatment } from '../api';
import { useMedicationT } from '../i18n';
import { weekdayShort } from '../logic';
import { Thumb } from './parts';

/** A treatment: whose, what, when; how long it runs; how long the stock lasts, with the buy list one tap away. */
export function TreatmentCard({
  treatment,
  onEdit,
  onStop,
  onDelete,
}: {
  treatment: Treatment;
  onEdit: () => void;
  onStop: () => void;
  onDelete: () => void;
}) {
  const t = useMedicationT();
  const client = useQueryClient();
  const buy = useMutation({
    mutationFn: () => medicationApi.addToBuyList(treatment.id),
    onSuccess: (result) => {
      haptic('success');
      toast.success(result.already ? t.alreadyListed : t.boughtListed);
    },
    onError: (error) => toast.error(t.failed, { description: errorMessage(error) }),
    onSettled: () => client.invalidateQueries({ queryKey: wishlistKeys.all }),
  });
  const finished = treatment.status === 'finished';
  return (
    <article className={cx('rounded-3xl bg-white p-4 shadow-[var(--shadow-card)]', finished && 'opacity-85')}>
      <div className="flex items-start gap-3">
        <Thumb cover={treatment.cover} className="size-12" />
        <div className="min-w-0 flex-1">
          <Link
            to={`/medication/${treatment.medicineId}`}
            viewTransition
            className="block text-[1.0625rem] font-semibold leading-snug tracking-[-0.01em]"
          >
            {treatment.medicineName}
            {treatment.strength ? <span className="font-medium text-ink-600"> {treatment.strength}</span> : null}
          </Link>
          <p className="mt-0.5 text-sm text-ink-600">
            {treatment.personName} · {t.qty(treatment.dose, treatment.unit, treatment.form)}
          </p>
          <p className="tabular mt-0.5 text-sm font-medium">{t.scheduleText(treatment, weekdayShort)}</p>
        </div>
        <span
          className={cx(
            'inline-flex h-7 shrink-0 items-center rounded-pill px-2.5 text-xs font-bold',
            finished ? 'bg-ink-100 text-ink-700' : 'bg-mint-200 text-mint-800',
          )}
        >
          {t.statusLabel[treatment.status]}
        </span>
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-600">
        {treatment.courseEnd ? <span>{t.courseEnds(formatDate(treatment.courseEnd))}</span> : null}
        {treatment.instructions.map((i) => (
          <span key={i} className="inline-flex h-6 items-center rounded-pill bg-mint-200 px-2.5 text-xs font-semibold text-mint-800">
            {t.instruction[i]}
          </span>
        ))}
      </p>

      {!finished ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="tabular text-sm font-semibold">
            {t.stockLeft(t.qty(treatment.available, treatment.unit, treatment.form))}
          </span>
          {treatment.low ? (
            <>
              <span className="inline-flex h-7 items-center rounded-pill bg-butter-300 px-2.5 text-xs font-bold">
                {t.lowChip(treatment.daysLeft)}
              </span>
              <Button size="sm" variant="tint" loading={buy.isPending} onClick={() => buy.mutate()}>
                {t.buy}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
        {!finished ? (
          <Button size="sm" variant="outline" onClick={onEdit}>
            {t.edit}
          </Button>
        ) : null}
        {!finished ? (
          <Button size="sm" variant="ghost" onClick={onStop}>
            {t.stop}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={onDelete}>
            {t.delete}
          </Button>
        )}
      </div>
    </article>
  );
}
