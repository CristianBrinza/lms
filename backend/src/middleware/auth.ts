import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { Role } from '../config';
import type { AppDeps, AppEnv } from '../context';
import { AppError } from '../lib/errors';
import { verifyAccessToken } from '../lib/jwt';
import { readAccessToken } from '../modules/auth/cookies';
import { authenticateToken, tokenMayAccess } from '../modules/tokens';
import { findUserById } from '../modules/users';

/** "Bearer lms_…" from the Authorization header, if any. */
export function bearerToken(header: string | undefined): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(header ?? '');
  return match ? match[1]! : null;
}

/**
 * Verifies the access JWT and loads the person on every request, so deactivation, role changes
 * and "sign out everywhere" (token version bump) take effect immediately. A request with an AI
 * access key (Authorization: Bearer lms_…) acts as the key's owner, only where its scope allows.
 */
export function requireAuth(deps: AppDeps) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const bearer = bearerToken(c.req.header('authorization'));
    if (bearer) {
      const found = await authenticateToken(deps, bearer);
      if (!found) throw new AppError(401, 'KEY_INVALID', 'This access key is not valid');
      if (!tokenMayAccess(found.scope, c.req.method, new URL(c.req.url).pathname)) {
        throw new AppError(403, 'KEY_SCOPE', 'This access key can’t do that');
      }
      c.set('user', found.user);
      c.set('sessionId', null);
      c.set('via', 'ai');
      c.set('tokenScope', found.scope);
      await next();
      return;
    }

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
    c.set('via', 'app');
    c.set('tokenScope', null);
    await next();
  });
}

/** The signed-in session's id. Password, devices and keys need a person in the app, not a key. */
export function sessionOf(c: Context<AppEnv>): string {
  const id = c.get('sessionId');
  if (!id) throw new AppError(403, 'SESSION_REQUIRED', 'Do this in the app, signed in');
  return id;
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
