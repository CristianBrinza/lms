import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type { AppDeps } from '../../context';
import { AppError } from '../../lib/errors';
import { findVips } from '../drinks/photos';
import { foodCtx, type Actor, type FoodCtx } from '../food/kitchen';
import { publishChange } from '../live/publish';
import { isUuid } from '../users';
import { findItem, type Item } from './items';
import type { Mannequin } from './schemas';
import { ghostPng, partsFor, PARSING_ENDPOINT, PARSING_SPACE, type Part } from './ghost';
import { addPhoto, storePhoto } from './photos';
import type { PhotoInput } from './schemas';
import { connectSpace, createGate, fetchSpaceFile, fileUrl, type SpaceClient } from './space';

/**
 * Virtual try-on: dresses a piece on the a store mannequin with IDM-VTON, a free Hugging Face
 * Space (ZeroGPU), called from here with @gradio/client. A try-on takes one to two minutes, so it
 * runs as an in-process job, one at a time for the whole server: the request answers 202 at once,
 * the piece carries tryon_status ('', 'running', 'failed: <reason>'), and the result arrives as a
 * photo of kind 'tryon' (never a cut-out or the cover) with a live-sync event.
 */

export const TRYON_SPACE = 'yisol/IDM-VTON';
export const TRYON_ENDPOINT = '/tryon';
export const TRYON_TIMEOUT_MS = 3 * 60 * 1000;

// ------------------------------------------------------------------ the Space

/** One call to the Space: the inputs by name, the outputs in order. */
export type TryonClient = SpaceClient;
type Connect = (token: string | null) => Promise<TryonClient>;

const realConnect: Connect = (token) => connectSpace(TRYON_SPACE, token);

let connect: Connect = realConnect;
/** Tests swap the Space for a fake; call with nothing to put the real one back. */
export function setTryonClient(next?: Connect) {
  connect = next ?? realConnect;
}

// ------------------------------------------------------------------ mapping

/** What the Space is asked: IDM-VTON's /tryon inputs, by name (as its API lists them). */
export function tryonPayload(person: Blob, garment: Blob, description: string) {
  return {
    dict: { background: person, layers: [], composite: null },
    garm_img: garment,
    garment_des: description,
    is_checked: true, // auto-mask the clothes to replace
    is_checked_crop: false,
    denoise_steps: 30,
    seed: 42,
  };
}

const CATEGORY_WORDS: Record<string, string> = {
  tops: 'top',
  bottoms: 'trousers or skirt',
  dresses: 'dress',
  outerwear: 'coat or jacket',
  shoes: 'shoes',
};

/** The garment description the model reads: the piece's name and what kind of garment it is. */
export function garmentDescription(item: Pick<Item, 'name' | 'category'>): string {
  const name = item.name.trim().slice(0, 80);
  const kind = CATEGORY_WORDS[item.category] ?? item.category.replace(/[_-]/g, ' ');
  if (!name || !kind || name.toLowerCase().includes(kind)) return name || kind || 'garment';
  return `${name}, ${kind}`;
}

export const TRYON_MESSAGES = {
  quota: 'Hugging Face’s free quota is used up for today; try again tomorrow',
  busy: 'The try-on service is busy right now; try again in a few minutes',
  asleep: 'The try-on service is starting up or being updated; try again in a few minutes',
  timeout: 'The try-on took too long; try again',
  photo: 'The AI couldn’t fit this photo on the mannequin; try another photo of the piece',
  failed: 'The try-on didn’t work this time; try again later',
} as const;

const textOf = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error) ?? '';
  } catch {
    return '';
  }
};

/** A Space or network error → a short, friendly reason (what the person is told). */
export function tryonErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  const text = textOf(error).toLowerCase();
  if (/quota|exceeded your|zerogpu|429|rate.?limit|too many requests/.test(text)) return TRYON_MESSAGES.quota;
  if (/timeout|timed out|aborted/.test(text)) return TRYON_MESSAGES.timeout;
  if (/queue|busy|full|capacity|overloaded|503/.test(text)) return TRYON_MESSAGES.busy;
  if (/sleep|paused|building|starting|runtime|not found|404|could not get space|space metadata|config/.test(text))
    return TRYON_MESSAGES.asleep;
  if (/densepose|pose|no person|keypoint|mask/.test(text)) return TRYON_MESSAGES.photo;
  return TRYON_MESSAGES.failed;
}

/** The URL of the output picture in the Space's answer (its first output). */
export function resultUrl(data: unknown[]): string | null {
  return fileUrl(data[0]);
}

// ------------------------------------------------------------------ images

const run = promisify(execFile);

/** The garment on white, as a JPEG: a transparent cut-out would otherwise turn black. */
export async function flattenOnWhite(
  bytes: Buffer,
  mime: string,
): Promise<{ bytes: Buffer; mime: string }> {
  const thumbnail = await findVips();
  if (!thumbnail) return { bytes, mime };
  const dir = await mkdtemp(join(tmpdir(), 'lms-tryon-'));
  try {
    const source = join(dir, 'in.img');
    const out = join(dir, 'out.jpg');
    await writeFile(source, bytes);
    await run(
      join(dirname(thumbnail), 'vips'),
      ['flatten', source, `${out}[Q=92]`, '--background', '255 255 255'],
      { timeout: 60_000, env: { ...process.env, VIPS_CONCURRENCY: '1' } },
    );
    return { bytes: await readFile(out), mime: 'image/jpeg' };
  } catch {
    return { bytes, mime };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// ------------------------------------------------------------------ mannequins

/**
 * The person the garment is put on: one of two store mannequins (full body, head and legs), static
 * pictures in backend/assets/tryon/ (TRYON_ASSETS_DIR overrides), read when first needed.
 */
const MANNEQUIN_FILES: Record<Mannequin, string> = {
  male: 'mannequin-male.jpg',
  female: 'mannequin-female.jpg',
};
const MIMES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export async function loadMannequin(which: Mannequin): Promise<{ bytes: Buffer; mime: string }> {
  const dirs = process.env.TRYON_ASSETS_DIR
    ? [process.env.TRYON_ASSETS_DIR]
    : [join(process.cwd(), 'assets', 'tryon'), join(process.cwd(), 'backend', 'assets', 'tryon')];
  const stem = MANNEQUIN_FILES[which].replace(/.jpg$/, '');
  for (const dir of dirs)
    for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
      try {
        return { bytes: await readFile(join(dir, `${stem}.${ext}`)), mime: MIMES[ext]! };
      } catch {
        // not this one
      }
    }
  // An explicit pictures folder that lacks them is an error; the Space's examples are only the default.
  if (process.env.TRYON_ASSETS_DIR)
    throw new AppError(
      503,
      'MANNEQUIN_MISSING',
      'The mannequin pictures are not installed on the server yet (backend/assets/tryon)',
    );
  return spaceExample(which);
}

/**
 * Until the store mannequins are installed: the try-on Space's own example people (a woman and a
 * man, full length), read from its /config, fetched once and kept in memory. They are only the
 * picture the garment is put on, never shown or stored as a photo of anyone.
 */
const EXAMPLE_PEOPLE: Record<Mannequin, string> = { male: 'sam1 1.jpg', female: '00121_00.jpg' };
const examples = new Map<Mannequin, Promise<{ bytes: Buffer; mime: string }>>();

async function fetchExample(which: Mannequin): Promise<{ bytes: Buffer; mime: string }> {
  const origin = `https://${TRYON_SPACE.replace('/', '-').replace(/_/g, '-').toLowerCase()}.hf.space`;
  const config = (await (await fetch(`${origin}/config`)).json()) as {
    components?: { type: string; props?: { components?: string[]; samples?: unknown[][] } }[];
  };
  const wanted = EXAMPLE_PEOPLE[which];
  for (const component of config.components ?? []) {
    if (component.type !== 'dataset' || component.props?.components?.[0] !== 'imageeditor') continue;
    for (const sample of component.props.samples ?? []) {
      const background = (sample[0] as { background?: { url?: string } } | undefined)?.background;
      if (!background?.url || decodeURIComponent(background.url.split('/').pop() ?? '') !== wanted) continue;
      const bytes = await fetchSpaceFile(background.url, null);
      return { bytes, mime: 'image/jpeg' };
    }
  }
  throw new Error('example person not found');
}

function spaceExample(which: Mannequin): Promise<{ bytes: Buffer; mime: string }> {
  let found = examples.get(which);
  if (!found) {
    found = fetchExample(which).catch(() => {
      examples.delete(which); // try again next time
      throw new AppError(
        503,
        'MANNEQUIN_MISSING',
        'The try-on could not get a person picture: the mannequins are not installed and the try-on service did not answer',
      );
    });
    examples.set(which, found);
  }
  return found;
}

/** Every household person and the mannequin they picked (null: not yet). */
export async function listMannequins(ctx: FoodCtx) {
  const { rows } = await ctx.db.query<{ id: string; closet_mannequin: Mannequin | null }>(
    'SELECT id, closet_mannequin FROM users WHERE household_id = $1 AND is_active',
    [ctx.actor.householdId],
  );
  return { mannequins: rows.map((r) => ({ userId: r.id, mannequin: r.closet_mannequin })) };
}

export async function setMannequin(ctx: FoodCtx, userId: string, mannequin: Mannequin | null) {
  const { rowCount } = await ctx.db.query(
    'UPDATE users SET closet_mannequin = $3 WHERE id = $1 AND household_id = $2 AND is_active',
    [isUuid(userId) ? userId : '00000000-0000-0000-0000-000000000000', ctx.actor.householdId, mannequin],
  );
  if (!rowCount) throw new AppError(404, 'NOT_FOUND', 'That person isn’t in your household');
  return { userId, mannequin };
}

// ------------------------------------------------------------------ the job

/** Pieces being dressed now (or waiting their turn), so a second tap doesn't start a second one. */
const active = new Set<string>();
/** One try-on at a time for the whole server: the Space's free quota is small and shared. */
const gate = createGate();
const oneAtATime = gate.run;

async function setStatus(deps: AppDeps, itemId: string, status: string) {
  await deps.db.query('UPDATE closet_items SET tryon_status = $2 WHERE id = $1', [itemId, status]);
}

interface Job {
  deps: AppDeps;
  actor: Actor;
  itemId: string;
  person: { bytes: Buffer; mime: string };
  garment: { bytes: Buffer; mime: string };
  description: string;
  /** 'ghost': the worn garment alone becomes the cut-out of `photoId`; else the picture is a try-on photo. */
  ghost?: { photoId: string; parts: Part[] };
}

type ParsingConnect = (token: string | null) => Promise<SpaceClient>;
const realParsing: ParsingConnect = (token) => connectSpace(PARSING_SPACE, token);
let connectParsing: ParsingConnect = realParsing;
/** Tests swap the clothes-parsing Space for a fake; call with nothing to put the real one back. */
export function setParsingClient(next?: ParsingConnect) {
  connectParsing = next ?? realParsing;
}

/** The ghost-mannequin step: the worn garment cut out of the try-on picture, as a PNG data URL. */
async function ghostImage(url: string, token: string | null, parts: Part[], signal: AbortSignal): Promise<string> {
  const worn = await fetchSpaceFile(url, token);
  const parsing = await connectParsing(token);
  const data = await parsing.predict(
    PARSING_ENDPOINT,
    { img: new Blob([new Uint8Array(worn)], { type: 'image/webp' }) },
    signal,
  );
  const mapUrl = fileUrl(data[0]);
  if (!mapUrl) throw new Error('no clothes map');
  const png = await ghostPng(worn, await fetchSpaceFile(mapUrl, token), parts);
  if (!png) throw new Error('no clothes found in the try-on picture');
  return `data:image/png;base64,${png.toString('base64')}`;
}

async function download(url: string, token: string | null): Promise<string> {
  const response = await fetch(url, token ? { headers: { authorization: `Bearer ${token}` } } : {});
  if (!response.ok) throw new Error(`result ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const mime = response.headers.get('content-type')?.split(';')[0] ?? 'image/webp';
  return `data:${mime.startsWith('image/') ? mime : 'image/webp'};base64,${bytes.toString('base64')}`;
}

/** The part of an unrecognised error worth showing: one short line, no URLs or tokens. */
export function errorDetail(error: unknown): string {
  return textOf(error)
    .replace(/https?:\/\/\S+/g, '')
    .replace(/hf_[A-Za-z0-9]+/g, '')
    .replace(/[\r\n[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
}

/** The queue's unit of work: call the Space, store the picture, set the status, tell the apps. */
async function execute(job: Job): Promise<void> {
  const { deps, actor, itemId } = job;
  const token = deps.config.hf.token;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRYON_TIMEOUT_MS);
  try {
    const client = await connect(token);
    const payload = tryonPayload(
      new Blob([new Uint8Array(job.person.bytes)], { type: job.person.mime }),
      new Blob([new Uint8Array(job.garment.bytes)], { type: job.garment.mime }),
      job.description,
    );
    const aborted = new Promise<never>((_, reject) =>
      controller.signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true }),
    );
    const data = await Promise.race([client.predict(TRYON_ENDPOINT, payload, controller.signal), aborted]);
    const url = resultUrl(data);
    if (!url) throw new Error('no result picture');
    if (job.ghost) {
      const image = await ghostImage(url, token, job.ghost.parts, controller.signal);
      // The ghost takes the photo's place as its cut-out; the original stays (superseded).
      await addPhoto(foodCtx(deps, actor), itemId, { image, replaces: job.ghost.photoId } as PhotoInput);
    } else {
      const image = await download(url, token);
      // The gallery shows try-ons after the cut-outs and before the originals (the app orders them).
      await storePhoto(foodCtx(deps, actor), { itemId }, image, { kind: 'tryon', needsCutout: false });
    }
    await setStatus(deps, itemId, '');
  } catch (error) {
    const message = tryonErrorMessage(error);
    if (message === TRYON_MESSAGES.failed) console.error('[closet] try-on failed:', textOf(error).slice(0, 200));
    // An error nobody mapped keeps its own words after the friendly line: "failed: <reason> [<cause>]".
    const detail = message === TRYON_MESSAGES.failed ? errorDetail(error) : '';
    await setStatus(deps, itemId, `failed: ${message}${detail ? ` [${detail}]` : ''}`).catch(() => undefined);
  } finally {
    clearTimeout(timer);
    active.delete(itemId);
    publishChange(deps, {
      area: 'closet',
      path: `/api/closet/items/${itemId}/tryon`,
      userId: actor.userId,
      householdId: actor.householdId,
    });
  }
}

/** Marks every try-on that was running when the server stopped as failed (called at start). */
export async function resetTryons(deps: Pick<AppDeps, 'db'>) {
  await deps.db.query(`UPDATE closet_items SET tryon_status = $1 WHERE tryon_status IN ('running', 'ghost')`, [
    `failed: ${TRYON_MESSAGES.failed}`,
  ]);
}

/**
 * Starts a try-on of a piece on a mannequin and returns at once. The mannequin is the one asked
 * for, else the owner's saved choice; the first pick is remembered for the owner.
 */
export async function startTryon(
  deps: AppDeps,
  ctx: FoodCtx,
  itemId: string,
  options: { photoId?: string; mannequin?: Mannequin } = {},
  ghost = false,
) {
  const { photoId } = options;
  const item = await findItem(ctx, itemId);
  if (active.has(item.id))
    throw new AppError(409, 'CONFLICT', 'A try-on of this piece is already running');
  const parts = ghost ? partsFor(item.category) : null;
  if (ghost && !parts)
    throw new AppError(400, 'NOT_WORN', 'The 3D effect is for clothes worn on the body: tops, bottoms, dresses and coats');
  const saved = (
    await ctx.db.query<{ closet_mannequin: Mannequin | null }>(
      'SELECT closet_mannequin FROM users WHERE id = $1',
      [item.ownerId],
    )
  ).rows[0]?.closet_mannequin;
  // The ghost needs a body to drape the garment on, not a choice: the saved one, else a woman.
  const which = options.mannequin ?? saved ?? (ghost ? 'female' : undefined);
  if (!which)
    throw new AppError(400, 'NO_MANNEQUIN', 'Pick a mannequin first: male or female', {
      fields: { mannequin: 'Missing' },
    });
  const model = await loadMannequin(which);
  if (!saved && !ghost) await setMannequin(ctx, item.ownerId, which);
  const wanted = photoId ?? item.cover?.id;
  if (!wanted || !isUuid(wanted))
    throw new AppError(400, 'VALIDATION', 'Add a photo of the piece first', {
      fields: { photoId: 'Missing' },
    });
  const photo = await ctx.db.query<{ mime: string; full: Buffer; kind: string }>(
    `SELECT mime, "full", kind FROM closet_photos WHERE id = $1 AND item_id = $2 AND household_id = $3`,
    [wanted, item.id, ctx.actor.householdId],
  );
  const garment = photo.rows[0];
  if (!garment || garment.kind === 'label' || garment.kind === 'tryon')
    throw new AppError(404, 'NOT_FOUND', 'No such photo of this piece');
  const flat = await flattenOnWhite(garment.full, garment.mime);
  const status = ghost ? 'ghost' : 'running';
  await setStatus(deps, item.id, status);
  active.add(item.id);
  const job: Job = {
    deps,
    actor: ctx.actor,
    itemId: item.id,
    person: model,
    garment: flat,
    description: garmentDescription(item),
    ...(ghost && parts ? { ghost: { photoId: wanted, parts } } : {}),
  };
  void oneAtATime(() => execute(job));
  return { status, itemId: item.id };
}

/** "3D effect": a try-on whose result is cut down to the garment alone and replaces the photo's cut-out. */
export const startGhost = (
  deps: AppDeps,
  ctx: FoodCtx,
  itemId: string,
  options: { photoId?: string; mannequin?: Mannequin } = {},
) => startTryon(deps, ctx, itemId, options, true);

/** For tests: resolves when no try-on is queued or running. */
export const tryonIdle = (): Promise<void> => gate.idle();
