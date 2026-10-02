import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import { isUuid } from '../users';
import type { FoodCtx } from './kitchen';
import { normalizeName, sameName } from './presets';
import type { ToolInput, ToolNeedInput, WashInput } from './schemas';

/**
 * Kitchenware: the pots, pans, bowls and glasses a kitchen has (and other things worth counting,
 * like pens). Each kind has a count; some of it can be dirty or in the dishwasher. Recipes say
 * what they need, cooking makes it dirty, washing by hand makes it clean at once, and the
 * dishwasher makes it clean when its run is over.
 */

export const TOOL_KINDS = ['cookware', 'bakeware', 'utensil', 'dishes', 'bar', 'appliance', 'other'] as const;
export type ToolKind = (typeof TOOL_KINDS)[number];

export const TOOL_ICONS = [
  'pot', 'big-pot', 'saucepan', 'pan', 'wok', 'tray', 'baking-dish', 'bowl', 'board', 'knife', 'colander', 'whisk', 'grater',
  'ladle', 'spatula', 'blender', 'mixer', 'kettle', 'toaster', 'oven', 'shaker', 'jigger', 'glass', 'wine-glass', 'mug', 'plate',
  'cutlery', 'lunchbox', 'ice-tray', 'pen', 'scissors', 'box',
] as const;
export type ToolIcon = (typeof TOOL_ICONS)[number];

interface ToolPreset {
  name: string;
  icon: ToolIcon;
  kind: ToolKind;
  washable?: boolean;
  aliases?: string[];
}

const T = (name: string, icon: ToolIcon, kind: ToolKind, aliases?: string[], washable = true): ToolPreset => ({ name, icon, kind, washable, ...(aliases ? { aliases } : {}) });

export const TOOL_PRESETS: readonly ToolPreset[] = [
  T('Big pot', 'big-pot', 'cookware', ['pasta pot', 'stock pot', 'oală mare', 'кастрюля большая', 'pot for spaghetti']),
  T('Pot', 'pot', 'cookware', ['oală', 'oala', 'кастрюля']),
  T('Saucepan', 'saucepan', 'cookware', ['crăticioară', 'ковш', 'small pot']),
  T('Frying pan', 'pan', 'cookware', ['tigaie', 'сковорода', 'skillet', 'pan']),
  T('Wok', 'wok', 'cookware', ['вок']),
  T('Baking tray', 'tray', 'bakeware', ['tavă', 'tava', 'противень', 'sheet pan']),
  T('Baking dish', 'baking-dish', 'bakeware', ['formă de copt', 'форма для запекания', 'casserole dish']),
  T('Mixing bowl', 'bowl', 'utensil', ['bol', 'миска']),
  T('Cutting board', 'board', 'utensil', ['tocător', 'tocator', 'разделочная доска']),
  T('Chef’s knife', 'knife', 'utensil', ['knife', 'cuțit', 'cutit', 'нож']),
  T('Colander', 'colander', 'utensil', ['strecurătoare', 'дуршлаг', 'strainer', 'sieve']),
  T('Whisk', 'whisk', 'utensil', ['tel', 'венчик']),
  T('Grater', 'grater', 'utensil', ['răzătoare', 'терка', 'тёрка']),
  T('Ladle', 'ladle', 'utensil', ['polonic', 'половник']),
  T('Spatula', 'spatula', 'utensil', ['paletă', 'лопатка']),
  T('Blender', 'blender', 'appliance', ['блендер']),
  T('Mixer', 'mixer', 'appliance', ['миксер']),
  T('Kettle', 'kettle', 'appliance', ['fierbător', 'ceainic', 'чайник'], false),
  T('Toaster', 'toaster', 'appliance', ['тостер'], false),
  T('Oven', 'oven', 'appliance', ['cuptor', 'духовка'], false),
  T('Cocktail shaker', 'shaker', 'bar', ['shaker', 'шейкер']),
  T('Jigger', 'jigger', 'bar', ['мерный стакан']),
  T('Glasses', 'glass', 'dishes', ['pahare', 'стаканы', 'glass']),
  T('Wine glasses', 'wine-glass', 'dishes', ['pahare de vin', 'бокалы']),
  T('Mugs', 'mug', 'dishes', ['căni', 'кружки', 'cups']),
  T('Plates', 'plate', 'dishes', ['farfurii', 'тарелки']),
  T('Cutlery', 'cutlery', 'dishes', ['tacâmuri', 'столовые приборы', 'forks', 'spoons']),
  T('Lunch box', 'lunchbox', 'dishes', ['caserolă', 'ланчбокс', 'food container']),
  T('Ice cube tray', 'ice-tray', 'bar', ['formă de gheață', 'форма для льда']),
  T('Pens', 'pen', 'other', ['pixuri', 'ручки', 'pen'], false),
  T('Scissors', 'scissors', 'other', ['foarfece', 'ножницы'], false),
];

export function findToolPreset(name: string): ToolPreset | null {
  return TOOL_PRESETS.find((preset) => sameName(preset.name, name) || preset.aliases?.some((alias) => sameName(alias, name))) ?? null;
}

export interface Tool {
  id: string;
  name: string;
  icon: ToolIcon;
  kind: ToolKind;
  count: number;
  /** Ready to use now. */
  clean: number;
  dirty: number;
  /** In the dishwasher, clean at `washingUntil`. */
  washing: number;
  washingUntil: string | null;
  washable: boolean;
  /** Where it is kept ("top drawer"). */
  place: string;
  note: string;
}

interface ToolRow {
  id: string;
  name: string;
  icon: ToolIcon;
  kind: ToolKind;
  count: number;
  dirty: number;
  washing: number;
  washing_until: Date | null;
  washable: boolean;
  place: string;
  note: string;
}

const TOOL_COLUMNS = 'id, name, icon, kind, count, dirty, washing, washing_until, washable, place, note';

const toTool = (row: ToolRow): Tool => ({
  id: row.id,
  name: row.name,
  icon: row.icon,
  kind: row.kind,
  count: row.count,
  clean: Math.max(0, row.count - row.dirty - row.washing),
  dirty: row.dirty,
  washing: row.washing,
  washingUntil: row.washing_until?.toISOString() ?? null,
  washable: row.washable,
  place: row.place,
  note: row.note,
});

/** A dishwasher run that is over leaves its load clean. */
async function settle(ctx: FoodCtx): Promise<void> {
  await ctx.db.query('UPDATE tools SET washing = 0, washing_until = NULL WHERE household_id = $1 AND washing_until IS NOT NULL AND washing_until <= $2', [
    ctx.actor.householdId,
    ctx.now,
  ]);
}

export async function listTools(ctx: FoodCtx): Promise<Tool[]> {
  await settle(ctx);
  const { rows } = await ctx.db.query<ToolRow>(`SELECT ${TOOL_COLUMNS} FROM tools WHERE household_id = $1 AND archived_at IS NULL ORDER BY kind, lower(name)`, [
    ctx.actor.householdId,
  ]);
  return rows.map(toTool);
}

async function findTool(ctx: FoodCtx, id: string, lock = false): Promise<ToolRow> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'That is not in your kitchenware');
  const { rows } = await ctx.db.query<ToolRow>(`SELECT ${TOOL_COLUMNS} FROM tools WHERE id = $1 AND household_id = $2${lock ? ' FOR UPDATE' : ''}`, [
    id,
    ctx.actor.householdId,
  ]);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'That is not in your kitchenware');
  return rows[0];
}

async function findToolByName(ctx: FoodCtx, name: string): Promise<ToolRow | null> {
  const { rows } = await ctx.db.query<ToolRow & { archived_at: Date | null }>(`SELECT ${TOOL_COLUMNS}, archived_at FROM tools WHERE household_id = $1`, [ctx.actor.householdId]);
  const preset = findToolPreset(name);
  return (
    rows.find((row) => normalizeName(row.name) === normalizeName(name)) ??
    rows.find((row) => sameName(row.name, name)) ??
    (preset ? (rows.find((row) => sameName(row.name, preset.name)) ?? null) : null)
  );
}

export async function saveTool(ctx: FoodCtx, input: ToolInput & { id?: string }): Promise<Tool> {
  await settle(ctx);
  if (input.id) {
    const tool = await findTool(ctx, input.id, true);
    const count = input.count ?? tool.count;
    // Fewer than before: the missing ones were clean ones first, then dirty ones.
    const dirty = Math.min(tool.dirty, Math.max(0, count - tool.washing));
    await ctx.db.query(
      `UPDATE tools SET name = coalesce($2, name), icon = coalesce($3, icon), kind = coalesce($4, kind), count = $5, dirty = $6,
              washable = coalesce($7, washable), place = coalesce($8, place), note = coalesce($9, note), archived_at = NULL, updated_at = $10
        WHERE id = $1`,
      [tool.id, input.name ?? null, input.icon ?? null, input.kind ?? null, count, dirty, input.washable ?? null, input.place ?? null, input.note ?? null, ctx.now],
    );
    return toTool(await findTool(ctx, tool.id));
  }
  if (!input.name) throw new AppError(400, 'VALIDATION', 'Name it', { fields: { name: 'Required' } });
  const existing = await findToolByName(ctx, input.name);
  if (existing) return saveTool(ctx, { ...input, id: existing.id, count: input.count ?? existing.count });
  const preset = findToolPreset(input.name);
  const id = randomUUID();
  const tidy = input.name.trim().replace(/\s+/g, ' ');
  await ctx.db.query(
    `INSERT INTO tools (id, household_id, name, icon, kind, count, washable, place, note, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
    [
      id,
      ctx.actor.householdId,
      preset && sameName(preset.name, tidy) ? preset.name : tidy.charAt(0).toUpperCase() + tidy.slice(1),
      input.icon ?? preset?.icon ?? 'box',
      input.kind ?? preset?.kind ?? 'other',
      input.count ?? 1,
      input.washable ?? preset?.washable ?? true,
      input.place ?? '',
      input.note ?? '',
      ctx.now,
    ],
  );
  return toTool(await findTool(ctx, id));
}

export async function archiveTool(ctx: FoodCtx, id: string): Promise<void> {
  await findTool(ctx, id);
  await ctx.db.query('UPDATE tools SET archived_at = $2 WHERE id = $1', [id, ctx.now]);
}

/** Used: that many become dirty (only what can be washed; at most what isn't already in the wash). */
export async function markDirty(ctx: FoodCtx, id: string, count: number): Promise<Tool> {
  await settle(ctx);
  const tool = await findTool(ctx, id, true);
  if (tool.washable) await ctx.db.query('UPDATE tools SET dirty = least(count - washing, dirty + $2), updated_at = $3 WHERE id = $1', [id, count, ctx.now]);
  return toTool(await findTool(ctx, id));
}

/**
 * Washes dirty kitchenware: by hand it is clean now; in the dishwasher it is clean when the run is
 * over (the kitchen's dishwasher time, unless given). No ids: everything dirty.
 */
export async function wash(ctx: FoodCtx, input: WashInput): Promise<Tool[]> {
  await settle(ctx);
  const ids = input.toolIds ?? null;
  if (input.how === 'hand') {
    await ctx.db.query(`UPDATE tools SET dirty = 0, updated_at = $3 WHERE household_id = $1 AND dirty > 0 AND ($2::uuid[] IS NULL OR id = ANY($2::uuid[]))`, [
      ctx.actor.householdId,
      ids,
      ctx.now,
    ]);
  } else {
    const { rows } = await ctx.db.query<{ dishwasher_minutes: number }>('SELECT dishwasher_minutes FROM households WHERE id = $1', [ctx.actor.householdId]);
    const minutes = input.minutes ?? rows[0]?.dishwasher_minutes ?? 180;
    const until = new Date(ctx.now.getTime() + minutes * 60_000);
    await ctx.db.query(
      `UPDATE tools SET washing = washing + dirty, dirty = 0, washing_until = greatest(coalesce(washing_until, $3), $3), updated_at = $4
        WHERE household_id = $1 AND dirty > 0 AND washable AND ($2::uuid[] IS NULL OR id = ANY($2::uuid[]))`,
      [ctx.actor.householdId, ids, until, ctx.now],
    );
  }
  return listTools(ctx);
}

/** Takes the dishwasher's load out early: clean now. */
export async function unloadDishwasher(ctx: FoodCtx): Promise<Tool[]> {
  await ctx.db.query('UPDATE tools SET washing = 0, washing_until = NULL, updated_at = $2 WHERE household_id = $1 AND washing > 0', [ctx.actor.householdId, ctx.now]);
  return listTools(ctx);
}

export async function dishwasherMinutes(ctx: FoodCtx): Promise<number> {
  const { rows } = await ctx.db.query<{ dishwasher_minutes: number }>('SELECT dishwasher_minutes FROM households WHERE id = $1', [ctx.actor.householdId]);
  return rows[0]?.dishwasher_minutes ?? 180;
}

export async function setDishwasherMinutes(ctx: FoodCtx, minutes: number): Promise<number> {
  await ctx.db.query('UPDATE households SET dishwasher_minutes = $2 WHERE id = $1', [ctx.actor.householdId, minutes]);
  return minutes;
}

/** What a recipe or meal needs of one kind of kitchenware, and whether it will be ready. */
export interface ToolNeed {
  toolId: string;
  name: string;
  icon: ToolIcon;
  count: number;
  /**
   * ready: clean ones enough; washing: enough once the dishwasher is done (readyAt); dirty: some
   * must be washed first; missing: the kitchen doesn't have that many.
   */
  status: 'ready' | 'washing' | 'dirty' | 'missing';
  readyAt: string | null;
}

export function needOf(tool: Tool, count: number, at: Date): ToolNeed {
  const base = { toolId: tool.id, name: tool.name, icon: tool.icon, count, readyAt: null };
  if (tool.count < count) return { ...base, status: 'missing' };
  if (tool.clean >= count) return { ...base, status: 'ready' };
  const washedBy = tool.washingUntil && new Date(tool.washingUntil) <= at ? tool.washing : 0;
  if (tool.clean + tool.washing >= count) return { ...base, status: washedBy ? 'ready' : 'washing', readyAt: tool.washingUntil };
  return { ...base, status: 'dirty' };
}

export async function recipeTools(ctx: FoodCtx, recipeIds: string[]): Promise<Map<string, Array<{ toolId: string; count: number }>>> {
  const map = new Map<string, Array<{ toolId: string; count: number }>>();
  if (!recipeIds.length) return map;
  const { rows } = await ctx.db.query<{ recipe_id: string; tool_id: string; count: number }>(
    `SELECT rt.recipe_id, rt.tool_id, rt.count FROM recipe_tools rt JOIN tools t ON t.id = rt.tool_id
      WHERE rt.recipe_id = ANY($1::uuid[]) AND t.archived_at IS NULL ORDER BY lower(t.name)`,
    [recipeIds],
  );
  for (const row of rows) map.set(row.recipe_id, [...(map.get(row.recipe_id) ?? []), { toolId: row.tool_id, count: row.count }]);
  return map;
}

/** Replaces what a recipe needs. Names find (or add) kitchenware. */
export async function setRecipeTools(ctx: FoodCtx, recipeId: string, inputs: ToolNeedInput[]): Promise<void> {
  await ctx.db.query('DELETE FROM recipe_tools WHERE recipe_id = $1', [recipeId]);
  for (const input of inputs) {
    const tool = input.toolId ? await findTool(ctx, input.toolId) : await saveTool(ctx, { name: input.name! });
    await ctx.db.query(
      `INSERT INTO recipe_tools (recipe_id, tool_id, count) VALUES ($1, $2, $3) ON CONFLICT (recipe_id, tool_id) DO UPDATE SET count = greatest(recipe_tools.count, excluded.count)`,
      [recipeId, tool.id, input.count ?? 1],
    );
  }
}

/** Needs per owner (recipe or meal) from lists of {toolId, count}, as of `at` for each. */
export function describeNeeds(tools: Tool[], needs: Array<{ toolId: string; count: number }>, at: Date): ToolNeed[] {
  const byId = new Map(tools.map((tool) => [tool.id, tool]));
  // The same pan for two parts of a meal is one pan: the most any part needs.
  const most = new Map<string, number>();
  for (const need of needs) most.set(need.toolId, Math.max(most.get(need.toolId) ?? 0, need.count));
  return [...most].flatMap(([id, count]) => {
    const tool = byId.get(id);
    return tool ? [needOf(tool, count, at)] : [];
  });
}

/** Cooking made these dirty; returns what changed, to take back if the meal is reopened. */
export async function dirtyAfterCooking(ctx: FoodCtx, needs: Array<{ toolId: string; count: number }>): Promise<Array<{ toolId: string; count: number }>> {
  await settle(ctx);
  const done: Array<{ toolId: string; count: number }> = [];
  for (const need of describeNeeds(await listTools(ctx), needs, ctx.now)) {
    const before = await findTool(ctx, need.toolId, true);
    if (!before.washable) continue;
    const after = Math.min(before.count - before.washing, before.dirty + need.count);
    if (after > before.dirty) {
      await ctx.db.query('UPDATE tools SET dirty = $2, updated_at = $3 WHERE id = $1', [before.id, after, ctx.now]);
      done.push({ toolId: before.id, count: after - before.dirty });
    }
  }
  return done;
}

export async function undoDirty(ctx: FoodCtx, dirtied: Array<{ toolId: string; count: number }>): Promise<void> {
  for (const { toolId, count } of dirtied) {
    await ctx.db.query('UPDATE tools SET dirty = greatest(0, dirty - $2) WHERE id = $1 AND household_id = $3', [toolId, count, ctx.actor.householdId]);
  }
}
