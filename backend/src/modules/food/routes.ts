import { Hono, type Context } from 'hono';
import type { AppDeps, AppEnv } from '../../context';
import { AppError } from '../../lib/errors';
import { readJson } from '../../lib/validation';
import { requireAuth } from '../../middleware/auth';
import { foodCtx, requireKitchen } from './kitchen';
import { CATEGORIES, FOOD_ICONS, LOCATIONS, PRESETS, type Location } from './presets';
import { archiveProduct, createProduct, listProducts, updateProduct } from './products';
import {
  AddShoppingInput,
  AddStockInput,
  CheckoutInput,
  LotPatch,
  ProductInput,
  ProductPatch,
  ShoppingItemPatch,
  StoreInput,
  StorePatch,
  TripItemPatch,
  UseStockInput,
} from './schemas';
import { addShoppingItems, checkout, getTrip, listShopping, listTrips, removeShoppingItem, updateShoppingItem, updateTripItem } from './shopping';
import { addStock, kitchen, productDetail, removeLot, updateLot, useStock } from './stock';
import { createStore, deleteStore, listStores, updateStore } from './stores';

/** /api/food — the kitchen's products and stock (stores, lists, recipes and plan join in later phases). */
export function foodRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  app.use('*', requireAuth(deps), requireKitchen(deps));
  const ctx = (c: Context<AppEnv>) => foodCtx(deps, c.get('actor'));

  app.get('/presets', (c) => c.json({ presets: PRESETS, categories: CATEGORIES, icons: FOOD_ICONS, locations: LOCATIONS }));

  app.get('/products', async (c) => c.json({ products: await listProducts(ctx(c), c.req.query('q') ?? '') }));
  app.post('/products', async (c) => c.json({ product: await createProduct(ctx(c), await readJson(c, ProductInput)) }, 201));
  app.get('/products/:id', async (c) => c.json(await productDetail(ctx(c), c.req.param('id'))));
  app.patch('/products/:id', async (c) => c.json({ product: await updateProduct(ctx(c), c.req.param('id'), await readJson(c, ProductPatch)) }));
  app.delete('/products/:id', async (c) => {
    await archiveProduct(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });

  app.get('/kitchen', async (c) => {
    const location = c.req.query('location');
    if (location && !(LOCATIONS as readonly string[]).includes(location)) throw new AppError(400, 'VALIDATION', 'Unknown place');
    return c.json({ products: await kitchen(ctx(c), { location: location as Location | undefined }) });
  });
  app.post('/stock', async (c) => c.json(await addStock(ctx(c), await readJson(c, AddStockInput)), 201));
  app.post('/stock/use', async (c) => c.json({ result: await useStock(ctx(c), await readJson(c, UseStockInput)) }));
  app.patch('/lots/:id', async (c) => c.json({ lot: await updateLot(ctx(c), c.req.param('id'), await readJson(c, LotPatch)) }));
  app.delete('/lots/:id', async (c) => {
    await removeLot(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });

  app.get('/stores', async (c) => c.json({ stores: await listStores(ctx(c)) }));
  app.post('/stores', async (c) => c.json({ store: await createStore(ctx(c), await readJson(c, StoreInput)) }, 201));
  app.patch('/stores/:id', async (c) => c.json({ store: await updateStore(ctx(c), c.req.param('id'), await readJson(c, StorePatch)) }));
  app.delete('/stores/:id', async (c) => {
    await deleteStore(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });

  app.get('/shopping', async (c) => c.json({ items: await listShopping(ctx(c)), stores: await listStores(ctx(c)) }));
  app.post('/shopping/items', async (c) => c.json({ items: await addShoppingItems(ctx(c), (await readJson(c, AddShoppingInput)).items) }, 201));
  app.patch('/shopping/items/:id', async (c) => c.json({ item: await updateShoppingItem(ctx(c), c.req.param('id'), await readJson(c, ShoppingItemPatch)) }));
  app.delete('/shopping/items/:id', async (c) => {
    await removeShoppingItem(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });
  app.post('/shopping/checkout', async (c) => c.json(await checkout(ctx(c), await readJson(c, CheckoutInput)), 201));
  app.get('/shopping/trips', async (c) => c.json({ trips: await listTrips(ctx(c)) }));
  app.get('/shopping/trips/:id', async (c) => c.json(await getTrip(ctx(c), c.req.param('id'))));
  app.patch('/shopping/trips/:tripId/items/:id', async (c) =>
    c.json(await updateTripItem(ctx(c), c.req.param('tripId'), c.req.param('id'), await readJson(c, TripItemPatch))),
  );

  return app;
}
