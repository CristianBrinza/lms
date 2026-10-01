import { isApiError } from '@/services/api/client';

/** What to tell the person when a request fails: the API's own sentence, or a plain fallback. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (isApiError(error)) {
    if (error.code === 'NETWORK') return 'You seem to be offline. Check the connection and try again.';
    if (error.code === 'UPSTREAM_UNAVAILABLE' || error.code === 'API_NOT_CONFIGURED') return 'LMS can’t be reached right now. Try again in a minute.';
    if (error.code === 'INTERNAL') return fallback;
    return error.message || fallback;
  }
  return fallback;
}

/** Per-field messages from a 400 VALIDATION / 409 answer. */
export function fieldErrors(error: unknown): Record<string, string> {
  return isApiError(error) ? error.fields : {};
}
