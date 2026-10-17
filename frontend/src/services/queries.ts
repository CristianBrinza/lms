import { QueryClient } from '@tanstack/react-query';
import { isApiError } from './api/client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      // Signed out or forbidden: asking again won't change the answer.
      retry: (count, error) =>
        !(isApiError(error) && [401, 403, 404].includes(error.status)) && count < 2,
    },
    mutations: { retry: false },
  },
});

export const queryKeys = {
  me: ['me'] as const,
  sessions: ['me', 'sessions'] as const,
  users: (q: string) => ['admin', 'users', q] as const,
  user: (id: string) => ['admin', 'user', id] as const,
  activity: ['admin', 'activity'] as const,
  households: ['admin', 'households'] as const,
};
