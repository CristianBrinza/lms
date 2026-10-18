import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { AppDeps, AppEnv } from '../../context';
import { AppError } from '../../lib/errors';
import { readJson, readQuery } from '../../lib/validation';
import { requireAuth } from '../../middleware/auth';
import { dateField } from '../food/schemas';
import { foodCtx, requireKitchen } from '../food/kitchen';
import {
  addItem,
  bulkUpdate,
  closetOverview,
  pageItems,
  markWashed,
  removeItem,
  setVectorRequest,
  updateItem,
} from './items';
import {
  addLook,
  cloneLook,
  listLooks,
  lookDetail,
  removeLook,
  setBackdropPhoto,
  updateLook,
} from './looks';
import { addPhoto, photoBytes, removePhoto, updatePhoto, vectorRequests } from './photos';
import { addPlace, listPlaces, removePlace, reorderPlaces, updatePlace } from './places';
import {
  BulkInput,
  MannequinInput,
  ExportQuery,
  ItemInput,
  ItemPatch,
  ListQuery,
  LookInput,
  LookPatch,
  PackedInput,
  PhotoInput,
  PhotoPatch,
  PlaceInput,
  PlacePatch,
  TripInput,
  TripItemsInput,
  TripPatch,
  TryonInput,
  WashedInput,
  WearInput,
  WearPatch,
  WearQuery,
} from './schemas';
import { closetStats, exportCloset, itemDetail } from './stats';
import {
  addTrip,
  addTripItems,
  backFromTrip,
  listTrips,
  removeTrip,
  removeTripItem,
  setPacked,
  tripDetail,
  updateTrip,
} from './trips';
import { listMannequins, setMannequin, startTryon } from './tryon';
import { addWear, listWears, logWorn, removeWear, updateWear } from './wears';

const OwnerQuery = z.object({ owner: z.string().trim().max(60).optional() });
const WornInput = z.object({
  wornOn: dateField.optional(),
  itemIds: z.array(z.uuid()).min(1).max(40).optional(),
});
const Order = z.object({ ids: z.array(z.uuid()).min(1).max(500) });
const BackdropInput = z.object({ image: PhotoInput.shape.image });

/**
 * /api/closet — each person's clothes in the household's home: pieces and their photos, where
 * they're kept, looks, the days they were worn, packing lists, the laundry and the numbers.
 */
export function closetRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  app.use('*', requireAuth(deps), requireKitchen(deps));
  const ctx = (c: Context<AppEnv>) => foodCtx(deps, c.get('actor'));
  const noContent = (c: Context<AppEnv>) => c.body(null, 204);

  app.get('/', async (c) => c.json(await closetOverview(ctx(c), readQuery(c, OwnerQuery).owner)));
  app.get('/stats', async (c) => c.json(await closetStats(ctx(c), readQuery(c, OwnerQuery).owner)));
  app.get('/export', async (c) => {
    const query = readQuery(c, ExportQuery);
    const format = query.format ?? 'json';
    const result = await exportCloset(ctx(c), query.owner, format);
    const day = ctx(c).now.toISOString().slice(0, 10);
    const name = `closet-${day}.${format}`;
    if (typeof result.csv === 'string')
      return c.body(result.csv, 200, {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${name}"`,
      });
    return c.body(JSON.stringify(result.json, null, 2), 200, {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${name}"`,
    });
  });

  // Pieces
  app.get('/items', async (c) => c.json(await pageItems(ctx(c), readQuery(c, ListQuery))));
  app.post('/items', async (c) => c.json(await addItem(ctx(c), await readJson(c, ItemInput)), 201));
  app.post('/items/bulk', async (c) => {
    const { ids, patch } = await readJson(c, BulkInput);
    return c.json(await bulkUpdate(ctx(c), ids, patch));
  });
  app.post('/items/worn', async (c) => {
    const input = await readJson(c, WornInput.extend({ itemIds: z.array(z.uuid()).min(1).max(40) }));
    return c.json(await logWorn(ctx(c), { itemIds: input.itemIds, wornOn: input.wornOn }), 201);
  });
  app.get('/items/:id', async (c) => c.json(await itemDetail(ctx(c), c.req.param('id'))));
  app.patch('/items/:id', async (c) =>
    c.json(await updateItem(ctx(c), c.req.param('id'), await readJson(c, ItemPatch))),
  );
  app.delete('/items/:id', async (c) => {
    await removeItem(ctx(c), c.req.param('id'));
    return noContent(c);
  });
  app.post('/items/:id/worn', async (c) => {
    const input = await readJson(c, WornInput);
    return c.json(await logWorn(ctx(c), { itemIds: [c.req.param('id')], wornOn: input.wornOn }), 201);
  });
  app.post('/items/:id/vector-request', async (c) =>
    c.json(await setVectorRequest(ctx(c), c.req.param('id'), true)),
  );
  app.delete('/items/:id/vector-request', async (c) =>
    c.json(await setVectorRequest(ctx(c), c.req.param('id'), false)),
  );
  app.get('/vector-requests', async (c) => c.json(await vectorRequests(ctx(c))));
  app.post('/items/:id/photos', async (c) =>
    c.json(await addPhoto(ctx(c), c.req.param('id'), await readJson(c, PhotoInput)), 201),
  );

  // Virtual try-on: dresses the piece on a store mannequin in the background (a minute or two).
  app.post('/items/:id/tryon', async (c) => {
    // The body is optional: { photoId } picks the garment photo.
    const body: unknown = await c.req.json().catch(() => ({}));
    const input = TryonInput.safeParse(body ?? {});
    if (!input.success)
      throw new AppError(400, 'VALIDATION', 'photoId must be a photo id', { fields: { photoId: 'Invalid' } });
    return c.json(await startTryon(deps, ctx(c), c.req.param('id'), input.data), 202);
  });

  // Mannequins: which store mannequin each person's try-ons dress.
  app.get('/mannequins', async (c) => c.json(await listMannequins(ctx(c))));
  app.put('/mannequins/:userId', async (c) =>
    c.json(await setMannequin(ctx(c), c.req.param('userId'), (await readJson(c, MannequinInput)).mannequin)),
  );

  // Photos: a photo's bytes never change (a new photo is a new id), cached for a year by ETag.
  app.get('/photos/:id/:size', async (c) => {
    const size = c.req.param('size');
    if (size !== 'full' && size !== 'thumb') throw new AppError(404, 'NOT_FOUND', 'No picture');
    const id = c.req.param('id');
    const etag = `"${id}-${size}"`;
    const headers = {
      'cache-control': 'private, max-age=31536000, immutable',
      etag,
      'x-content-type-options': 'nosniff',
    };
    const photo = await photoBytes(ctx(c), id, size);
    if (c.req.header('if-none-match') === etag) return c.body(null, 304, headers);
    return c.body(new Uint8Array(photo.data), 200, { ...headers, 'content-type': photo.mime });
  });
  app.patch('/photos/:id', async (c) =>
    c.json(await updatePhoto(ctx(c), c.req.param('id'), await readJson(c, PhotoPatch))),
  );
  app.delete('/photos/:id', async (c) => {
    await removePhoto(ctx(c), c.req.param('id'));
    return noContent(c);
  });

  // Places
  app.get('/places', async (c) => c.json({ places: await listPlaces(ctx(c)) }));
  app.post('/places', async (c) => c.json(await addPlace(ctx(c), await readJson(c, PlaceInput)), 201));
  app.put('/places/order', async (c) =>
    c.json(await reorderPlaces(ctx(c), (await readJson(c, Order)).ids)),
  );
  app.patch('/places/:id', async (c) =>
    c.json(await updatePlace(ctx(c), c.req.param('id'), await readJson(c, PlacePatch))),
  );
  app.delete('/places/:id', async (c) => {
    await removePlace(ctx(c), c.req.param('id'));
    return noContent(c);
  });

  // Looks
  app.get('/looks', async (c) => c.json(await listLooks(ctx(c), readQuery(c, OwnerQuery).owner)));
  app.post('/looks', async (c) => c.json(await addLook(ctx(c), await readJson(c, LookInput)), 201));
  app.get('/looks/:id', async (c) => c.json(await lookDetail(ctx(c), c.req.param('id'))));
  app.patch('/looks/:id', async (c) =>
    c.json(await updateLook(ctx(c), c.req.param('id'), await readJson(c, LookPatch))),
  );
  app.delete('/looks/:id', async (c) => {
    await removeLook(ctx(c), c.req.param('id'));
    return noContent(c);
  });
  app.post('/looks/:id/clone', async (c) => c.json(await cloneLook(ctx(c), c.req.param('id')), 201));
  app.post('/looks/:id/backdrop', async (c) =>
    c.json(
      await setBackdropPhoto(ctx(c), c.req.param('id'), (await readJson(c, BackdropInput)).image),
      201,
    ),
  );

  // The calendar
  app.get('/wears', async (c) => c.json(await listWears(ctx(c), readQuery(c, WearQuery))));
  app.post('/wears', async (c) => c.json(await addWear(ctx(c), await readJson(c, WearInput)), 201));
  app.patch('/wears/:id', async (c) =>
    c.json(await updateWear(ctx(c), c.req.param('id'), await readJson(c, WearPatch))),
  );
  app.delete('/wears/:id', async (c) => {
    await removeWear(ctx(c), c.req.param('id'));
    return noContent(c);
  });

  // The laundry
  app.post('/laundry/washed', async (c) => c.json(await markWashed(ctx(c), await readJson(c, WashedInput))));

  // Packing lists
  app.get('/trips', async (c) => c.json(await listTrips(ctx(c), readQuery(c, OwnerQuery).owner)));
  app.post('/trips', async (c) => c.json(await addTrip(ctx(c), await readJson(c, TripInput)), 201));
  app.get('/trips/:id', async (c) => c.json(await tripDetail(ctx(c), c.req.param('id'))));
  app.patch('/trips/:id', async (c) =>
    c.json(await updateTrip(ctx(c), c.req.param('id'), await readJson(c, TripPatch))),
  );
  app.delete('/trips/:id', async (c) => {
    await removeTrip(ctx(c), c.req.param('id'));
    return noContent(c);
  });
  app.post('/trips/:id/items', async (c) =>
    c.json(await addTripItems(ctx(c), c.req.param('id'), await readJson(c, TripItemsInput))),
  );
  app.put('/trips/:id/items/:itemId', async (c) =>
    c.json(
      await setPacked(ctx(c), c.req.param('id'), c.req.param('itemId'), (await readJson(c, PackedInput)).packed),
    ),
  );
  app.delete('/trips/:id/items/:itemId', async (c) =>
    c.json(await removeTripItem(ctx(c), c.req.param('id'), c.req.param('itemId'))),
  );
  app.post('/trips/:id/back', async (c) => c.json(await backFromTrip(ctx(c), c.req.param('id'))));

  return app;
}
