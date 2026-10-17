import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import { LOCALES, mergeTranslations, type Translations } from '../../lib/i18n';
import { isUuid } from '../users';
import { combine, fieldIn, onlyFields, toolLocalNames, toolTranslations } from './catalog-i18n';
import { checkIcon, type CustomIconKey } from './icons';
import type { FoodCtx } from './kitchen';
import { normalizeName, sameName } from './presets';
import type { ToolInput, ToolNeedInput, WashInput } from './schemas';

/**
 * Kitchenware: the pots, pans, bowls and glasses a kitchen has (and other things worth counting,
 * like pens). Each kind has a count; some of it can be dirty or in the dishwasher. Recipes say
 * what they need — "a frying pan, or the grill", "a plate each" — cooking makes it dirty, washing
 * by hand makes it clean at once, and the dishwasher makes what may go in it clean when its run is
 * over. Some things are never washed (an electric kettle, the oven); some are used up (baking
 * paper, foil, skewers): cooking takes one and they run low.
 */

export const TOOL_KINDS = [
  'cookware',
  'bakeware',
  'utensil',
  'dishes',
  'bar',
  'appliance',
  'disposable',
  'other',
] as const;
export type ToolKind = (typeof TOOL_KINDS)[number];

export const TOOL_ICONS = [
  'pot',
  'big-pot',
  'saucepan',
  'pan',
  'wok',
  'tray',
  'baking-dish',
  'bowl',
  'board',
  'knife',
  'colander',
  'whisk',
  'grater',
  'ladle',
  'spatula',
  'blender',
  'mixer',
  'kettle',
  'toaster',
  'oven',
  'shaker',
  'jigger',
  'glass',
  'wine-glass',
  'mug',
  'plate',
  'cutlery',
  'lunchbox',
  'ice-tray',
  'pen',
  'scissors',
  'box',
  'electric-kettle',
  'grill',
  'air-fryer',
  'rice-cooker',
  'microwave',
  'coffee-machine',
  'french-press',
  'slow-cooker',
  'pressure-cooker',
  'steamer',
  'thermos',
  'water-bottle',
  'scale',
  'peeler',
  'can-opener',
  'garlic-press',
  'rolling-pin',
  'tongs',
  'muffin-tin',
  'cake-tin',
  'salad-spinner',
  'measuring-cup',
  'ceramic-knife',
  'bread-knife',
  'baking-paper',
  'foil',
  'cling-film',
  'zip-bag',
  'paper-towel',
  'napkins',
  'toothpicks',
  'skewers',
  'muffin-cups',
  'paper-cup',
] as const;
/** A built-in kitchenware icon, or one of the household’s own (custom:…, see icons.ts). */
export type ToolIcon = (typeof TOOL_ICONS)[number] | CustomIconKey;

interface ToolPreset {
  name: string;
  icon: ToolIcon;
  kind: ToolKind;
  /** False for what is never washed (the oven, an electric kettle) and for single-use things. */
  washable: boolean;
  /** False for what is washed by hand only (knives, the grill, wooden boards). */
  dishwasherSafe: boolean;
  aliases?: string[];
}

type Care = 'dishwasher' | 'hand' | 'never';

const T = (
  name: string,
  icon: ToolIcon,
  kind: ToolKind,
  aliases?: string[],
  care: Care = 'dishwasher',
): ToolPreset => ({
  name,
  icon,
  kind,
  washable: care !== 'never' && kind !== 'disposable',
  dishwasherSafe: care === 'dishwasher' && kind !== 'disposable',
  ...(aliases ? { aliases } : {}),
});

export const TOOL_PRESETS: readonly ToolPreset[] = [
  // Cooking
  T('Big pot', 'big-pot', 'cookware', [
    'pasta pot',
    'stock pot',
    'oală mare',
    'кастрюля большая',
    'pot for spaghetti',
  ]),
  T('Pot', 'pot', 'cookware', ['oală', 'oala', 'кастрюля']),
  T('Saucepan', 'saucepan', 'cookware', ['crăticioară', 'ковш', 'small pot']),
  T('Frying pan', 'pan', 'cookware', ['tigaie', 'сковорода', 'skillet', 'pan']),
  T('Wok', 'wok', 'cookware', ['вок']),
  T(
    'Grill',
    'grill',
    'cookware',
    ['grătar', 'gratar', 'гриль', 'grill pan', 'contact grill'],
    'hand',
  ),
  T('Steamer', 'steamer', 'cookware', ['aburi', 'пароварка']),
  // Baking
  T('Baking tray', 'tray', 'bakeware', ['tavă', 'tava', 'противень', 'sheet pan']),
  T('Baking dish', 'baking-dish', 'bakeware', [
    'formă de copt',
    'форма для запекания',
    'casserole dish',
  ]),
  T('Muffin tin', 'muffin-tin', 'bakeware', ['formă de brioșe', 'форма для маффинов']),
  T('Cake tin', 'cake-tin', 'bakeware', ['formă de tort', 'форма для торта', 'springform']),
  T('Rolling pin', 'rolling-pin', 'bakeware', ['sucitor', 'скалка'], 'hand'),
  // Tools
  T('Mixing bowl', 'bowl', 'utensil', ['bol', 'миска']),
  T('Cutting board', 'board', 'utensil', ['tocător', 'tocator', 'разделочная доска'], 'hand'),
  T(
    'Chef’s knife',
    'knife',
    'utensil',
    ['chef knife', 'cuțit de bucătar', 'поварской нож'],
    'hand',
  ),
  T('Ceramic knife', 'ceramic-knife', 'utensil', ['cuțit ceramic', 'керамический нож'], 'hand'),
  T('Knife', 'knife', 'utensil', ['cuțit', 'cutit', 'нож', 'kitchen knife'], 'hand'),
  T('Bread knife', 'bread-knife', 'utensil', ['cuțit de pâine', 'нож для хлеба'], 'hand'),
  T('Colander', 'colander', 'utensil', ['strecurătoare', 'дуршлаг', 'strainer', 'sieve']),
  T('Whisk', 'whisk', 'utensil', ['tel', 'венчик']),
  T('Grater', 'grater', 'utensil', ['răzătoare', 'терка', 'тёрка']),
  T('Peeler', 'peeler', 'utensil', ['curățător', 'овощечистка']),
  T('Ladle', 'ladle', 'utensil', ['polonic', 'половник']),
  T('Spatula', 'spatula', 'utensil', ['paletă', 'лопатка']),
  T('Tongs', 'tongs', 'utensil', ['clește', 'щипцы']),
  T('Can opener', 'can-opener', 'utensil', ['deschizător de conserve', 'консервный нож'], 'hand'),
  T('Garlic press', 'garlic-press', 'utensil', ['presă de usturoi', 'чесночница']),
  T('Salad spinner', 'salad-spinner', 'utensil', ['uscător de salată', 'сушилка для салата']),
  T('Measuring cup', 'measuring-cup', 'utensil', ['cană gradată', 'мерный стакан']),
  // Appliances
  T('Blender', 'blender', 'appliance', ['блендер'], 'hand'),
  T('Mixer', 'mixer', 'appliance', ['миксер'], 'hand'),
  T(
    'Air fryer',
    'air-fryer',
    'appliance',
    ['friteuză cu aer', 'аэрогриль', 'аэрофритюрница', 'airfryer'],
    'hand',
  ),
  T('Rice cooker', 'rice-cooker', 'appliance', ['aparat de orez', 'рисоварка'], 'hand'),
  T('Slow cooker', 'slow-cooker', 'appliance', ['multicooker', 'мультиварка'], 'hand'),
  T(
    'Pressure cooker',
    'pressure-cooker',
    'appliance',
    ['oală sub presiune', 'скороварка', 'instant pot'],
    'hand',
  ),
  T(
    'Coffee machine',
    'coffee-machine',
    'appliance',
    ['espressor', 'кофемашина', 'coffee maker'],
    'hand',
  ),
  T('French press', 'french-press', 'appliance', ['френч-пресс', 'presă de cafea']),
  T(
    'Electric kettle',
    'electric-kettle',
    'appliance',
    ['kettle', 'fierbător', 'ceainic electric', 'электрочайник', 'чайник'],
    'never',
  ),
  T('Microwave', 'microwave', 'appliance', ['cuptor cu microunde', 'микроволновка'], 'never'),
  T('Toaster', 'toaster', 'appliance', ['тостер'], 'never'),
  T('Oven', 'oven', 'appliance', ['cuptor', 'духовка'], 'never'),
  T('Kitchen scale', 'scale', 'appliance', ['cântar', 'весы', 'scales'], 'never'),
  // Bar
  T('Cocktail shaker', 'shaker', 'bar', ['shaker', 'шейкер']),
  T('Jigger', 'jigger', 'bar', ['мерка']),
  T('Ice cube tray', 'ice-tray', 'bar', ['formă de gheață', 'форма для льда']),
  // At the table
  T('Glasses', 'glass', 'dishes', ['pahare', 'стаканы', 'glass']),
  T('Wine glasses', 'wine-glass', 'dishes', ['pahare de vin', 'бокалы']),
  T('Mugs', 'mug', 'dishes', ['căni', 'кружки', 'cups']),
  T('Plates', 'plate', 'dishes', ['farfurii', 'тарелки']),
  T('Bowls', 'bowl', 'dishes', ['boluri', 'тарелки глубокие', 'soup bowls']),
  T('Cutlery', 'cutlery', 'dishes', [
    'tacâmuri',
    'столовые приборы',
    'forks',
    'spoons',
    'fork and knife',
  ]),
  T('Lunch box', 'lunchbox', 'dishes', ['caserolă', 'ланчбокс', 'food container']),
  T('Food flask', 'thermos', 'dishes', ['termos', 'термос', 'thermos']),
  T('Water bottle', 'water-bottle', 'dishes', ['sticlă de apă', 'бутылка для воды']),
  // Used up
  T('Baking paper', 'baking-paper', 'disposable', ['hârtie de copt', 'пергамент', 'parchment']),
  T('Aluminium foil', 'foil', 'disposable', ['folie de aluminiu', 'фольга', 'foil']),
  T('Cling film', 'cling-film', 'disposable', [
    'folie alimentară',
    'пищевая плёнка',
    'plastic wrap',
  ]),
  T('Zip bags', 'zip-bag', 'disposable', ['pungi cu fermoar', 'зип-пакеты', 'freezer bags']),
  T('Paper towels', 'paper-towel', 'disposable', ['prosoape de hârtie', 'бумажные полотенца']),
  T('Napkins', 'napkins', 'disposable', ['șervețele', 'салфетки']),
  T('Toothpicks', 'toothpicks', 'disposable', ['scobitori', 'зубочистки']),
  T('Skewers', 'skewers', 'disposable', ['frigărui', 'шпажки', 'шампуры']),
  T('Muffin cups', 'muffin-cups', 'disposable', ['forme de hârtie', 'бумажные формочки']),
  T('Paper cups', 'paper-cup', 'disposable', ['pahare de unică folosință', 'одноразовые стаканы']),
  // Not for the kitchen, still worth counting
  T('Pens', 'pen', 'other', ['pixuri', 'ручки', 'pen'], 'never'),
  T('Scissors', 'scissors', 'other', ['foarfece', 'ножницы'], 'hand'),
];

/** Things set at the table one per person (plates, cutlery, glasses, lunch boxes). */
const PER_PERSON_KINDS = new Set<ToolKind>(['dishes']);

export function findToolPreset(name: string): ToolPreset | null {
  return (
    TOOL_PRESETS.find(
      (preset) =>
        sameName(preset.name, name) || preset.aliases?.some((alias) => sameName(alias, name)),
    ) ??
    // Its Romanian or Russian name: "Tigaie", "Сковорода".
    TOOL_PRESETS.find((preset) =>
      toolLocalNames(preset.name).some((local) => sameName(local, name)),
    ) ??
    null
  );
}

/** The kitchenware presets with their names in all three languages, for the app's picker. */
export const toolPresetsWithNames = () =>
  TOOL_PRESETS.map((preset) => ({ ...preset, translations: toolTranslations(preset.name) }));

/** Every name a tool goes by: its own, and its name in each language. */
function toolNames(row: { name: string; translations?: Translations | null }): string[] {
  const names = [row.name];
  for (const locale of LOCALES) {
    const name = fieldIn(row.translations, 'name', locale);
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
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
  /** False: washed by hand only (knives, the grill), so the dishwasher leaves it dirty. */
  dishwasherSafe: boolean;
  /** Single-use things: below this many, they are running low. */
  minCount: number | null;
  low: boolean;
  /** Where it is kept ("top drawer"). */
  place: string;
  note: string;
  /** Its name in other languages ({ ro: { name }, ru: …, en: … }): the catalog's, or the household's. */
  translations: Translations;
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
  dishwasher_safe: boolean;
  min_count: number | null;
  place: string;
  note: string;
  translations: Translations | null;
}

const TOOL_COLUMNS =
  'id, name, icon, kind, count, dirty, washing, washing_until, washable, dishwasher_safe, min_count, place, note, translations';

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
  dishwasherSafe: row.dishwasher_safe,
  minCount: row.min_count,
  low: row.kind === 'disposable' && row.count <= (row.min_count ?? 0),
  place: row.place,
  note: row.note,
  translations: row.translations ?? {},
});

/** A dishwasher run that is over leaves its load clean. */
async function settle(ctx: FoodCtx): Promise<void> {
  await ctx.db.query(
    'UPDATE tools SET washing = 0, washing_until = NULL WHERE household_id = $1 AND washing_until IS NOT NULL AND washing_until <= $2',
    [ctx.actor.householdId, ctx.now],
  );
}

export async function listTools(ctx: FoodCtx): Promise<Tool[]> {
  await settle(ctx);
  const { rows } = await ctx.db.query<ToolRow>(
    `SELECT ${TOOL_COLUMNS} FROM tools WHERE household_id = $1 AND archived_at IS NULL ORDER BY kind, lower(name)`,
    [ctx.actor.householdId],
  );
  return rows.map(toTool);
}

async function findTool(ctx: FoodCtx, id: string, lock = false): Promise<ToolRow> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'That is not in your kitchenware');
  const { rows } = await ctx.db.query<ToolRow>(
    `SELECT ${TOOL_COLUMNS} FROM tools WHERE id = $1 AND household_id = $2${lock ? ' FOR UPDATE' : ''}`,
    [id, ctx.actor.householdId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'That is not in your kitchenware');
  return rows[0];
}

async function findToolByName(ctx: FoodCtx, name: string): Promise<ToolRow | null> {
  const { rows } = await ctx.db.query<ToolRow & { archived_at: Date | null }>(
    `SELECT ${TOOL_COLUMNS}, archived_at FROM tools WHERE household_id = $1`,
    [ctx.actor.householdId],
  );
  const preset = findToolPreset(name);
  return (
    rows.find((row) => normalizeName(row.name) === normalizeName(name)) ??
    rows.find((row) => sameName(row.name, name)) ??
    rows.find((row) => toolNames(row).some((other) => sameName(other, name))) ??
    (preset ? (rows.find((row) => sameName(row.name, preset.name)) ?? null) : null)
  );
}

/**
 * The catalog's names for kitchenware named like a preset ("Frying pan", or "Tigaie"), with the
 * name as written kept in its own language; {} for anything else.
 */
function toolSeed(name: string): Translations {
  const preset = findToolPreset(name);
  if (!preset) return {};
  const catalog = toolTranslations(preset.name);
  if (!catalog.en) return {};
  const [ro, ru] = toolLocalNames(preset.name);
  const own = name.trim();
  if (sameName(preset.name, name)) return combine(catalog, { en: { name: own } });
  if (ro && sameName(ro, name)) return combine(catalog, { ro: { name: own } });
  if (ru && sameName(ru, name)) return combine(catalog, { ru: { name: own } });
  return {};
}

/** Translations without `name` (a renamed tool's old names). */
function withoutName(value: Translations): Translations {
  const out: Translations = {};
  for (const locale of LOCALES) {
    const { name: _name, ...rest } = value[locale] ?? {};
    if (Object.keys(rest).length) out[locale] = rest;
  }
  return out;
}

/**
 * Gives kitchenware from the catalog (by its key, the catalog's own name) its names in Romanian and
 * Russian, where it has none yet. Safe to run again. Returns how many changed.
 */
export async function refreshToolsFromCatalog(ctx: FoodCtx): Promise<number> {
  const { rows } = await ctx.db.query<{ id: string; name: string; translations: Translations }>(
    'SELECT id, name, translations FROM tools WHERE household_id = $1',
    [ctx.actor.householdId],
  );
  let changed = 0;
  for (const row of rows) {
    const preset = TOOL_PRESETS.find((p) => p.name === row.name);
    if (!preset || row.translations?.ro?.name || row.translations?.ru?.name) continue;
    await ctx.db.query('UPDATE tools SET translations = $2::jsonb WHERE id = $1', [
      row.id,
      JSON.stringify(mergeTranslations(toolTranslations(preset.name), row.translations)),
    ]);
    changed += 1;
  }
  return changed;
}

export async function saveTool(ctx: FoodCtx, input: ToolInput & { id?: string }): Promise<Tool> {
  await checkIcon(ctx, input.icon);
  await settle(ctx);
  if (input.id) {
    const tool = await findTool(ctx, input.id, true);
    const count = input.count ?? tool.count;
    // Fewer than before: the missing ones were clean ones first, then dirty ones.
    const dirty = Math.min(tool.dirty, Math.max(0, count - tool.washing));
    const kind = input.kind ?? tool.kind;
    // Renamed: the old name's translations no longer fit (a catalog name brings its own).
    const renamed = Boolean(input.name && normalizeName(input.name) !== normalizeName(tool.name));
    const before = tool.translations ?? {};
    const base = renamed
      ? mergeTranslations(withoutName(before), toolSeed(input.name!))
      : mergeTranslations(before, {});
    const translations =
      renamed || input.translations !== undefined
        ? JSON.stringify(mergeTranslations(base, input.translations))
        : null;
    await ctx.db.query(
      `UPDATE tools SET name = coalesce($2, name), icon = coalesce($3, icon), kind = $4, count = $5, dirty = $6,
              washable = coalesce($7, washable), place = coalesce($8, place), note = coalesce($9, note),
              dishwasher_safe = coalesce($11, dishwasher_safe), min_count = CASE WHEN $12::boolean THEN $13 ELSE min_count END,
              translations = coalesce($14::jsonb, translations), archived_at = NULL, updated_at = $10
        WHERE id = $1`,
      [
        tool.id,
        input.name ?? null,
        input.icon ?? null,
        kind,
        count,
        kind === 'disposable' ? 0 : dirty,
        kind === 'disposable' ? false : (input.washable ?? null),
        input.place ?? null,
        input.note ?? null,
        ctx.now,
        input.dishwasherSafe ?? null,
        input.minCount !== undefined,
        input.minCount ?? null,
        translations,
      ],
    );
    return toTool(await findTool(ctx, tool.id));
  }
  if (!input.name)
    throw new AppError(400, 'VALIDATION', 'Name it', { fields: { name: 'Required' } });
  const existing = await findToolByName(ctx, input.name);
  // Found by another of its names ("tigaie" is the Frying pan): it keeps its own.
  if (existing)
    return saveTool(ctx, {
      ...input,
      name: normalizeName(existing.name) === normalizeName(input.name) ? input.name : undefined,
      id: existing.id,
      count: input.count ?? existing.count,
    });
  const preset = findToolPreset(input.name);
  const id = randomUUID();
  const tidy = input.name.trim().replace(/\s+/g, ' ');
  const kind = input.kind ?? preset?.kind ?? 'other';
  await ctx.db.query(
    `INSERT INTO tools (id, household_id, name, icon, kind, count, washable, place, note, created_at, updated_at, dishwasher_safe, min_count, translations)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11, $12, $13)`,
    [
      id,
      ctx.actor.householdId,
      // A catalog name for what the catalog knows ("kettle" is the Electric kettle); else as typed.
      preset ? preset.name : tidy.charAt(0).toUpperCase() + tidy.slice(1),
      input.icon ?? preset?.icon ?? 'box',
      kind,
      input.count ?? 1,
      kind === 'disposable' ? false : (input.washable ?? preset?.washable ?? true),
      input.place ?? '',
      input.note ?? '',
      ctx.now,
      input.dishwasherSafe ?? preset?.dishwasherSafe ?? true,
      input.minCount ?? (kind === 'disposable' ? 2 : null),
      // Kitchenware from the catalog arrives with its names in all three languages.
      JSON.stringify(
        mergeTranslations(preset ? toolTranslations(preset.name) : {}, input.translations),
      ),
    ],
  );
  return toTool(await findTool(ctx, id));
}

export async function archiveTool(ctx: FoodCtx, id: string): Promise<void> {
  await findTool(ctx, id);
  await ctx.db.query('UPDATE tools SET archived_at = $2 WHERE id = $1', [id, ctx.now]);
}

/**
 * Used: that many become dirty (only what is washed; at most what isn't already in the wash), or,
 * for single-use things (baking paper, skewers), that many are gone.
 */
export async function markDirty(ctx: FoodCtx, id: string, count: number): Promise<Tool> {
  await settle(ctx);
  const tool = await findTool(ctx, id, true);
  if (tool.kind === 'disposable')
    await ctx.db.query(
      'UPDATE tools SET count = greatest(0, count - $2), updated_at = $3 WHERE id = $1',
      [id, count, ctx.now],
    );
  else if (tool.washable)
    await ctx.db.query(
      'UPDATE tools SET dirty = least(count - washing, dirty + $2), updated_at = $3 WHERE id = $1',
      [id, count, ctx.now],
    );
  return toTool(await findTool(ctx, id));
}

/**
 * Washes dirty kitchenware: by hand it is clean now; in the dishwasher it is clean when the run is
 * over (the kitchen's dishwasher time, unless given) — only what may go in it; knives, the grill
 * and wooden boards stay dirty, to wash by hand. No ids: everything dirty.
 */
export async function wash(ctx: FoodCtx, input: WashInput): Promise<Tool[]> {
  await settle(ctx);
  const ids = input.toolIds ?? null;
  if (input.how === 'hand') {
    await ctx.db.query(
      `UPDATE tools SET dirty = 0, updated_at = $3 WHERE household_id = $1 AND dirty > 0 AND ($2::uuid[] IS NULL OR id = ANY($2::uuid[]))`,
      [ctx.actor.householdId, ids, ctx.now],
    );
  } else {
    const { rows } = await ctx.db.query<{ dishwasher_minutes: number }>(
      'SELECT dishwasher_minutes FROM households WHERE id = $1',
      [ctx.actor.householdId],
    );
    const minutes = input.minutes ?? rows[0]?.dishwasher_minutes ?? 180;
    const until = new Date(ctx.now.getTime() + minutes * 60_000);
    await ctx.db.query(
      `UPDATE tools SET washing = washing + dirty, dirty = 0, washing_until = greatest(coalesce(washing_until, $3), $3), updated_at = $4
        WHERE household_id = $1 AND dirty > 0 AND washable AND dishwasher_safe AND ($2::uuid[] IS NULL OR id = ANY($2::uuid[]))`,
      [ctx.actor.householdId, ids, until, ctx.now],
    );
  }
  return listTools(ctx);
}

/** Takes the dishwasher's load out early: clean now. */
export async function unloadDishwasher(ctx: FoodCtx): Promise<Tool[]> {
  await ctx.db.query(
    'UPDATE tools SET washing = 0, washing_until = NULL, updated_at = $2 WHERE household_id = $1 AND washing > 0',
    [ctx.actor.householdId, ctx.now],
  );
  return listTools(ctx);
}

export async function dishwasherMinutes(ctx: FoodCtx): Promise<number> {
  const { rows } = await ctx.db.query<{ dishwasher_minutes: number }>(
    'SELECT dishwasher_minutes FROM households WHERE id = $1',
    [ctx.actor.householdId],
  );
  return rows[0]?.dishwasher_minutes ?? 180;
}

export async function setDishwasherMinutes(ctx: FoodCtx, minutes: number): Promise<number> {
  await ctx.db.query('UPDATE households SET dishwasher_minutes = $2 WHERE id = $1', [
    ctx.actor.householdId,
    minutes,
  ]);
  return minutes;
}

type Status = 'ready' | 'washing' | 'dirty' | 'missing';

/** What a recipe asks for: a tool (or one of its alternatives), how many, and whether per person. */
export interface NeedSpec {
  toolId: string;
  count: number;
  /** One each (plates, cutlery, lunch boxes): times the servings. */
  perServing: boolean;
  /** Or one of these instead (the grill, the air fryer, for a frying pan). */
  alternatives: string[];
}

/** What a recipe or meal needs of one kind of kitchenware, and whether it will be ready. */
export interface ToolNeed {
  toolId: string;
  name: string;
  /** Its name in other languages ({ ro: { name } }). */
  translations: Translations;
  icon: ToolIcon;
  count: number;
  perServing: boolean;
  /**
   * Of the option that will be used: ready: clean ones enough; washing: enough once the
   * dishwasher is done (readyAt); dirty: some must be washed first; missing: the kitchen doesn't
   * have that many (or, for single-use things, not that many left).
   */
  status: Status;
  readyAt: string | null;
  /** The tool and its alternatives, each with its status; `using` is the one to use. */
  options: Array<{
    toolId: string;
    name: string;
    translations: Translations;
    icon: ToolIcon;
    status: Status;
    readyAt: string | null;
  }>;
  using: string;
}

function statusOf(tool: Tool, count: number, at: Date): { status: Status; readyAt: string | null } {
  if (tool.count < count) return { status: 'missing', readyAt: null };
  if (tool.clean >= count || !tool.washable) return { status: 'ready', readyAt: null };
  if (tool.clean + tool.washing >= count) {
    const doneBy = tool.washingUntil !== null && new Date(tool.washingUntil) <= at;
    return { status: doneBy ? 'ready' : 'washing', readyAt: tool.washingUntil };
  }
  return { status: 'dirty', readyAt: null };
}

const RANK: Record<Status, number> = { ready: 0, washing: 1, dirty: 2, missing: 3 };

export async function recipeTools(
  ctx: FoodCtx,
  recipeIds: string[],
): Promise<Map<string, NeedSpec[]>> {
  const map = new Map<string, NeedSpec[]>();
  if (!recipeIds.length) return map;
  const { rows } = await ctx.db.query<{
    recipe_id: string;
    tool_id: string;
    count: number;
    per_serving: boolean;
    alternatives: string[];
  }>(
    `SELECT rt.recipe_id, rt.tool_id, rt.count, rt.per_serving, rt.alternatives FROM recipe_tools rt JOIN tools t ON t.id = rt.tool_id
      WHERE rt.recipe_id = ANY($1::uuid[]) AND t.archived_at IS NULL ORDER BY lower(t.name)`,
    [recipeIds],
  );
  for (const row of rows) {
    const spec: NeedSpec = {
      toolId: row.tool_id,
      count: row.count,
      perServing: row.per_serving,
      alternatives: row.alternatives ?? [],
    };
    map.set(row.recipe_id, [...(map.get(row.recipe_id) ?? []), spec]);
  }
  return map;
}

/** Replaces what a recipe needs. Names find (or add) kitchenware; plates and the like are one each unless said. */
export async function setRecipeTools(
  ctx: FoodCtx,
  recipeId: string,
  inputs: ToolNeedInput[],
): Promise<void> {
  await ctx.db.query('DELETE FROM recipe_tools WHERE recipe_id = $1', [recipeId]);
  for (const input of inputs) {
    const tool = input.toolId
      ? toTool(await findTool(ctx, input.toolId))
      : await saveTool(ctx, { name: input.name! });
    const alternatives: string[] = [];
    for (const alt of input.or ?? []) {
      const other = alt.toolId
        ? toTool(await findTool(ctx, alt.toolId))
        : await saveTool(ctx, { name: alt.name! });
      if (other.id !== tool.id && !alternatives.includes(other.id)) alternatives.push(other.id);
    }
    await ctx.db.query(
      `INSERT INTO recipe_tools (recipe_id, tool_id, count, per_serving, alternatives) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (recipe_id, tool_id) DO UPDATE SET count = greatest(recipe_tools.count, excluded.count), alternatives = excluded.alternatives`,
      [
        recipeId,
        tool.id,
        input.count ?? 1,
        input.perServing ?? PER_PERSON_KINDS.has(tool.kind),
        alternatives,
      ],
    );
  }
}

/**
 * Needs for `servings` people, as of `at` (a planned meal's time: the dishwasher may be done by
 * then). The same pan for two parts of a meal is one pan: the most any part needs. Of a tool and
 * its alternatives, the one to use is the readiest (the frying pan if clean, else the grill).
 */
export function describeNeeds(
  tools: Tool[],
  specs: Array<NeedSpec & { servings: number }>,
  at: Date,
): ToolNeed[] {
  const byId = new Map(tools.map((tool) => [tool.id, tool]));
  const merged = new Map<string, NeedSpec & { total: number }>();
  for (const spec of specs) {
    const total = spec.perServing ? spec.count * Math.max(1, spec.servings) : spec.count;
    const known = merged.get(spec.toolId);
    merged.set(
      spec.toolId,
      known
        ? {
            ...known,
            total: Math.max(known.total, total),
            alternatives: [...new Set([...known.alternatives, ...spec.alternatives])],
          }
        : { ...spec, total },
    );
  }
  return [...merged.values()].flatMap((spec) => {
    const main = byId.get(spec.toolId);
    if (!main) return [];
    const options = [
      main,
      ...spec.alternatives.map((id) => byId.get(id)).filter((tool): tool is Tool => Boolean(tool)),
    ].map((tool) => ({
      toolId: tool.id,
      name: tool.name,
      translations: onlyFields(tool.translations, ['name']),
      icon: tool.icon,
      ...statusOf(tool, spec.total, at),
    }));
    const best = options.reduce((a, b) => (RANK[b.status] < RANK[a.status] ? b : a));
    return [
      {
        toolId: main.id,
        name: main.name,
        translations: onlyFields(main.translations, ['name']),
        icon: main.icon,
        count: spec.total,
        perServing: spec.perServing,
        status: best.status,
        readyAt: best.readyAt,
        options,
        using: best.toolId,
      },
    ];
  });
}

/** What cooking did to the kitchenware, to take back if the meal is reopened. */
export interface Dirtied {
  toolId: string;
  count: number;
  /** Single-use: that many were used up rather than made dirty. */
  used?: boolean;
}

/** Cooking made what it used dirty (or used up the single-use things). */
export async function dirtyAfterCooking(
  ctx: FoodCtx,
  specs: Array<NeedSpec & { servings: number }>,
): Promise<Dirtied[]> {
  await settle(ctx);
  const done: Dirtied[] = [];
  for (const need of describeNeeds(await listTools(ctx), specs, ctx.now)) {
    const before = await findTool(ctx, need.using, true);
    if (before.kind === 'disposable') {
      const used = Math.min(before.count, need.count);
      if (used > 0) {
        await ctx.db.query('UPDATE tools SET count = count - $2, updated_at = $3 WHERE id = $1', [
          before.id,
          used,
          ctx.now,
        ]);
        done.push({ toolId: before.id, count: used, used: true });
      }
      continue;
    }
    if (!before.washable) continue;
    const after = Math.min(before.count - before.washing, before.dirty + need.count);
    if (after > before.dirty) {
      await ctx.db.query('UPDATE tools SET dirty = $2, updated_at = $3 WHERE id = $1', [
        before.id,
        after,
        ctx.now,
      ]);
      done.push({ toolId: before.id, count: after - before.dirty });
    }
  }
  return done;
}

export async function undoDirty(ctx: FoodCtx, dirtied: Dirtied[]): Promise<void> {
  for (const { toolId, count, used } of dirtied) {
    if (used)
      await ctx.db.query(
        'UPDATE tools SET count = count + $2 WHERE id = $1 AND household_id = $3',
        [toolId, count, ctx.actor.householdId],
      );
    else
      await ctx.db.query(
        'UPDATE tools SET dirty = greatest(0, dirty - $2) WHERE id = $1 AND household_id = $3',
        [toolId, count, ctx.actor.householdId],
      );
  }
}
