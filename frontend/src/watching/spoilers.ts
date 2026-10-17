import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { watchingApi, watchingKeys } from './api';
import { watchingT } from './i18n';

/**
 * The spoiler guard: unwatched episodes' stills blur and their names and plots hide. Kept on the
 * account (it follows the person to every device), switched at once on this one.
 */
export function useSpoilerGuard(): [boolean, (value: boolean) => void] {
  const client = useQueryClient();
  const settings = useQuery({
    queryKey: watchingKeys.settings,
    queryFn: watchingApi.settings,
    staleTime: 10 * 60_000,
  });
  const save = useMutation({
    mutationFn: (hideSpoilers: boolean) => watchingApi.saveSettings({ hideSpoilers }),
    onMutate: (hideSpoilers) => client.setQueryData(watchingKeys.settings, { hideSpoilers }),
    onError: (error) => {
      toast.error(watchingT().common.failed, { description: errorMessage(error) });
      void client.invalidateQueries({ queryKey: watchingKeys.settings });
    },
  });
  return [settings.data?.hideSpoilers ?? false, (value) => save.mutate(value)];
}
