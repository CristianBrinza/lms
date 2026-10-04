import { Hono } from 'hono';
import { z } from 'zod';
import type { AppDeps, AppEnv } from '../../context';
import { audit } from '../../lib/audit';
import { sha256Hex } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { enforceRateLimits } from '../../lib/rate-limit';
import { maskIp } from '../../lib/text';
import { readJson } from '../../lib/validation';
import { findUserByEmail, toPublicUser } from '../users';
import { clearSessionCookies, readRefreshToken, setSessionCookies } from './cookies';
import { createSession, revokeSessionByToken, rotateSession } from './sessions';

const LoginBody = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Enter your email').max(254),
  password: z.string().min(1, 'Enter your password').max(200),
  remember: z.boolean().default(true),
});

const INVALID = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'That email and password do not match');

/** Sign-in, session refresh and sign-out. There is no sign-up: only an admin creates accounts. */
export function authRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();

  // Sign-in, refresh and sign-out are for people; an AI access key has no business here.
  app.use('*', async (c, next) => {
    if (c.req.header('authorization'))
      throw new AppError(403, 'KEY_SCOPE', 'Access keys can’t sign in or out');
    await next();
  });

  app.post('/login', async (c) => {
    const body = await readJson(c, LoginBody);
    const ip = c.get('ip');
    await enforceRateLimits(deps, [
      { key: `login:ip:${ip}`, limit: 30, windowSec: 15 * 60 },
      { key: `login:email:${sha256Hex(body.email)}`, limit: 10, windowSec: 15 * 60 },
    ]);

    const user = await findUserByEmail(deps.db, body.email);
    if (!user) {
      // Same time as a real check, so response timing does not reveal who has an account.
      await deps.passwords.burn();
      throw INVALID();
    }
    const check = await deps.passwords.verify(body.password, user.passwordHash);
    if (!check.ok) throw INVALID();
    if (!user.isActive)
      throw new AppError(
        403,
        'ACCOUNT_DISABLED',
        'This account is switched off. Ask the admin to turn it back on.',
      );

    const now = deps.now();
    const newHash = check.needsRehash ? await deps.passwords.hash(body.password) : null;
    await deps.db.query(
      'UPDATE users SET last_login_at = $2, password_hash = COALESCE($3, password_hash) WHERE id = $1',
      [user.id, now, newHash],
    );

    const tokens = await createSession(deps, user, {
      remember: body.remember,
      userAgent: c.req.header('user-agent'),
      ip,
    });
    setSessionCookies(c, deps.config, tokens);
    await audit(deps, {
      actorId: user.id,
      action: 'auth.login',
      targetId: user.id,
      ip: maskIp(ip),
      meta: { remember: body.remember },
    });
    return c.json({ user: toPublicUser(user) });
  });

  app.post('/refresh', async (c) => {
    const token = readRefreshToken(c, deps.config);
    if (!token) throw new AppError(401, 'AUTH_REQUIRED', 'Sign in to continue');
    const result = await rotateSession(deps, token, {
      userAgent: c.req.header('user-agent'),
      ip: c.get('ip'),
    });
    if (result.status === 'race') {
      // Another tab rotated a moment ago; its new cookies are already on their way.
      throw new AppError(409, 'REFRESH_RACE', 'Session was refreshed by another tab');
    }
    if (result.status === 'invalid') {
      clearSessionCookies(c, deps.config);
      throw new AppError(401, 'SESSION_EXPIRED', 'Your session has ended. Sign in again.');
    }
    setSessionCookies(c, deps.config, result.tokens);
    return c.json({ user: toPublicUser(result.user) });
  });

  app.post('/logout', async (c) => {
    const token = readRefreshToken(c, deps.config);
    if (token) await revokeSessionByToken(deps, token);
    clearSessionCookies(c, deps.config);
    return c.body(null, 204);
  });

  return app;
}
