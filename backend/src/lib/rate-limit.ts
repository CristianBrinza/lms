import type { AppDeps } from '../context';
import { AppError } from './errors';

/** Fixed-window rate limiter in PostgreSQL: one atomic upsert per hit. */
export async function hitRateLimit(
  deps: AppDeps,
  key: string,
  limit: number,
  windowSec: number,
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  if (!deps.config.rateLimits) return { allowed: true, retryAfterSec: 0 };
  const now = deps.now();
  const windowEnd = new Date(now.getTime() + windowSec * 1000);
  const { rows } = await deps.db.query<{ count: number; expires_at: Date }>(
    `INSERT INTO rate_limits (key, count, expires_at) VALUES ($1, 1, $2)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.expires_at > $3 THEN rate_limits.count + 1 ELSE 1 END,
       expires_at = CASE WHEN rate_limits.expires_at > $3 THEN rate_limits.expires_at ELSE $2 END
     RETURNING count, expires_at`,
    [key, windowEnd, now],
  );
  const row = rows[0];
  const count = row?.count ?? 1;
  const expiresAt = row?.expires_at ?? windowEnd;
  return {
    allowed: count <= limit,
    retryAfterSec: Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000)),
  };
}

/** Throws 429 with Retry-After when any of the given buckets is exhausted. */
export async function enforceRateLimits(
  deps: AppDeps,
  buckets: Array<{ key: string; limit: number; windowSec: number }>,
): Promise<void> {
  const results = await Promise.all(
    buckets.map((bucket) => hitRateLimit(deps, bucket.key, bucket.limit, bucket.windowSec)),
  );
  const blocked = results.filter((result) => !result.allowed);
  if (blocked.length > 0) {
    const retryAfter = Math.max(...blocked.map((result) => result.retryAfterSec));
    throw new AppError(429, 'RATE_LIMITED', 'Too many attempts. Try again in a few minutes.', {
      headers: { 'Retry-After': String(retryAfter) },
    });
  }
}
