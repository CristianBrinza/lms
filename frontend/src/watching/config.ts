import { useQuery } from '@tanstack/react-query';
import { isApiError } from '@/services/api/client';
import { watchingApi, watchingKeys } from './api';

/** Whether TMDB is set up; while unknown (or on an older server) the screen just carries on. */
export function useConfigured(): boolean | null {
  const config = useQuery({
    queryKey: watchingKeys.config,
    queryFn: watchingApi.config,
    staleTime: 60 * 60_000,
    retry: 1,
  });
  if (config.data) return config.data.configured;
  if (isApiError(config.error, 'TMDB_NOT_CONFIGURED')) return false;
  return null;
}
