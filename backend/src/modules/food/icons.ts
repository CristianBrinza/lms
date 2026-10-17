import { z } from 'zod';
import { AppError } from '../../lib/errors';
import { mergeTranslations, Translations } from '../../lib/i18n';
import type { FoodCtx } from './kitchen';

/**
 * The household's own icons: drawings Claude (or anyone with a key) adds at run time, so a new
 * item gets its own picture in seconds, with no build or release. An icon is stored as data, never
 * as markup: an SVG is parsed here into a strict list of shapes (path, circle, ellipse, rect, line,
 * polyline, polygon, g), every attribute checked against a whitelist, and the app draws that list
 * again through its own whitelist. Keys are `custom:<slug>`, so they never clash with the built-in
 * icons drawn in frontend/src/food/icons.
 */

/** Every icon is drawn on the same 48×48 grid as the built-in ones. */
export const ICON_VIEWBOX = '0 0 48 48';
export const MAX_SHAPES = 60;
export const MAX_ICON_BYTES = 20_000;
const MAX_DEPTH = 4;

export const SHAPE_TAGS = [
  'path',
  'circle',
  'ellipse',
  'rect',
  'line',
  'polyline',
  'polygon',
  'g',
] as const;
export type ShapeTag = (typeof SHAPE_TAGS)[number];

/** One element of a drawing; only a group has children. */
export interface Shape {
  tag: ShapeTag;
  attrs: Record<string, string | number>;
  children?: Shape[];
}

export const CUSTOM_PREFIX = 'custom:';
export type CustomIconKey = `custom:${string}`;
export const isCustomIcon = (icon: string | null | undefined): icon is CustomIconKey =>
  typeof icon === 'string' && icon.startsWith(CUSTOM_PREFIX);

export const customIconKey = z
  .string()
  .max(64, 'Keep the icon key under 64 characters')
  .regex(/^custom:[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Icon keys look like custom:toast-bread')
  .transform((key) => key as CustomIconKey);

// ---------------------------------------------------------------- what an attribute may hold

class DrawingError extends Error {}
const bad = (reason: string): never => {
  throw new DrawingError(reason);
};

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const PATH_DATA = /^[MmZzLlHhVvCcSsQqTtAa0-9eE.,+\-\s]+$/;
const POINTS = /^[0-9eE.,+\-\s]+$/;
const TRANSFORM =
  /^\s*(?:(?:translate|rotate|scale|matrix)\s*\(\s*[+-]?[0-9.]+(?:e[+-]?\d+)?(?:[\s,]+[+-]?[0-9.]+(?:e[+-]?\d+)?)*\s*\)[\s,]*)+$/i;
const DASHES = /^(?:none|[0-9.]+(?:[\s,]+[0-9.]+)*)$/;

type Check = (value: string, name: string) => string | number;

const number =
  (min: number, max: number): Check =>
  (value, name) => {
    const text = value.trim();
    if (!NUMBER.test(text)) bad(`${name}="${value}" is not a plain number`);
    const n = Number(text);
    if (!Number.isFinite(n) || n < min || n > max) bad(`${name}="${value}" is out of range`);
    return n;
  };
const coordinate = number(-1000, 1000);
const size = number(0, 1000);

const paint: Check = (value, name) => {
  const text = value.trim();
  if (text === 'none' || text === 'currentColor') return text;
  if (HEX.test(text)) return text.toLowerCase();
  return bad(`${name}="${value}": colours are hex (#f0705f), none or currentColor`);
};

const pattern =
  (re: RegExp, what: string, max: number): Check =>
  (value, name) => {
    const text = value.trim().replace(/\s+/g, ' ');
    if (!text || text.length > max || !re.test(text)) bad(`${name} must be ${what}`);
    return text;
  };

const oneOf =
  (...allowed: string[]): Check =>
  (value, name) => {
    const text = value.trim();
    if (!allowed.includes(text)) bad(`${name} is one of ${allowed.join(', ')}`);
    return text;
  };

/** Paint and line attributes any shape (and a group) may carry. */
const COMMON: Record<string, Check> = {
  fill: paint,
  stroke: paint,
  'stroke-width': number(0, 20),
  'stroke-linecap': oneOf('butt', 'round', 'square'),
  'stroke-linejoin': oneOf('miter', 'round', 'bevel'),
  'stroke-dasharray': pattern(DASHES, 'numbers', 100),
  opacity: number(0, 1),
  'fill-rule': oneOf('nonzero', 'evenodd'),
  transform: pattern(
    TRANSFORM,
    'translate(), rotate(), scale() or matrix() with numbers only',
    300,
  ),
};

/** The geometry each shape takes. */
const GEOMETRY: Record<ShapeTag, Record<string, Check>> = {
  path: {
    d: (value, name) => {
      const text = pattern(PATH_DATA, 'path data (M, L, C, A, Z… and numbers)', 8000)(value, name);
      if (!/^[Mm]/.test(String(text))) bad('d must start with M');
      return text;
    },
  },
  circle: { cx: coordinate, cy: coordinate, r: size },
  ellipse: { cx: coordinate, cy: coordinate, rx: size, ry: size },
  rect: { x: coordinate, y: coordinate, width: size, height: size, rx: size, ry: size },
  line: { x1: coordinate, y1: coordinate, x2: coordinate, y2: coordinate },
  polyline: { points: pattern(POINTS, 'numbers', 4000) },
  polygon: { points: pattern(POINTS, 'numbers', 4000) },
  g: {},
};

const isTag = (name: string): name is ShapeTag => (SHAPE_TAGS as readonly string[]).includes(name);

function shapeOf(tag: string, raw: Record<string, unknown>): Shape {
  if (!isTag(tag))
    bad(`<${tag}> is not allowed; use path, circle, ellipse, rect, line, polyline, polygon or g`);
  const allowed = { ...GEOMETRY[tag as ShapeTag], ...COMMON };
  const attrs: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(raw)) {
    const check = Object.hasOwn(allowed, name) ? allowed[name] : undefined;
    if (!check) bad(`${name} is not allowed on <${tag}>`);
    if (typeof value !== 'string' && typeof value !== 'number')
      bad(`${name} on <${tag}> must be a number or text`);
    attrs[name] = check!(String(value), name);
  }
  return tag === 'g' ? { tag: 'g', attrs, children: [] } : { tag: tag as ShapeTag, attrs };
}

// ---------------------------------------------------------------- SVG text → shapes

/** The root's defaults, as every built-in icon sets them: an ink outline, no fill, round ends. */
const ROOT_DEFAULTS: Record<string, string | number> = {
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 2.2,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
};
/** The built-in files' themed ink, which the app draws as currentColor. */
const INK = /^var\(\s*--color-ink-900\s*(?:,\s*#1d1d24\s*)?\)$/i;

const TAG =
  /<(\/?)([A-Za-z][\w.:-]*)((?:\s+[^\s=<>/"']+\s*=\s*(?:"[^"<>]*"|'[^'<>]*'))*)\s*(\/?)>/y;
const ATTR = /([^\s=<>/"']+)\s*=\s*(?:"([^"<>]*)"|'([^'<>]*)')/g;

function readAttrs(text: string, tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of text.matchAll(ATTR)) {
    const name = m[1]!;
    if (Object.hasOwn(out, name)) bad(`${name} appears twice on <${tag}>`);
    out[name] = m[2] ?? m[3] ?? '';
  }
  return out;
}

function rootAttrs(raw: Record<string, string>): Record<string, string | number> {
  const overrides: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(raw)) {
    if (name === 'xmlns') {
      if (value !== 'http://www.w3.org/2000/svg') bad('xmlns must be http://www.w3.org/2000/svg');
    } else if (name === 'viewBox') {
      if (
        value
          .trim()
          .split(/[\s,]+/)
          .join(' ') !== ICON_VIEWBOX
      )
        bad(`draw on the 48×48 grid: viewBox="${ICON_VIEWBOX}"`);
    } else if (name === 'width' || name === 'height') {
      if (!/^\d+(?:\.\d+)?(?:px)?$/.test(value.trim())) bad(`${name} on <svg> must be a number`);
    } else if (name === 'stroke' && INK.test(value.trim())) {
      // The themed ink: the default.
    } else if (Object.hasOwn(COMMON, name) && name !== 'transform') {
      const normal = COMMON[name]!(value, name);
      if (ROOT_DEFAULTS[name] !== normal) overrides[name] = normal;
    } else {
      bad(`${name} is not allowed on <svg>`);
    }
  }
  return overrides;
}

/**
 * Parses an icon's SVG into shapes. Only whitespace, comments, an XML declaration and the allowed
 * tags may appear: no text, entities, doctype, CDATA, scripts, styles, links or events.
 */
export function parseSvg(svg: string): Shape[] {
  if (Buffer.byteLength(svg, 'utf8') > MAX_ICON_BYTES) bad('it is larger than 20 KB');
  const text = (svg.charCodeAt(0) === 0xfeff ? svg.slice(1) : svg)
    .replace(/^\s*<\?xml\b[^<>?]*\?>/, '')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  if (/<!|<\?|&/.test(text)) bad('no doctype, entities, CDATA or processing instructions');

  const top: Shape[] = [];
  // Open elements: their children, or null for a shape whose (empty) body may hold nothing.
  const stack: Array<{ tag: string; children: Shape[] | null }> = [];
  let svgState: 'none' | 'open' | 'closed' = 'none';
  let overrides: Record<string, string | number> = {};
  let pos = 0;
  while (pos < text.length) {
    const space = /\s+/y;
    space.lastIndex = pos;
    if (space.exec(text)) {
      pos = space.lastIndex;
      continue;
    }
    if (text[pos] !== '<') bad('only shapes are allowed, no text');
    TAG.lastIndex = pos;
    const m = TAG.exec(text);
    if (!m) bad('a tag could not be read (attributes need quotes)');
    pos = TAG.lastIndex;
    const [, closing, name, rawAttrs, selfClosing] = m!;
    if (closing) {
      if (rawAttrs!.trim() || selfClosing) bad(`</${name}> is malformed`);
      const open = stack.pop();
      if (!open || open.tag !== name) bad(`</${name}> closes nothing`);
      if (name === 'svg') svgState = 'closed';
      continue;
    }
    const attrs = readAttrs(rawAttrs!, name!);
    if (name === 'svg') {
      if (svgState !== 'none' || stack.length) bad('one <svg> root only');
      svgState = 'open';
      overrides = rootAttrs(attrs);
      if (!selfClosing) stack.push({ tag: 'svg', children: top });
      continue;
    }
    if (svgState === 'closed') bad('everything must be inside the <svg>');
    const parent = stack.length ? stack[stack.length - 1]!.children : top;
    if (!parent) bad(`<${stack[stack.length - 1]!.tag}> can’t hold other shapes; use <g>`);
    if (stack.filter((open) => open.tag === 'g').length > MAX_DEPTH)
      bad(`groups nest at most ${MAX_DEPTH} deep`);
    const shape = shapeOf(name!, attrs);
    parent!.push(shape);
    if (!selfClosing) stack.push({ tag: name!, children: shape.children ?? null });
  }
  if (stack.length) bad(`<${stack[stack.length - 1]!.tag}> is not closed`);
  const shapes = Object.keys(overrides).length
    ? [{ tag: 'g' as const, attrs: overrides, children: top }]
    : top;
  return checkSize(shapes);
}

/** Checks a shape list given as JSON ({ tag, attrs, children }), the same way as an SVG. */
export function validateShapes(input: unknown): Shape[] {
  let count = 0;
  const walk = (list: unknown, depth: number): Shape[] => {
    if (!Array.isArray(list)) bad('shapes must be a list');
    return (list as unknown[]).map((item) => {
      if (++count > MAX_SHAPES) bad(`at most ${MAX_SHAPES} shapes`);
      if (!item || typeof item !== 'object' || Array.isArray(item)) bad('each shape is an object');
      const { tag, attrs, children, ...rest } = item as Record<string, unknown>;
      if (Object.keys(rest).length) bad(`a shape has only tag, attrs and children`);
      if (typeof tag !== 'string') bad('each shape needs a tag');
      if (attrs !== undefined && (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)))
        bad('attrs must be an object');
      const shape = shapeOf(tag as string, (attrs ?? {}) as Record<string, unknown>);
      if (children !== undefined) {
        if (shape.tag !== 'g') bad(`only a <g> has children`);
        if (depth >= MAX_DEPTH) bad(`groups nest at most ${MAX_DEPTH} deep`);
        shape.children = walk(children, depth + 1);
      }
      return shape;
    });
  };
  return checkSize(walk(input, 0));
}

function checkSize(shapes: Shape[]): Shape[] {
  const count = (list: Shape[]): number =>
    list.reduce((n, s) => n + 1 + (s.children ? count(s.children) : 0), 0);
  const total = count(shapes);
  if (!total || shapes.every((s) => s.tag === 'g' && !s.children?.length)) bad('it has no shapes');
  if (total > MAX_SHAPES) bad(`at most ${MAX_SHAPES} shapes`);
  if (Buffer.byteLength(JSON.stringify(shapes), 'utf8') > MAX_ICON_BYTES)
    bad('it is larger than 20 KB');
  return shapes;
}

/** An SVG or a shape list as stored shapes; a 400 that says what to change otherwise. */
export function drawingOf(input: { svg?: string; shapes?: unknown }): Shape[] {
  if ((input.svg === undefined) === (input.shapes === undefined))
    throw new AppError(400, 'VALIDATION', 'Send the drawing as svg or as shapes', {
      fields: { svg: 'Send svg or shapes' },
    });
  try {
    return input.svg !== undefined ? parseSvg(input.svg) : validateShapes(input.shapes);
  } catch (error) {
    if (!(error instanceof DrawingError)) throw error;
    throw new AppError(400, 'VALIDATION', `This drawing can’t be used: ${error.message}`, {
      fields: { [input.svg !== undefined ? 'svg' : 'shapes']: error.message },
    });
  }
}

// ---------------------------------------------------------------- stored icons

export const IconInput = z.object({
  key: customIconKey
    .optional()
    .describe(
      'custom:<slug>, e.g. custom:toast-bread. Omitted: made from the name. An existing key is redrawn',
    ),
  name: z
    .string()
    .trim()
    .min(1, 'Give it a name')
    .max(60, 'Keep the name under 60 characters')
    .describe('What it shows, in English: "Toast bread", "Coca-Cola Zero can"'),
  translations: Translations.optional().describe(
    'The name in the other languages: { "ro": { "name": "Pâine de toast" }, "ru": { "name": "Тостовый хлеб" }, "en": { "name": "Toast bread" } }',
  ),
  svg: z
    .string()
    .max(MAX_ICON_BYTES, 'Keep the drawing under 20 KB')
    .optional()
    .describe(`The drawing: one <svg viewBox="${ICON_VIEWBOX}"> with shapes only`),
  shapes: z
    .array(z.record(z.string(), z.unknown()))
    .max(MAX_SHAPES)
    .optional()
    .describe(
      'Or the drawing as JSON: [{ "tag": "path", "attrs": { "d": "M…", "fill": "#f0705f" } }, { "tag": "g", "attrs": { "transform": "rotate(8 24 24)" }, "children": [ … ] }]',
    ),
});
export type IconInput = z.infer<typeof IconInput>;

export interface CustomIcon {
  key: CustomIconKey;
  name: string;
  translations: Translations;
  shapes: Shape[];
  createdAt: string;
}

interface IconRow {
  key: CustomIconKey;
  name: string;
  translations: Translations | null;
  shapes: Shape[];
  created_at: Date;
}

const toIcon = (row: IconRow): CustomIcon => ({
  key: row.key,
  name: row.name,
  translations: row.translations ?? {},
  shapes: row.shapes,
  createdAt: row.created_at.toISOString(),
});

const ICON_COLUMNS = 'key, name, translations, shapes, created_at';

/** Cyrillic to Latin for keys made from Russian names. */
const CYRILLIC: Record<string, string> = Object.fromEntries(
  [
    ...'а:a б:b в:v г:g д:d е:e ё:e ж:zh з:z и:i й:i к:k л:l м:m н:n о:o п:p р:r с:s т:t у:u ф:f х:h ц:ts ч:ch ш:sh щ:sch ъ: ы:y ь: э:e ю:yu я:ya'.split(
      ' ',
    ),
  ].map((pair) => pair.split(':') as [string, string]),
);

/** "Pâine de toast" → custom:paine-de-toast. */
export function iconKeyFor(name: string): CustomIconKey | null {
  const slug = name
    .toLowerCase()
    .replace(/[а-яё]/g, (ch) => CYRILLIC[ch] ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '');
  return slug ? `custom:${slug}` : null;
}

export async function listIcons(ctx: FoodCtx): Promise<CustomIcon[]> {
  const { rows } = await ctx.db.query<IconRow>(
    `SELECT ${ICON_COLUMNS} FROM custom_icons WHERE household_id = $1 ORDER BY lower(name), key`,
    [ctx.actor.householdId],
  );
  return rows.map(toIcon);
}

async function findIcon(ctx: FoodCtx, key: string): Promise<IconRow | null> {
  const { rows } = await ctx.db.query<IconRow>(
    `SELECT ${ICON_COLUMNS} FROM custom_icons WHERE household_id = $1 AND key = $2`,
    [ctx.actor.householdId, key],
  );
  return rows[0] ?? null;
}

/**
 * Adds an icon, or redraws one when its key is given. A key made from the name never replaces
 * another icon: a second "Toast bread" gets custom:toast-bread-2.
 */
export async function saveIcon(
  ctx: FoodCtx,
  input: IconInput,
): Promise<{ icon: CustomIcon; created: boolean }> {
  const shapes = drawingOf(input);
  let key = input.key ?? null;
  if (!key) {
    const base = iconKeyFor(input.name) ?? 'custom:icon';
    key = base;
    for (let n = 2; await findIcon(ctx, key); n += 1) key = `${base}-${n}` as CustomIconKey;
  }
  const existing = await findIcon(ctx, key);
  const translations = JSON.stringify(
    mergeTranslations(existing?.translations ?? {}, input.translations),
  );
  const { rows } = await ctx.db.query<IconRow>(
    `INSERT INTO custom_icons (household_id, key, name, translations, shapes, created_by, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (household_id, key) DO UPDATE
       SET name = EXCLUDED.name, translations = EXCLUDED.translations, shapes = EXCLUDED.shapes
     RETURNING ${ICON_COLUMNS}`,
    [
      ctx.actor.householdId,
      key,
      input.name,
      translations,
      JSON.stringify(shapes),
      ctx.actor.userId,
      ctx.now,
    ],
  );
  return { icon: toIcon(rows[0]!), created: !existing };
}

/** Removes an icon. What used it goes back to the plain picture (basket, pot, box). */
export async function deleteIcon(ctx: FoodCtx, key: string): Promise<void> {
  await ctx.tx(async (tx) => {
    const { rowCount } = await tx.db.query(
      'DELETE FROM custom_icons WHERE household_id = $1 AND key = $2',
      [tx.actor.householdId, key],
    );
    if (!rowCount) throw new AppError(404, 'NOT_FOUND', 'Icon not found');
    const args = [tx.actor.householdId, key];
    await tx.db.query(
      `UPDATE products SET icon = 'basket' WHERE household_id = $1 AND icon = $2`,
      args,
    );
    await tx.db.query(
      `UPDATE recipes SET icon = 'pot' WHERE household_id = $1 AND icon = $2`,
      args,
    );
    await tx.db.query(`UPDATE tools SET icon = 'box' WHERE household_id = $1 AND icon = $2`, args);
  });
}

/** A custom icon set on an item, recipe or kitchenware must be one of this kitchen's own. */
export async function checkIcon(ctx: FoodCtx, icon: string | null | undefined): Promise<void> {
  if (!isCustomIcon(icon)) return;
  if (!(await findIcon(ctx, icon)))
    throw new AppError(400, 'VALIDATION', 'This kitchen has no such icon; create it first', {
      fields: { icon: 'This kitchen has no such icon; create it first' },
    });
}
