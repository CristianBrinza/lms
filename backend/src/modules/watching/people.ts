import { AppError } from '../../lib/errors';
import type { AppDeps } from '../../context';
import type { Locale } from '../../lib/i18n';
import type { FoodCtx } from '../food/kitchen';
import { personId } from '../training/workouts';
import type { PeopleQuery } from './schemas';

/**
 * Who is acting (the caller, in their household and language) and whose data a view shows: each
 * person's own by default, another family member's (like Training's person switcher), or several
 * together ("ours").
 */
export interface Watch {
  deps: AppDeps;
  ctx: FoodCtx;
  locale: Locale;
}

export const me = (w: Watch) => w.ctx.actor.userId;
export const sourceOf = (w: Watch): 'app' | 'ai' => (w.ctx.actor.via === 'ai' ? 'ai' : 'app');

export async function householdIds(w: Watch): Promise<string[]> {
  const { rows } = await w.ctx.db.query<{ id: string }>(
    'SELECT id FROM users WHERE household_id = $1 AND is_active ORDER BY created_at',
    [w.ctx.actor.householdId],
  );
  return rows.map((row) => row.id);
}

/** The people a view is about; the caller first when included. */
export async function peopleOf(w: Watch, query: Partial<PeopleQuery> = {}): Promise<string[]> {
  let ids: string[];
  if (query.scope === 'household') ids = await householdIds(w);
  else if (query.people?.length) ids = await checked(w, query.people);
  else ids = [await personId(w.ctx, query.userId)];
  const self = me(w);
  return ids.includes(self) ? [self, ...ids.filter((id) => id !== self)] : ids;
}

/** Household members a change is for (default the caller); anyone else is refused. */
export async function checked(w: Watch, ids: string[] | undefined): Promise<string[]> {
  if (!ids?.length) return [me(w)];
  const unique = [...new Set(ids)];
  for (const id of unique) {
    if (id === me(w)) continue;
    await personId(w.ctx, id);
  }
  if (!unique.length) throw new AppError(400, 'VALIDATION', 'Some fields need attention');
  return unique;
}

export async function names(w: Watch, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const { rows } = await w.ctx.db.query<{ id: string; name: string }>(
    'SELECT id, name FROM users WHERE id = ANY($1)',
    [[...new Set(ids)]],
  );
  return new Map(rows.map((row) => [row.id, row.name]));
}
