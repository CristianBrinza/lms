import { createMiddleware } from 'hono/factory';
import type { Role } from '../config';
import type { AppDeps, AppEnv } from '../context';
import { AppError } from '../lib/errors';
import { verifyAccessToken } from '../lib/jwt';
import { readAccessToken } from '../modules/auth/cookies';
import { findUserById } from '../modules/users';

/**
 * Verifies the access JWT and loads the person on every request, so deactivation, role changes
 * and "sign out everywhere" (token version bump) take effect immediately.
 */
export function requireAuth(deps: AppDeps) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const token = readAccessToken(c, deps.config);
    if (!token) throw new AppError(401, 'AUTH_REQUIRED', 'Sign in to continue');

    const claims = await verifyAccessToken(deps.config, token, deps.now());
    if (!claims) throw new AppError(401, 'TOKEN_EXPIRED', 'Access token expired or invalid');

    const user = await findUserById(deps.db, claims.sub);
    if (!user || !user.isActive || user.tokenVersion !== claims.tv) {
      throw new AppError(401, 'SESSION_REVOKED', 'This session has ended');
    }
    c.set('user', user);
    c.set('sessionId', claims.sid);
    await next();
  });
}

/** The role is read from the database row loaded above, never trusted from the token. */
export function requireRole(...roles: Role[]) {
  const allowed = new Set(roles);
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user');
    if (!user || !allowed.has(user.role)) throw new AppError(403, 'FORBIDDEN', 'You do not have access to this');
    await next();
  });
}
