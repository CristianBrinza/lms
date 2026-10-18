import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { medicationApi, medicationKeys } from './api';
import { useMedicationT } from './i18n';

/** Throws an expired package away: one tap ("Aruncat"). It stops counting as stock at once. */
export function useDiscard() {
  const t = useMedicationT();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => medicationApi.discardPackage(id),
    onSuccess: () => {
      haptic('success');
      toast.success(t.discarded);
    },
    onError: (error) => toast.error(t.failed, { description: errorMessage(error) }),
    onSettled: () => client.invalidateQueries({ queryKey: medicationKeys.all }),
  });
}
