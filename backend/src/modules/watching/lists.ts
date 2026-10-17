import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import { cleanTranslations, type Translations } from '../../lib/i18n';
import { isUuid } from '../users';
import { me, type Watch } from './people';
import { cardOf, getTitle, storedTitles } from './titles';

/**
 * Lists people make: "Movie night", "For Patricia". A person's own, or shared with the household
 * (everyone at home sees and edits it). Titles keep the order people give them.
 */

interface ListRow {
  id: string;
  owner_id: string;
  owner_name: string;
  name: string;
  translations: Translations;
  shared: boolean;
  created_at: Date;
  updated_at: Date;
  count: number;
  posters: string[] | null;
}

const LIST_SELECT = `SELECT c.id, c.owner_id, u.name AS owner_name, c.name, c.translations, c.shared, c.created_at, c.updated_at,
    (SELECT count(*)::int FROM watch_collection_items i WHERE i.collection_id = c.id) AS count,
    (SELECT array_agg(t.data->>'posterPath' ORDER BY i.position) FROM (
        SELECT * FROM watch_collection_items WHERE collection_id = c.id ORDER BY position LIMIT 4) i
      JOIN watch_titles t ON t.id = i.title_id) AS posters
  FROM watch_collections c JOIN users u ON u.id = c.owner_id`;

const toList = (row: ListRow, userId: string) => ({
  id: row.id,
  name: row.name,
  translations: row.translations,
  shared: row.shared,
  owner: { id: row.owner_id, name: row.owner_name },
  mine: row.owner_id === userId,
  count: row.count,
  posters: (row.posters ?? []).filter(Boolean),
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export async function listLists(w: Watch) {
  const { rows } = await w.ctx.db.query<ListRow>(
    `${LIST_SELECT} WHERE c.owner_id = $1 OR (c.shared AND c.household_id = $2) ORDER BY c.updated_at DESC`,
    [me(w), w.ctx.actor.householdId],
  );
  return { lists: rows.map((row) => toList(row, me(w))) };
}

/** A list the caller may see and change: their own, or one shared at home. */
async function findList(w: Watch, id: string) {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'That list isn’t there');
  const { rows } = await w.ctx.db.query<ListRow>(
    `${LIST_SELECT} WHERE c.id = $1 AND (c.owner_id = $2 OR (c.shared AND c.household_id = $3))`,
    [id, me(w), w.ctx.actor.householdId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'That list isn’t there');
  return rows[0];
}

export async function createList(
  w: Watch,
  input: { name: string; shared?: boolean; translations?: Translations },
) {
  const id = randomUUID();
  await w.ctx.db.query(
    `INSERT INTO watch_collections (id, owner_id, household_id, name, translations, shared, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
    [
      id,
      me(w),
      w.ctx.actor.householdId,
      input.name,
      JSON.stringify(cleanTranslations(input.translations)),
      input.shared ?? false,
      w.ctx.now,
    ],
  );
  return { list: toList(await findList(w, id), me(w)) };
}

/** The list by name (any case), made when there is none: what an assistant asks for. */
export async function listByName(w: Watch, name: string, shared?: boolean) {
  const { rows } = await w.ctx.db.query<{ id: string }>(
    `SELECT id FROM watch_collections WHERE lower(name) = lower($1) AND (owner_id = $2 OR (shared AND household_id = $3))
      ORDER BY owner_id = $2 DESC LIMIT 1`,
    [name.trim(), me(w), w.ctx.actor.householdId],
  );
  if (rows[0]) return rows[0].id;
  return (await createList(w, { name: name.trim(), shared })).list.id;
}

export async function updateList(
  w: Watch,
  id: string,
  input: { name?: string; shared?: boolean; translations?: Translations },
) {
  const list = await findList(w, id);
  if (input.shared !== undefined && list.owner_id !== me(w))
    throw new AppError(403, 'FORBIDDEN', 'Only who made the list can change who sees it');
  await w.ctx.db.query(
    `UPDATE watch_collections SET name = coalesce($2, name), shared = coalesce($3, shared),
       translations = coalesce($4, translations), updated_at = $5 WHERE id = $1`,
    [
      id,
      input.name ?? null,
      input.shared ?? null,
      input.translations ? JSON.stringify(cleanTranslations(input.translations)) : null,
      w.ctx.now,
    ],
  );
  return { list: toList(await findList(w, id), me(w)) };
}

export async function removeList(w: Watch, id: string) {
  const list = await findList(w, id);
  if (list.owner_id !== me(w))
    throw new AppError(403, 'FORBIDDEN', 'Only who made the list can delete it');
  await w.ctx.db.query('DELETE FROM watch_collections WHERE id = $1', [id]);
}

export async function getList(w: Watch, id: string) {
  const list = await findList(w, id);
  const { rows } = await w.ctx.db.query<{
    title_id: string;
    position: number;
    note: string;
    added_by: string | null;
    added_at: Date;
    status: string | null;
  }>(
    `SELECT i.title_id, i.position, i.note, i.added_by, i.added_at, l.status
       FROM watch_collection_items i LEFT JOIN watch_list l ON l.title_id = i.title_id AND l.user_id = $2
      WHERE i.collection_id = $1 ORDER BY i.position, i.added_at`,
    [id, me(w)],
  );
  const titles = await storedTitles(
    w.ctx.db,
    rows.map((r) => r.title_id),
  );
  return {
    list: toList(list, me(w)),
    items: rows.flatMap((row) => {
      const title = titles.get(row.title_id);
      return title
        ? [
            {
              title: cardOf(title, w.locale),
              position: row.position,
              note: row.note,
              addedBy: row.added_by,
              addedAt: row.added_at.toISOString(),
              status: row.status,
            },
          ]
        : [];
    }),
  };
}

export async function addToList(w: Watch, id: string, input: { titleId: string; note?: string }) {
  await findList(w, id);
  await getTitle(w.deps, input.titleId, w.locale);
  await w.ctx.db.query(
    `INSERT INTO watch_collection_items (collection_id, title_id, position, note, added_by, added_at)
     VALUES ($1, $2, (SELECT coalesce(max(position) + 1, 0) FROM watch_collection_items WHERE collection_id = $1), $3, $4, $5)
     ON CONFLICT (collection_id, title_id) DO UPDATE SET note = coalesce(NULLIF($3, ''), watch_collection_items.note)`,
    [id, input.titleId, input.note ?? '', me(w), w.ctx.now],
  );
  await w.ctx.db.query('UPDATE watch_collections SET updated_at = $2 WHERE id = $1', [
    id,
    w.ctx.now,
  ]);
  return getList(w, id);
}

export async function removeFromList(w: Watch, id: string, titleId: string) {
  await findList(w, id);
  await w.ctx.db.query(
    'DELETE FROM watch_collection_items WHERE collection_id = $1 AND title_id = $2',
    [id, titleId],
  );
  await w.ctx.db.query('UPDATE watch_collections SET updated_at = $2 WHERE id = $1', [
    id,
    w.ctx.now,
  ]);
}

/** The titles in the order given; any left out keep their place after them. */
export async function reorderList(w: Watch, id: string, titleIds: string[]) {
  await findList(w, id);
  await w.ctx.tx(async (ctx) => {
    const { rows } = await ctx.db.query<{ title_id: string }>(
      'SELECT title_id FROM watch_collection_items WHERE collection_id = $1 ORDER BY position, added_at',
      [id],
    );
    const order = [
      ...titleIds.filter((t) => rows.some((r) => r.title_id === t)),
      ...rows.map((r) => r.title_id).filter((t) => !titleIds.includes(t)),
    ];
    for (const [position, titleId] of [...new Set(order)].entries())
      await ctx.db.query(
        'UPDATE watch_collection_items SET position = $3 WHERE collection_id = $1 AND title_id = $2',
        [id, titleId, position],
      );
  });
  return getList(w, id);
}
