import { isApiError } from '@/services/api/client';
import { libT } from './i18n';

/** What to tell the person when a request fails: the API's own sentence, or a plain fallback. */
export function errorMessage(error: unknown, fallback = libT().errors.generic): string {
  if (isApiError(error)) {
    if (error.code === 'NETWORK') return libT().errors.offline;
    if (error.code === 'UPSTREAM_UNAVAILABLE' || error.code === 'API_NOT_CONFIGURED')
      return libT().errors.unreachable;
    if (error.code === 'INTERNAL') return fallback;
    return error.message || fallback;
  }
  return fallback;
}

/** Per-field messages from a 400 VALIDATION / 409 answer. */
export function fieldErrors(error: unknown): Record<string, string> {
  return isApiError(error) ? error.fields : {};
}
