import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { AppDeps, AppEnv } from '../../context';
import { requireAuth, sessionOf } from '../../middleware/auth';
import type { LiveEvent, LiveListener } from './hub';

/** Cloudflare closes a connection that says nothing for 100 s; a comment every 25 s keeps it. */
export const HEARTBEAT_MS = 25_000;

/**
 * GET /api/events: a Server-Sent Events stream of changes in the person's household (and their
 * own), for the signed-in app only (an access key has no screen to refresh).
 *
 *   event: change
 *   data: {"area":"food","path":"/api/food/stock","by":"<user id>","at":"2026-10-17T09:00:00.000Z"}
 *
 * The session is checked when the stream opens and again at every heartbeat (and at once when
 * the person's sessions or account change), so a revoked session stops hearing within seconds.
 */
export function liveRoutes(deps: AppDeps, options: { heartbeatMs?: number } = {}) {
  const app = new Hono<AppEnv>();
  const heartbeatMs = options.heartbeatMs ?? HEARTBEAT_MS;

  app.get('/', requireAuth(deps), (c) => {
    const sessionId = sessionOf(c);
    const user = c.get('user');
    const tokenVersion = user.tokenVersion;

    const response = streamSSE(c, async (stream) => {
      let wake: () => void = () => undefined;
      let ended = false;
      const listener: LiveListener = {
        userId: user.id,
        householdId: user.householdId,
        send: (event: LiveEvent) =>
          void stream.writeSSE({ event: 'change', data: JSON.stringify(event) }),
        wake: () => wake(),
        close: () => {
          ended = true;
          wake();
        },
      };
      const unsubscribe = deps.live.subscribe(listener);
      stream.onAbort(() => listener.close());
      try {
        // Sent at once, so the browser (and any proxy) sees the stream is open.
        await stream.write(': open\n\n');
        while (!ended && !stream.aborted) {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, heartbeatMs);
            wake = () => {
              clearTimeout(timer);
              resolve();
            };
          });
          if (ended || stream.aborted) break;
          const still = await sessionStillValid(deps, user.id, sessionId, tokenVersion);
          if (!still) break;
          listener.householdId = still.householdId;
          await stream.write(': beat\n\n');
        }
      } finally {
        unsubscribe();
      }
    });
    // No proxy may buffer, compress or cache the stream (Cloudflare, nginx-style X-Accel).
    response.headers.set('Cache-Control', 'no-cache, no-transform');
    response.headers.set('X-Accel-Buffering', 'no');
    return response;
  });

  return app;
}

async function sessionStillValid(
  deps: AppDeps,
  userId: string,
  sessionId: string,
  tokenVersion: number,
): Promise<{ householdId: string | null } | null> {
  const { rows } = await deps.db.query<{
    is_active: boolean;
    token_version: number;
    household_id: string | null;
    revoked_at: Date | null;
    expires_at: Date | null;
  }>(
    `SELECT u.is_active, u.token_version, u.household_id, s.revoked_at, s.expires_at
       FROM users u LEFT JOIN sessions s ON s.id = $2 AND s.user_id = u.id
      WHERE u.id = $1`,
    [userId, sessionId],
  );
  const row = rows[0];
  if (!row || !row.is_active || row.token_version !== tokenVersion) return null;
  if (!row.expires_at || row.revoked_at || row.expires_at <= deps.now()) return null;
  return { householdId: row.household_id };
}
