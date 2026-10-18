import { useQuery } from '@tanstack/react-query';
import { medicationApi, medicationKeys } from '@/medication/api';
import { useMedicationT } from '@/medication/i18n';

/**
 * What a tile says about its area right now, when the area has something live to say: Medication
 * shows the next dose and how many packages need a look (a badge). Others return nothing.
 */
export function useAreaLive(areaId: string): { summary?: string; badge?: number } {
  const t = useMedicationT();
  const summary = useQuery({
    queryKey: medicationKeys.summary,
    queryFn: medicationApi.summary,
    enabled: areaId === 'medication',
    staleTime: 60_000,
  });
  if (areaId !== 'medication' || !summary.data) return {};
  const { next, badge, today } = summary.data;
  const when = next
    ? `${next.dueOn === today ? t.today : t.tomorrow} ${next.dueTime ?? ''}`.trim()
    : '';
  const line = next ? t.card.next(next.medicineName, when) : t.card.none;
  return {
    summary: badge > 0 ? `${line} · ${t.card.expiring(badge)}` : line,
    badge: badge > 0 ? badge : undefined,
  };
}
