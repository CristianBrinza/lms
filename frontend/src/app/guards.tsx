import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import { safeNextPath } from '@/lib/nextPath';
import { needsLanding, signedOutStart } from '@/lib/platform';
import type { Role } from '@/types/api';
import { homePathFor, useAuth } from './auth';

/** Signed-in only; a temporary password is replaced before anything else. */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { user, signedOut } = useAuth();
  const { pathname, search } = useLocation();
  if (!user) {
    const next = signedOut ? null : safeNextPath(`${pathname}${search}`);
    if (next && next !== '/home') return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
    return <Navigate to={signedOutStart()} replace />;
  }
  if (user.mustChangePassword && pathname !== '/welcome') return <Navigate to="/welcome" replace />;
  return children ? <>{children}</> : <Outlet />;
}

export function RequireRole({ roles, children }: { roles: Role[]; children?: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <RequireAuth />;
  if (!roles.includes(user.role)) return <Navigate to={homePathFor(user)} replace />;
  return children ? <>{children}</> : <Outlet />;
}

/**
 * Sign-in: a signed-in person goes straight on (this also runs the moment a sign-in succeeds).
 * A browser that arrives here first is offered "web or app" once, unless a link leads back to a
 * page (the choice would lose it).
 */
export function GuestOnly() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get('next'));
  if (user) return <Navigate to={user.mustChangePassword ? '/welcome' : (next ?? '/home')} replace />;
  if (needsLanding() && !next) return <Navigate to="/" replace />;
  return <Outlet />;
}
