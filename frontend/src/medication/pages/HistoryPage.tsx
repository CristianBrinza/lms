import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui';
import { medicationApi, medicationKeys } from '../api';
import { IntakeList } from '../components/IntakeList';
import { Disclaimer, EmptyCard, ErrorCard, MedScreen, Section } from '../components/parts';
import { useMedicationT } from '../i18n';

/** The last 30 days of intake, and how much of the plan was followed, overall and per treatment. */
export default function HistoryPage() {
  const t = useMedicationT();
  const history = useQuery({ queryKey: medicationKeys.history('', ''), queryFn: () => medicationApi.history() });
  const treatments = useQuery({ queryKey: medicationKeys.treatments, queryFn: medicationApi.treatments });
  const data = history.data;
  const names = new Map((treatments.data?.treatments ?? []).map((x) => [x.id, x]));
  const counted = (data?.doses ?? []).filter((d) => d.state === 'taken' || d.state === 'skipped' || d.state === 'missed');

  return (
    <MedScreen title={t.historyTitle} subtitle={t.historySubtitle}>
      {history.isPending ? (
        <div aria-hidden="true" className="flex flex-col gap-3">
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
        </div>
      ) : history.error ? (
        <ErrorCard error={history.error} onRetry={() => void history.refetch()} />
      ) : data && counted.length ? (
        <>
          <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]">
            <p className="text-sm font-semibold text-ink-600">{t.adherenceTitle}</p>
            <p className="tabular mt-1 text-[2.5rem] font-bold leading-none tracking-[-0.03em]">
              {t.adherence(data.adherence)}
            </p>
          </div>

          {data.byTreatment.length ? (
            <Section title={t.treatmentsTitle}>
              <ul className="flex flex-col gap-3">
                {data.byTreatment.map((row) => {
                  const treatment = names.get(row.treatmentId);
                  return (
                    <li key={row.treatmentId} className="rounded-3xl bg-white p-4 shadow-[var(--shadow-card)]">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="min-w-0 truncate font-semibold">
                          {treatment ? [treatment.medicineName, treatment.strength].filter(Boolean).join(' ') : ''}
                          {treatment ? <span className="font-medium text-ink-600"> · {treatment.personName}</span> : null}
                        </p>
                        <p className="tabular text-lg font-bold">{t.adherence(row.adherence)}</p>
                      </div>
                      <div
                        role="progressbar"
                        aria-label={t.adherenceTitle}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={row.adherence ?? 0}
                        className="mt-2 h-2 overflow-hidden rounded-pill bg-ink-100"
                      >
                        <div className="h-full rounded-pill bg-mint-800" style={{ width: `${row.adherence ?? 0}%` }} />
                      </div>
                      <p className="tabular mt-2 text-xs text-ink-600">{t.counts(row.taken, row.skipped, row.missed)}</p>
                    </li>
                  );
                })}
              </ul>
            </Section>
          ) : null}

          <Section title={t.intakeTitle}>
            <IntakeList doses={counted} />
          </Section>
        </>
      ) : (
        <EmptyCard title={t.noHistory} detail={t.historySubtitle} />
      )}
      <Disclaimer />
    </MedScreen>
  );
}
