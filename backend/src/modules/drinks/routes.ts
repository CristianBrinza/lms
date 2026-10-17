import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { AppDeps, AppEnv } from '../../context';
import { AppError } from '../../lib/errors';
import { readJson, readQuery } from '../../lib/validation';
import { requireAuth } from '../../middleware/auth';
import { foodCtx, requireKitchen } from '../food/kitchen';
import {
  addDrink,
  drinksOverview,
  listDrinks,
  removeDrink,
  setStock,
  updateDrink,
} from './drinks';
import { addPhoto, photoBytes, removePhoto, updatePhoto } from './photos';
import {
  DrinkInput,
  DrinkPatch,
  ListQuery,
  PhotoInput,
  PhotoPatch,
  StockInput,
  TastingInput,
  TastingPatch,
} from './schemas';
import { drinkDetail, drinkStats } from './stats';
import { addTasting, removeTasting, timeline, updateTasting } from './tastings';

const TimelineQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  before: z.string().optional(),
});

/** /api/drinks — the household's cellar, everyone's tastings, and the label photos. */
export function drinksRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  app.use('*', requireAuth(deps), requireKitchen(deps));
  const ctx = (c: Context<AppEnv>) => foodCtx(deps, c.get('actor'));

  // The fixed paths first: none of them is a drink's id.
  app.get('/', async (c) => c.json(await drinksOverview(ctx(c))));
  app.get('/search', async (c) =>
    c.json({ drinks: await listDrinks(ctx(c), readQuery(c, ListQuery)) }),
  );
  app.get('/stats', async (c) => c.json(await drinkStats(ctx(c))));
  app.get('/tastings', async (c) => c.json(await timeline(ctx(c), readQuery(c, TimelineQuery))));
  app.patch('/tastings/:id', async (c) =>
    c.json(await updateTasting(ctx(c), c.req.param('id'), await readJson(c, TastingPatch))),
  );
  app.delete('/tastings/:id', async (c) => {
    await removeTasting(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });

  // A photo's bytes never change (a new photo is a new id): cached for a year, by its ETag.
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
    return c.body(null, 204);
  });

  app.post('/', async (c) => c.json(await addDrink(ctx(c), await readJson(c, DrinkInput)), 201));
  app.get('/:id', async (c) => c.json(await drinkDetail(ctx(c), c.req.param('id'))));
  app.patch('/:id', async (c) =>
    c.json(await updateDrink(ctx(c), c.req.param('id'), await readJson(c, DrinkPatch))),
  );
  app.delete('/:id', async (c) => {
    await removeDrink(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });
  app.put('/:id/stock', async (c) =>
    c.json(await setStock(ctx(c), c.req.param('id'), await readJson(c, StockInput))),
  );
  app.post('/:id/tastings', async (c) =>
    c.json(await addTasting(ctx(c), c.req.param('id'), await readJson(c, TastingInput)), 201),
  );
  app.post('/:id/photos', async (c) =>
    c.json(await addPhoto(ctx(c), c.req.param('id'), await readJson(c, PhotoInput)), 201),
  );
  return app;
}
