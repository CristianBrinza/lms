import { useQuery } from '@tanstack/react-query';
import { Button, Skeleton } from '@/components/ui';
import { PrintIcon } from '@/components/ui/icons';
import { formatDate, formatTime } from '@/lib/format';
import { medicationApi, medicationKeys } from '../api';
import { ErrorCard, MedScreen } from '../components/parts';
import { useMedicationT } from '../i18n';
import { weekdayShort } from '../logic';

/**
 * A page for the doctor: the current medicines with their schedules, and the last 30 days of
 * intake. Printed (or saved as a PDF) from the browser; everything around the paper is hidden then.
 */
export default function ExportPage() {
  const t = useMedicationT();
  const query = useQuery({ queryKey: medicationKeys.export, queryFn: medicationApi.doctorExport });
  const data = query.data;
  return (
    <MedScreen
      title={t.exportTitle}
      subtitle={t.exportSubtitle}
      actions={
        <Button size="sm" icon={PrintIcon} className="print:hidden" onClick={() => window.print()}>
          {t.print}
        </Button>
      }
    >
      {query.isPending ? (
        <Skeleton aria-hidden="true" className="h-72 rounded-3xl" />
      ) : query.error ? (
        <ErrorCard error={query.error} onRetry={() => void query.refetch()} />
      ) : data ? (
        <article className="rounded-3xl bg-white p-5 text-ink-900 shadow-[var(--shadow-card)] print:rounded-none print:p-0 print:shadow-none">
          <p className="text-sm text-ink-600">{t.generated(formatDate(data.generatedAt))}</p>

          <h2 className="mt-4 text-[1.0625rem] font-bold">{t.currentMedicines}</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-ink-100">
                {data.treatments.map((x) => (
                  <tr key={x.id} className="align-top">
                    <th scope="row" className="py-2 pr-3 font-semibold">
                      {x.medicineName}
                      {x.strength ? <span className="font-medium text-ink-600"> {x.strength}</span> : null}
                      <span className="block text-xs font-medium text-ink-600">{x.personName}</span>
                    </th>
                    <td className="tabular py-2 pr-3">{t.qty(x.dose, x.unit, x.form)}</td>
                    <td className="tabular py-2 pr-3">{t.scheduleText(x, weekdayShort)}</td>
                    <td className="py-2 text-ink-600">
                      {x.instructions.map((i) => t.instruction[i]).join(', ')}
                      {x.courseEnd ? ` ${t.courseEnds(formatDate(x.courseEnd))}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mt-6 text-[1.0625rem] font-bold">{t.lastDays}</h2>
          <p className="tabular mt-1 text-sm">
            {t.adherenceTitle}: <strong>{t.adherence(data.adherence)}</strong>
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-ink-100">
                {data.history.map((d) => (
                  <tr key={d.id}>
                    <td className="tabular py-1.5 pr-3">{formatDate(d.dueOn)}</td>
                    <td className="tabular py-1.5 pr-3">{d.dueTime ?? (d.takenAt ? formatTime(d.takenAt) : '')}</td>
                    <td className="py-1.5 pr-3">
                      {d.medicineName} {d.strength}
                    </td>
                    <td className="py-1.5 pr-3 text-ink-600">{d.personName}</td>
                    <td className="py-1.5 font-semibold">{t.state[d.state]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-xs text-ink-600">{t.disclaimer}</p>
        </article>
      ) : null}
    </MedScreen>
  );
}
