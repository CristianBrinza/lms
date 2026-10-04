import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, hasSessionHint, onSessionExpired } from '@/services/api/client';
import { authApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/queries';
import type { User } from '@/types/api';

/**
 * Session state. Tokens live in httpOnly cookies, so the app only knows "who am I": fetched
 * once (skipped entirely when the session hint cookie is absent) and cached.
 */

async function fetchMe(): Promise<User | null> {
  if (!hasSessionHint()) return null;
  try {
    return await authApi.me();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

interface AuthContextValue {
  user: User | null;
  status: 'loading' | 'authenticated' | 'anonymous' | 'error';
  isAdmin: boolean;
  /** The person just signed out on purpose (not an expired session). */
  signedOut: boolean;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  // A minute: a change made by the admin (name, role) shows on the next return to the app.
  const me = useQuery({ queryKey: queryKeys.me, queryFn: fetchMe, staleTime: 60_000, retry: 1 });
  const [signedOut, setSignedOut] = useState(false);

  const setUser = useCallback(
    (user: User | null) => {
      if (user) setSignedOut(false);
      queryClient.setQueryData(queryKeys.me, user);
    },
    [queryClient],
  );

  useEffect(
    () => onSessionExpired(() => queryClient.setQueryData(queryKeys.me, null)),
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setSignedOut(true);
      queryClient.setQueryData(queryKeys.me, null);
      // Every other cached private answer goes with the session.
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== queryKeys.me[0] || query.queryKey.length > 1,
      });
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => {
    const user = me.data ?? null;
    const status: AuthContextValue['status'] = me.isPending
      ? 'loading'
      : me.isError
        ? 'error'
        : user
          ? 'authenticated'
          : 'anonymous';
    return {
      user,
      status,
      isAdmin: user?.role === 'admin',
      signedOut,
      setUser,
      logout,
      retry: () => void me.refetch(),
    };
  }, [me, signedOut, setUser, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** The person every authenticated screen is about (guards guarantee it exists). */
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('useUser needs a signed-in person (wrap the route in <RequireAuth>)');
  return user;
}

/** Where a signed-in person lands: choosing their own password first, if the admin asked. */
export function homePathFor(user: Pick<User, 'mustChangePassword'> | null): string {
  if (!user) return '/login';
  return user.mustChangePassword ? '/welcome' : '/home';
}
