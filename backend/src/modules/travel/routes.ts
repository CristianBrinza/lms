import { Hono, type Context } from 'hono';
import type { AppDeps, AppEnv } from '../../context';
import { requestLocale } from '../../lib/i18n';
import { readJson, readQuery } from '../../lib/validation';
import { requireAuth } from '../../middleware/auth';
import { foodCtx, requireKitchen } from '../food/kitchen';
import { kitchenPeople } from '../food/restrictions';
import { dateField } from '../food/schemas';
import { localDate } from '../food/stock';
import { z } from 'zod';
import {
  BAG_KINDS,
  CONNECTORS,
  GEAR_KINDS,
  GROUPS,
  KINDS,
  QUANTITIES,
  SCOPES,
  TRANSPORTS,
} from './catalog';
import {
  BagInput,
  BagPatch,
  GearInput,
  GearPatch,
  CheckInput,
  CheckPatch,
  ItemInput,
  ItemPatch,
  TripInput,
  TripPatch,
} from './schemas';
import {
  addBag,
  addGear,
  listGear,
  removeGear,
  updateGear,
  addCheck,
  addItem,
  createTrip,
  getTrip,
  listBags,
  listItems,
  listTrips,
  removeBag,
  removeCheck,
  removeItem,
  removeTrip,
  shopForTrip,
  updateBag,
  updateCheck,
  updateItem,
  updateTrip,
} from './travel';

/**
 * /api/travel — the household's trips, bags and packing list. Everyone in the household sees and
 * ticks the same trips.
 */
export function travelRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  app.use('*', requireAuth(deps), requireKitchen(deps));
  const ctx = (c: Context<AppEnv>) => foodCtx(deps, c.get('actor'));

  app.get('/', async (c) => {
    const query = readQuery(c, z.object({ today: dateField.optional() }));
    const today = query.today ?? localDate(deps.now());
    const [trips, bags, gear, items, people] = await Promise.all([
      listTrips(ctx(c), today),
      listBags(ctx(c)),
      listGear(ctx(c)),
      listItems(ctx(c)),
      kitchenPeople(ctx(c)),
    ]);
    return c.json({
      trips,
      bags,
      gear,
      items,
      people,
      options: {
        scopes: SCOPES,
        kinds: KINDS,
        transports: TRANSPORTS,
        bagKinds: BAG_KINDS,
        gearKinds: GEAR_KINDS,
        connectors: CONNECTORS,
        groups: GROUPS,
        quantities: QUANTITIES,
      },
    });
  });

  app.post('/trips', async (c) =>
    c.json(await createTrip(ctx(c), await readJson(c, TripInput)), 201),
  );
  app.get('/trips/:id', async (c) => c.json(await getTrip(ctx(c), c.req.param('id'))));
  app.patch('/trips/:id', async (c) =>
    c.json(await updateTrip(ctx(c), c.req.param('id'), await readJson(c, TripPatch))),
  );
  app.delete('/trips/:id', async (c) => {
    await removeTrip(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });

  app.post('/trips/:id/checks', async (c) =>
    c.json(
      { check: await addCheck(ctx(c), c.req.param('id'), await readJson(c, CheckInput)) },
      201,
    ),
  );
  app.patch('/trips/:id/checks/:checkId', async (c) =>
    c.json({
      check: await updateCheck(
        ctx(c),
        c.req.param('id'),
        c.req.param('checkId'),
        await readJson(c, CheckPatch),
      ),
    }),
  );
  app.delete('/trips/:id/checks/:checkId', async (c) => {
    await removeCheck(ctx(c), c.req.param('id'), c.req.param('checkId'));
    return c.body(null, 204);
  });

  app.post('/trips/:id/shop', async (c) =>
    c.json(await shopForTrip(ctx(c), c.req.param('id'), requestLocale(c))),
  );

  app.post('/bags', async (c) =>
    c.json({ bag: await addBag(ctx(c), await readJson(c, BagInput)) }, 201),
  );
  app.patch('/bags/:id', async (c) =>
    c.json({ bag: await updateBag(ctx(c), c.req.param('id'), await readJson(c, BagPatch)) }),
  );
  app.delete('/bags/:id', async (c) => {
    await removeBag(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });

  app.post('/gear', async (c) =>
    c.json({ gear: await addGear(ctx(c), await readJson(c, GearInput)) }, 201),
  );
  app.patch('/gear/:id', async (c) =>
    c.json({ gear: await updateGear(ctx(c), c.req.param('id'), await readJson(c, GearPatch)) }),
  );
  app.delete('/gear/:id', async (c) => {
    await removeGear(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });

  app.post('/items', async (c) =>
    c.json({ item: await addItem(ctx(c), await readJson(c, ItemInput)) }, 201),
  );
  app.patch('/items/:id', async (c) =>
    c.json({ item: await updateItem(ctx(c), c.req.param('id'), await readJson(c, ItemPatch)) }),
  );
  app.delete('/items/:id', async (c) => {
    await removeItem(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });

  return app;
}
