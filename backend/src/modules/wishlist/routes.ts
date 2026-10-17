import { Hono, type Context } from 'hono';
import type { AppDeps, AppEnv } from '../../context';
import { readJson } from '../../lib/validation';
import { requireAuth } from '../../middleware/auth';
import { foodCtx, requireKitchen } from '../food/kitchen';
import {
  addWish,
  listWishes,
  removeWish,
  reorderWishes,
  updateWish,
  WishInput,
  WishOrder,
  WishPatch,
} from './wishlist';

/** /api/wishlist — the priority buy list: what the household wants to buy, in order. */
export function wishlistRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  app.use('*', requireAuth(deps), requireKitchen(deps));
  const ctx = (c: Context<AppEnv>) => foodCtx(deps, c.get('actor'));

  app.get('/', async (c) => c.json(await listWishes(ctx(c))));
  app.post('/', async (c) => c.json(await addWish(ctx(c), await readJson(c, WishInput)), 201));
  app.put('/order', async (c) =>
    c.json(await reorderWishes(ctx(c), (await readJson(c, WishOrder)).ids)),
  );
  app.patch('/:id', async (c) =>
    c.json(await updateWish(ctx(c), c.req.param('id'), await readJson(c, WishPatch))),
  );
  app.delete('/:id', async (c) => {
    await removeWish(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });
  return app;
}
