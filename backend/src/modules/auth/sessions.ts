import { randomUUID } from 'node:crypto';
import type { AppDeps } from '../../context';
import type { Queryable } from '../../db';
import { audit } from '../../lib/audit';
import { randomToken, sha256Hex } from '../../lib/crypto';
import { signAccessToken } from '../../lib/jwt';
import { maskIp, truncate } from '../../lib/text';
import { findUserById, type User } from '../users';

/** A rotated refresh token presented again within this window is a benign race (two tabs), not theft. */
const REFRESH_RACE_GRACE_MS = 30_000;

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  remember: boolean;
  sessionId: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  remember: boolean;
  rotated_at: Date | null;
  revoked_at: Date | null;
  expires_at: Date;
}

function sessionExpiry(deps: AppDeps, remember: boolean, from: Date): Date {
  const ms = remember
    ? deps.config.session.rememberDays * 86_400_000
    : deps.config.session.sessionHours * 3_600_000;
  return new Date(from.getTime() + ms);
}

export function issueAccessToken(deps: AppDeps, user: User, sessionId: string): Promise<string> {
  return signAccessToken(
    deps.config,
    { sub: user.id, sid: sessionId, role: user.role, tv: user.tokenVersion },
    deps.now(),
  );
}

export async function createSession(
  deps: AppDeps,
  user: User,
  meta: { remember: boolean; userAgent?: string; ip?: string },
): Promise<IssuedTokens> {
  const now = deps.now();
  const id = randomUUID();
  const refreshToken = randomToken(32);
  await deps.db.query(
    `INSERT INTO sessions (id, user_id, token_hash, remember, user_agent, ip, created_at, last_used_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8)`,
    [
      id,
      user.id,
      sha256Hex(refreshToken),
      meta.remember,
      truncate(meta.userAgent, 300),
      maskIp(meta.ip),
      now,
      sessionExpiry(deps, meta.remember, now),
    ],
  );
  return {
    accessToken: await issueAccessToken(deps, user, id),
    refreshToken,
    remember: meta.remember,
    sessionId: id,
  };
}

export type RotateResult =
  { status: 'ok'; tokens: IssuedTokens; user: User } | { status: 'race' } | { status: 'invalid' };

/**
 * Refresh-token rotation with reuse detection: every refresh swaps the token; presenting an
 * already-rotated token after the grace window revokes the whole session.
 */
export async function rotateSession(
  deps: AppDeps,
  refreshToken: string,
  meta: { userAgent?: string; ip?: string },
): Promise<RotateResult> {
  const now = deps.now();
  const hash = sha256Hex(refreshToken);
  const nextToken = randomToken(32);

  const { rows: current } = await deps.db.query<SessionRow>(
    'SELECT id, user_id, remember, rotated_at, revoked_at, expires_at FROM sessions WHERE token_hash = $1',
    [hash],
  );
  const session = current[0];
  if (session && !session.revoked_at && session.expires_at > now) {
    const { rows: updated } = await deps.db.query<SessionRow>(
      `UPDATE sessions SET token_hash = $3, prev_token_hash = $2, rotated_at = $4, last_used_at = $4, expires_at = $5,
         user_agent = COALESCE(NULLIF($6, ''), user_agent), ip = COALESCE(NULLIF($7, ''), ip)
       WHERE id = $1 AND token_hash = $2 AND revoked_at IS NULL
       RETURNING id, user_id, remember, rotated_at, revoked_at, expires_at`,
      [
        session.id,
        hash,
        sha256Hex(nextToken),
        now,
        sessionExpiry(deps, session.remember, now),
        truncate(meta.userAgent, 300),
        maskIp(meta.ip),
      ],
    );
    const rotated = updated[0];
    if (!rotated) return { status: 'race' };

    const user = await findUserById(deps.db, rotated.user_id);
    if (!user || !user.isActive) {
      await revokeSession(deps.db, rotated.id, now);
      return { status: 'invalid' };
    }
    return {
      status: 'ok',
      user,
      tokens: {
        accessToken: await issueAccessToken(deps, user, rotated.id),
        refreshToken: nextToken,
        remember: rotated.remember,
        sessionId: rotated.id,
      },
    };
  }

  const { rows: previous } = await deps.db.query<SessionRow>(
    'SELECT id, user_id, remember, rotated_at, revoked_at, expires_at FROM sessions WHERE prev_token_hash = $1',
    [hash],
  );
  const old = previous[0];
  if (old && !old.revoked_at) {
    const rotatedAgo = old.rotated_at ? now.getTime() - old.rotated_at.getTime() : Infinity;
    if (rotatedAgo <= REFRESH_RACE_GRACE_MS) return { status: 'race' };
    // An old token came back long after rotation: assume it was stolen and end the session.
    await revokeSession(deps.db, old.id, now);
    await audit(deps, {
      actorId: old.user_id,
      action: 'auth.session_reuse',
      targetId: old.user_id,
      ip: maskIp(meta.ip),
    });
  }
  return { status: 'invalid' };
}

export async function revokeSession(db: Queryable, sessionId: string, now: Date): Promise<void> {
  await db.query('UPDATE sessions SET revoked_at = $2 WHERE id = $1 AND revoked_at IS NULL', [
    sessionId,
    now,
  ]);
}

export async function revokeSessionByToken(deps: AppDeps, refreshToken: string): Promise<void> {
  await deps.db.query(
    'UPDATE sessions SET revoked_at = $2 WHERE token_hash = $1 AND revoked_at IS NULL',
    [sha256Hex(refreshToken), deps.now()],
  );
}

/**
 * Signs a person out everywhere: revokes their sessions (but `keep`) and bumps the token
 * version, so access tokens already handed out stop working at once.
 */
export async function revokeAllSessions(
  db: Queryable,
  userId: string,
  now: Date,
  keep: string | null = null,
): Promise<void> {
  await db.query(
    'UPDATE sessions SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL AND id IS DISTINCT FROM $3',
    [userId, now, keep],
  );
  await db.query(
    'UPDATE users SET token_version = token_version + 1, updated_at = $2 WHERE id = $1',
    [userId, now],
  );
}

export interface DeviceSession {
  id: string;
  userAgent: string;
  ip: string;
  remember: boolean;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

export async function listActiveSessions(
  deps: AppDeps,
  userId: string,
  currentId: string | null,
): Promise<DeviceSession[]> {
  const { rows } = await deps.db.query<{
    id: string;
    user_agent: string;
    ip: string;
    remember: boolean;
    created_at: Date;
    last_used_at: Date;
  }>(
    `SELECT id, user_agent, ip, remember, created_at, last_used_at FROM sessions
     WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > $2 ORDER BY last_used_at DESC LIMIT 50`,
    [userId, deps.now()],
  );
  return rows.map((row) => ({
    id: row.id,
    userAgent: row.user_agent,
    ip: row.ip,
    remember: row.remember,
    createdAt: row.created_at.toISOString(),
    lastUsedAt: row.last_used_at.toISOString(),
    current: row.id === currentId,
  }));
}
