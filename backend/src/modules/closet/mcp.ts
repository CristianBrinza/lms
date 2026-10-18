import { z } from 'zod';
import { AppError } from '../../lib/errors';
import { householdPeople } from '../drinks/drinks';
import type { Tool, ToolEnv } from '../mcp/tools';
import { addItem, listItems, updateItem, type Item } from './items';
import { addLook, listLooks } from './looks';
import { addPhoto, vectorRequests } from './photos';
import { startTryon } from './tryon';
import { addPlace, findByPath, listPlaces, pathText, placeTree, type Place } from './places';
import {
  CareInput,
  ItemInput,
  ItemPatch,
  ListQuery,
  MaterialPart,
  PhotoInput,
  PlaceInput,
  SIZE_SYSTEMS,
  STORAGES,
  TryonInput,
} from './schemas';
import { closetStats, itemDetail } from './stats';
import { logWorn, addWear } from './wears';

/**
 * The closet over MCP: Claude adds pieces from photos sent in a chat, reads care labels into the
 * care symbols, keeps where things are and logs what was worn. The same services as the app.
 */

type Def<S extends z.ZodType> = {
  name: string;
  title: string;
  description: string;
  access: 'read' | 'write';
  destructive?: boolean;
  input: S;
  run: (env: ToolEnv, args: z.infer<S>) => Promise<unknown>;
};
const tool = <S extends z.ZodType>(def: Def<S>): Tool => def as unknown as Tool;

/** A piece, briefly: what it is, whose, where, how it's doing. */
function brief(item: Item, places: Map<string, Place>) {
  return {
    id: item.id,
    name: item.name,
    owner: item.ownerName,
    ...(item.category ? { category: item.category } : {}),
    ...(item.subcategory ? { subcategory: item.subcategory } : {}),
    ...(item.colors.length ? { colors: item.colors } : {}),
    ...(item.brand ? { brand: item.brand } : {}),
    ...(item.size ? { size: item.size, sizeSystem: item.sizeSystem || undefined } : {}),
    status: item.status,
    ...(item.lentTo ? { lentTo: item.lentTo } : {}),
    ...(item.placeId ? { place: pathText(places, item.placeId) } : {}),
    ...(item.storage ? { storage: item.storage } : {}),
    ...(item.wears ? { wears: item.wears, lastWorn: item.lastWorn } : {}),
    ...(item.price !== null ? { price: `${item.price} ${item.currency}` } : {}),
    photos: item.photos,
    ...(item.needsCutout ? { needsCutout: true } : {}),
    ...(item.hasLabel ? { labelPhoto: true } : {}),
    ...(item.care ? { care: true } : {}),
    ...(item.needsDetails ? { needsDetails: true } : {}),
  };
}

async function tree(env: ToolEnv) {
  return placeTree(await listPlaces(env.ctx));
}

/** Someone named in the household ("Maria", "me", "all"), to what the services take. */
async function ownerFrom(env: ToolEnv, person: string | undefined): Promise<string | undefined> {
  if (!person) return undefined;
  const wanted = person.trim().toLowerCase();
  if (wanted === 'me' || wanted === 'all') return wanted;
  const people = await householdPeople(env.ctx);
  const found = people.find(
    (p) =>
      p.id === person ||
      p.name.toLowerCase() === wanted ||
      `${p.name} ${p.surname}`.toLowerCase() === wanted,
  );
  if (!found) throw new AppError(400, 'VALIDATION', `No one called ${person} at home`);
  return found.id;
}

/** A place from its id or its path in words; an error listing what exists when nothing fits. */
async function placeFrom(env: ToolEnv, placeId: string | null | undefined, place: string | undefined) {
  if (placeId !== undefined) return placeId;
  if (!place) return undefined;
  const places = await listPlaces(env.ctx);
  const found = findByPath(places, place);
  if (!found) {
    const tree = placeTree(places);
    const known = places.map((p) => pathText(tree, p.id)).slice(0, 40);
    throw new AppError(
      400,
      'VALIDATION',
      `No place called "${place}". Known places: ${known.join('; ') || 'none yet (closet_places create)'}`,
    );
  }
  return found.id;
}

const personField = z
  .string()
  .trim()
  .max(120)
  .optional()
  .describe('Whose closet: a household member’s name; default the key’s owner');
const placeField = z
  .string()
  .trim()
  .max(200)
  .optional()
  .describe('Where it is kept, as a path: "Bedroom > Wardrobe > Shelf 2 left" (or placeId)');

export const CLOSET_TOOLS: Tool[] = [
  tool({
    name: 'closet_list',
    title: 'Search the closet',
    description:
      'The pieces in a person’s closet (person: a name, "me" by default, "all" for the household): search words (name, brand, colour, kind, tags), and filters — category, status (clean, to_wash, at_cleaners, lent, wishlist, archived, sold, donated), color, season, placeId, needsDetails. Check here before closet_add_item so a known piece gets a photo or an update instead of a duplicate.',
    access: 'read',
    input: ListQuery.omit({ owner: true }).extend({ person: personField }),
    run: async (env, { person, ...query }) => {
      const owner = await ownerFrom(env, person);
      const items = await listItems(env.ctx, { ...query, owner });
      const places = await tree(env);
      return { count: items.length, items: items.slice(0, 80).map((i) => brief(i, places)) };
    },
  }),
  tool({
    name: 'closet_get',
    title: 'One piece, in full',
    description:
      'Everything about a piece (id from closet_list): every field, its care symbols, materials, where it is kept, its photos (kind, needsCutout), the days it was worn and the looks it is in.',
    access: 'read',
    input: z.object({ id: z.uuid() }),
    run: async (env, { id }) => {
      const detail = await itemDetail(env.ctx, id);
      const places = await tree(env);
      return {
        item: { ...brief(detail.item, places), ...detail.item, cover: undefined },
        photos: detail.photos.map((p) => ({ id: p.id, kind: p.kind, needsCutout: p.needsCutout, hasAlpha: p.hasAlpha })),
        worn: detail.worn.slice(0, 30),
        looks: detail.looks,
      };
    },
  }),
  tool({
    name: 'closet_add_item',
    title: 'Add a piece to a closet',
    description:
      'A new piece of clothing (or shoes, a bag, jewellery): name, category and subcategory, colours, and whatever is known — brand, size and size system, materials with %, price, store, bought on, seasons, occasions, fit, condition (+ issues), status, tags, notes. person: whose closet. place: where it is kept ("Bedroom > Wardrobe > Rail"). Then closet_add_photo with the photos (front first; the care label as kind "label"), and closet_set_care with what the label says. Never guess facts the photos don’t show.',
    access: 'write',
    input: ItemInput.omit({ ownerId: true }).extend({ person: personField, place: placeField }),
    run: async (env, { person, place, placeId, ...input }) => {
      const owner = await ownerFrom(env, person);
      const { item } = await addItem(env.ctx, {
        ...(input as z.infer<typeof ItemInput>),
        ...(owner && owner !== 'all' && owner !== 'me' ? { ownerId: owner } : {}),
        placeId: await placeFrom(env, placeId, place),
      });
      return brief(item, await tree(env));
    },
  }),
  tool({
    name: 'closet_update_item',
    title: 'Change a piece',
    description:
      'Changes the fields given on a piece (id from closet_list); the rest stay. status: clean, to_wash, at_cleaners, lent (with lentTo), wishlist, archived, sold, donated. place moves it.',
    access: 'write',
    input: z.object({ id: z.uuid(), place: placeField }).and(ItemPatch.or(z.object({}))),
    run: async (env, { id, place, ...patch }) => {
      const placeId = await placeFrom(env, (patch as { placeId?: string | null }).placeId, place);
      const body = { ...(patch as z.infer<typeof ItemPatch>), ...(placeId !== undefined ? { placeId } : {}) };
      if (!Object.keys(body).length) throw new AppError(400, 'VALIDATION', 'Nothing to change');
      return brief((await updateItem(env.ctx, id, body)).item, await tree(env));
    },
  }),
  tool({
    name: 'closet_vector_requests',
    title: 'Pieces waiting for a vector drawing',
    description:
      'Pieces someone asked Claude to draw as a vector (with logos and details): id, name, owner and the front/back photos (id and url) to draw from. Answer each with closet_add_photo: the SVG, vector true, replaces the front (then back) photo id.',
    access: 'read',
    input: z.object({}),
    run: async (env) => vectorRequests(env.ctx),
  }),
  tool({
    name: 'closet_add_photo',
    title: 'Add a photo to a piece',
    description:
      'A photo of a piece: image as a data URL or plain base64 (JPEG, PNG, WebP or HEIC, up to 12 MB; shrunk on the server). kind: front (default; the first is the cover), back, label (the care label: kept with the piece, read it into closet_set_care), detail. To give a piece a vector drawing (see closet_vector_requests), send the SVG as image (data:image/svg+xml;base64,…, up to 2 MB, no scripts, handlers or external links), vector true, and replaces the photo id it is drawn from; it is rasterized to a transparent PNG. Front and back photos from a chat keep their background: they are marked needsCutout, and the app removes the background in the browser with one tap.',
    access: 'write',
    input: z.object({ itemId: z.uuid() }).and(PhotoInput),
    run: async (env, { itemId, ...input }) => {
      const { photo } = await addPhoto(env.ctx, itemId, input);
      return {
        id: photo.id,
        kind: photo.kind,
        width: photo.width,
        height: photo.height,
        bytes: photo.bytes,
        needsCutout: photo.needsCutout,
      };
    },
  }),
  tool({
    name: 'closet_set_care',
    title: 'Care label and fabric',
    description:
      'What a care label says, for a piece: care symbols (wash method and °C with gentle bars, bleach, tumble dry, natural drying, iron temperature, steam, professional cleaning), materials with %, size and size system, brand, made in (ISO code), storage advice from the materials (wool and cashmere folded in breathable bins with moth protection; silk on a padded hanger; leather never folded, wide padded hanger, no plastic, conditioned every ~6 months; down hung, never vacuum-compressed, fully dry first), and the rest of the label as labelText.',
    access: 'write',
    input: z.object({
      id: z.uuid(),
      care: CareInput.nullable().optional(),
      materials: z.array(MaterialPart).max(8).optional(),
      size: z.string().trim().max(20).optional(),
      sizeSystem: z.enum(SIZE_SYSTEMS).or(z.literal('')).optional(),
      brand: z.string().trim().max(80).optional(),
      madeIn: z.string().trim().max(2).optional().describe('ISO country code: CN, BD, TR, IT…'),
      storageAdvice: z.string().trim().max(1000).optional(),
      labelText: z.string().trim().max(4000).optional(),
    }),
    run: async (env, { id, ...fields }) => {
      const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
      if (!Object.keys(patch).length) throw new AppError(400, 'VALIDATION', 'Nothing to change');
      const parsed = ItemPatch.parse(patch);
      const { item } = await updateItem(env.ctx, id, parsed);
      return { ...brief(item, await tree(env)), care: item.care, materials: item.materials, storageAdvice: item.storageAdvice };
    },
  }),
  tool({
    name: 'closet_places',
    title: 'Where clothes are kept',
    description:
      'The household’s places, as paths (Bedroom › Wardrobe › Shelf 2 (left)), with ids and how many pieces each holds. action "create" adds one: kind room, furniture (in a room), or inside furniture shelf (number 1 = the lowest), rail, drawer (1 = top), box, vacuum_bag (a vacuum-sealed bag, in a room, furniture, shelf or box), hook, section; side left/middle/right; parent as a path or parentId. Create the room, then the furniture, then its sections.',
    access: 'write',
    input: z.object({
      action: z.enum(['list', 'create']).optional().describe('list (default) or create'),
      kind: PlaceInput.shape.kind.optional(),
      name: z.string().trim().max(80).optional(),
      parent: z.string().trim().max(200).optional().describe('The place it goes in, as a path'),
      parentId: z.uuid().optional(),
      number: z.number().int().min(1).max(99).optional(),
      side: z.enum(['left', 'middle', 'right']).optional(),
    }),
    run: async (env, { action, kind, name, parent, parentId, number, side }) => {
      if (action === 'create') {
        if (!kind) throw new AppError(400, 'VALIDATION', 'Say what kind of place it is');
        const parentPlace = parentId ?? (await placeFrom(env, undefined, parent));
        await addPlace(env.ctx, {
          kind,
          name: name ?? '',
          parentId: parentPlace ?? null,
          number: number ?? null,
          side: side ?? '',
        });
      }
      const places = await listPlaces(env.ctx);
      const all = placeTree(places);
      return {
        places: places.map((p) => ({ id: p.id, kind: p.kind, path: pathText(all, p.id), pieces: p.items })),
      };
    },
  }),
  tool({
    name: 'closet_set_place',
    title: 'Put pieces somewhere',
    description:
      'Where pieces are kept now: placeId or place (a path like "Hallway closet" or "Bedroom > Wardrobe > Shelf 3"), and how (storage: folded, hanging, drawer, box, laundry, worn, lent, vacuum). placeId null takes them out of any place.',
    access: 'write',
    input: z.object({
      itemIds: z.array(z.uuid()).min(1).max(200),
      placeId: z.uuid().nullable().optional(),
      place: placeField,
      storage: z.enum(STORAGES).or(z.literal('')).optional(),
    }),
    run: async (env, { itemIds, placeId, place, storage }) => {
      const target = await placeFrom(env, placeId, place);
      const places = await tree(env);
      const out = [];
      for (const id of itemIds) {
        const { item } = await updateItem(env.ctx, id, {
          ...(target !== undefined ? { placeId: target } : {}),
          ...(storage !== undefined ? { storage } : {}),
        });
        out.push(brief(item, places));
      }
      return { items: out };
    },
  }),
  tool({
    name: 'closet_log_worn',
    title: 'Log what was worn',
    description:
      'Someone wore pieces (itemIds) or a look (lookId) on a day (wornOn, default today). Each piece counts once a day; wears add up to each piece’s cost per wear. planned: true puts a look on the calendar for a day without counting it as worn.',
    access: 'write',
    input: z.object({
      itemIds: z.array(z.uuid()).max(40).optional(),
      lookId: z.uuid().optional(),
      wornOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      planned: z.boolean().optional(),
      person: personField,
    }),
    run: async (env, { itemIds, lookId, wornOn, planned, person }) => {
      const owner = await ownerFrom(env, person);
      const ownerId = owner && owner !== 'me' && owner !== 'all' ? owner : undefined;
      if (lookId || planned) {
        const { wear } = await addWear(env.ctx, { lookId, itemIds, wornOn, planned, ownerId });
        return { wear };
      }
      if (!itemIds?.length) throw new AppError(400, 'VALIDATION', 'Pick a look or the pieces worn');
      const { wears, items } = await logWorn(env.ctx, { itemIds, wornOn, ownerId });
      return { wears, pieces: items.map((i) => ({ id: i.id, name: i.name, wears: i.wears, costPerWear: i.costPerWear })) };
    },
  }),
  tool({
    name: 'closet_looks',
    title: 'Looks',
    description:
      'A person’s saved looks (outfits), with their pieces. action "create" saves a new one from itemIds (laid out on the canvas automatically), with a name, seasons and occasions.',
    access: 'write',
    input: z.object({
      action: z.enum(['list', 'create']).optional(),
      person: personField,
      name: z.string().trim().max(120).optional(),
      itemIds: z.array(z.uuid()).max(40).optional(),
      seasons: ItemInput.shape.seasons,
      occasions: ItemInput.shape.occasions,
    }),
    run: async (env, { action, person, name, itemIds, seasons, occasions }) => {
      const owner = await ownerFrom(env, person);
      if (action === 'create') {
        if (!itemIds?.length) throw new AppError(400, 'VALIDATION', 'Pick the pieces of the look');
        const { look } = await addLook(env.ctx, {
          name,
          itemIds,
          seasons,
          occasions,
          ...(owner && owner !== 'me' && owner !== 'all' ? { ownerId: owner } : {}),
        });
        return { id: look.id, name: look.name, pieces: look.canvas.items.map((i) => i.label) };
      }
      const { looks } = await listLooks(env.ctx, owner);
      return {
        looks: looks.slice(0, 60).map((l) => ({
          id: l.id,
          name: l.name,
          pieces: l.canvas.items.map((i) => ({ id: i.itemId, name: i.label })),
          seasons: l.seasons,
          occasions: l.occasions,
          wears: l.wears,
        })),
      };
    },
  }),
  tool({
    name: 'closet_tryon',
    title: 'Try a piece on (AI)',
    description:
      'Starts a virtual try-on: dresses the piece (id from closet_list) on a store mannequin (male or female) with a free AI service. It runs in the background for one to two minutes (one at a time); the result arrives as a photo of kind "tryon" on the piece, and tryonStatus on the piece says "running" or "failed: …". mannequin: male or female (the owner’s saved choice by default; without either it asks). photoId picks the garment photo (default: the cover).',
    access: 'write',
    input: z.object({ id: z.uuid() }).extend(TryonInput.shape),
    run: async (env, { id, ...options }) => startTryon(env.deps, env.ctx, id, options),
  }),
  tool({
    name: 'closet_stats',
    title: 'The closet in numbers',
    description:
      'A person’s closet (or "all"): pieces, value, wears, never worn, colours, categories, material mix, most and least worn, best cost per wear (ids; names via closet_list).',
    access: 'read',
    input: z.object({ person: personField }),
    run: async (env, { person }) => closetStats(env.ctx, await ownerFrom(env, person)),
  }),
];
