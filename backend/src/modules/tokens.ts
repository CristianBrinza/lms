import { randomUUID } from 'node:crypto';
import type { AppDeps } from '../context';
import type { Queryable } from '../db';
import { randomToken, sha256Hex } from '../lib/crypto';
import { AppError } from '../lib/errors';
import { toUser, USER_COLUMNS, type User } from './users';

/**
 * AI access keys. A key acts as the person who made it, with a narrower role:
 *
 * - `food:read` — the assistant can look (kitchen, recipes, lists, plan, training, watching) but change nothing
 * - `food`      — the family assistant: reads and changes everything in Food, Training, Travel and Watching
 * - `admin`     — Food plus managing people's accounts; only admins can make one
 *
 * The key is shown once; only its SHA-256 is stored. Keys never reach sign-in, passwords,
 * devices or other keys (see tokenMayAccess).
 */

export const TOKEN_SCOPES = ['food:read', 'food', 'admin'] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];

const TOKEN_PREFIX = 'lms_';
const MAX_ACTIVE_TOKENS = 20;

export interface PublicToken {
  id: string;
  name: string;
  prefix: string;
  scope: TokenScope;
  createdAt: string;
  lastUsedAt: string | null;
}

interface TokenRow {
  id: string;
  name: string;
  prefix: string;
  scope: TokenScope;
  created_at: Date;
  last_used_at: Date | null;
}

const toPublicToken = (row: TokenRow): PublicToken => ({
  id: row.id,
  name: row.name,
  prefix: row.prefix,
  scope: row.scope,
  createdAt: row.created_at.toISOString(),
  lastUsedAt: row.last_used_at?.toISOString() ?? null,
});

export function looksLikeToken(value: string): boolean {
  return (
    value.startsWith(TOKEN_PREFIX) && value.length > TOKEN_PREFIX.length + 20 && value.length < 200
  );
}

export async function createToken(
  deps: AppDeps,
  user: User,
  input: { name: string; scope: TokenScope; oauthClientId?: string },
): Promise<{ token: string; key: PublicToken }> {
  if (input.scope === 'admin' && user.role !== 'admin')
    throw new AppError(403, 'FORBIDDEN', 'Only admins can give an assistant admin access');
  const { rows: count } = await deps.db.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM api_tokens WHERE user_id = $1 AND revoked_at IS NULL',
    [user.id],
  );
  if ((count[0]?.count ?? 0) >= MAX_ACTIVE_TOKENS)
    throw new AppError(409, 'TOO_MANY_KEYS', 'Remove an old key first');
  const token = `${TOKEN_PREFIX}${randomToken(32)}`;
  const { rows } = await deps.db.query<TokenRow>(
    `INSERT INTO api_tokens (id, user_id, name, token_hash, prefix, scope, created_at, oauth_client_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, name, prefix, scope, created_at, last_used_at`,
    [
      randomUUID(),
      user.id,
      input.name,
      sha256Hex(token),
      token.slice(0, TOKEN_PREFIX.length + 6),
      input.scope,
      deps.now(),
      input.oauthClientId ?? null,
    ],
  );
  return { token, key: toPublicToken(rows[0]!) };
}

export async function listTokens(db: Queryable, userId: string): Promise<PublicToken[]> {
  const { rows } = await db.query<TokenRow>(
    'SELECT id, name, prefix, scope, created_at, last_used_at FROM api_tokens WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC',
    [userId],
  );
  return rows.map(toPublicToken);
}

export async function revokeToken(deps: AppDeps, userId: string, id: string): Promise<boolean> {
  const { rowCount } = await deps.db.query(
    'UPDATE api_tokens SET revoked_at = $3 WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL',
    [id, userId, deps.now()],
  );
  return Boolean(rowCount);
}

/** The person and scope behind a key, or null. Inactive people's keys stop working at once. */
export async function authenticateToken(
  deps: AppDeps,
  raw: string,
): Promise<{ user: User; scope: TokenScope; tokenId: string } | null> {
  if (!looksLikeToken(raw)) return null;
  const columns = USER_COLUMNS.split(', ')
    .map((column) => `u.${column}`)
    .join(', ');
  const { rows } = await deps.db.query<
    Parameters<typeof toUser>[0] & { token_id: string; token_scope: TokenScope }
  >(
    `SELECT ${columns}, t.id AS token_id, t.scope AS token_scope
       FROM api_tokens t JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = $1 AND t.revoked_at IS NULL AND u.is_active`,
    [sha256Hex(raw)],
  );
  const row = rows[0];
  if (!row) return null;
  const user = toUser(row);
  // An admin key outlives a demotion only as a Food key.
  const scope: TokenScope =
    row.token_scope === 'admin' && user.role !== 'admin' ? 'food' : row.token_scope;
  const now = deps.now();
  await deps.db.query(
    `UPDATE api_tokens SET last_used_at = $2 WHERE id = $1 AND (last_used_at IS NULL OR last_used_at < $2::timestamptz - interval '1 minute')`,
    [row.token_id, now],
  );
  return { user, scope, tokenId: row.token_id };
}

/**
 * Where a key may go. Everything not listed is refused: sign-in, password, devices and keys stay
 * with the person in the app.
 */
export function tokenMayAccess(scope: TokenScope, method: string, path: string): boolean {
  const read = method === 'GET' || method === 'HEAD';
  if (path === '/api/me') return read;
  if (path === '/api/food' || path.startsWith('/api/food/'))
    return scope === 'food:read' ? read : true;
  // Training and travel go with the kitchen key: everyday family data, never accounts.
  if (path === '/api/training' || path.startsWith('/api/training/'))
    return scope === 'food:read' ? read : true;
  if (path === '/api/travel' || path.startsWith('/api/travel/'))
    return scope === 'food:read' ? read : true;
  // Watching: each person's films and series, the same as training.
  if (path === '/api/watching' || path.startsWith('/api/watching/'))
    return scope === 'food:read' ? read : true;
  // The priority buy list: the household's, like the kitchen.
  if (path === '/api/wishlist' || path.startsWith('/api/wishlist/'))
    return scope === 'food:read' ? read : true;
  // Drinks: the household's cellar and tastings, like the kitchen (label photos included).
  if (path === '/api/drinks' || path.startsWith('/api/drinks/'))
    return scope === 'food:read' ? read : true;
  // The closet: everyone's clothes at home, their photos, places, looks and days worn.
  if (path === '/api/closet' || path.startsWith('/api/closet/'))
    return scope === 'food:read' ? read : true;
  // Medication: the household's medicine cabinet, treatments and doses taken, like the kitchen.
  if (path === '/api/medication' || path.startsWith('/api/medication/'))
    return scope === 'food:read' ? read : true;
  if (path.startsWith('/api/admin/')) return scope === 'admin';
  return false;
}
