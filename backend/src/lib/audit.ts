import type { AppDeps } from '../context';
import type { Queryable } from '../db';

export type AuditAction =
  | 'auth.login'
  | 'auth.session_reuse'
  | 'user.created'
  | 'user.updated'
  | 'user.role_changed'
  | 'user.deactivated'
  | 'user.reactivated'
  | 'user.password_reset'
  | 'user.password_changed'
  | 'user.signed_out'
  | 'user.deleted';

/** Appends to the activity log the admin console shows. Never throws: logging must not break a request. */
export async function audit(
  deps: AppDeps,
  entry: { actorId: string | null; action: AuditAction; targetId?: string | null; meta?: Record<string, unknown>; ip?: string },
  client: Queryable = deps.db,
): Promise<void> {
  try {
    await client.query('INSERT INTO audit_log (actor_id, action, target_id, meta, ip) VALUES ($1, $2, $3, $4, $5)', [
      entry.actorId,
      entry.action,
      entry.targetId ?? null,
      JSON.stringify(entry.meta ?? {}),
      entry.ip ?? '',
    ]);
  } catch (error) {
    console.error('[audit] could not write entry', entry.action, (error as Error).message);
  }
}
