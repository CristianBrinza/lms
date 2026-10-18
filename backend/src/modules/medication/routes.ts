import type { z } from 'zod';
import { Hono, type Context } from 'hono';
import type { AppDeps, AppEnv } from '../../context';
import { AppError } from '../../lib/errors';
import { readJson, readQuery } from '../../lib/validation';
import { requireAuth } from '../../middleware/auth';
import { foodCtx, requireKitchen } from '../food/kitchen';
import {
  addMedicine,
  addPackage,
  discardPackage,
  findPackage,
  removeMedicine,
  removePackage,
  updateMedicine,
  updatePackage,
} from './cabinet';
import {
  dayView,
  doctorExport,
  findDose,
  intake,
  skipDose,
  snoozeDose,
  takeAsNeeded,
  takeDose,
  undoDose,
} from './doses';
import { cabinet, medicineDetail, summary } from './overview';
import { addPhoto, photoBytes, removePhoto, updatePhoto } from './photos';
import {
  DayQuery,
  ListQuery,
  MedicineInput,
  MedicinePatch,
  PackageInput,
  PackagePatch,
  PhotoInput,
  PhotoPatch,
  RangeQuery,
  SkipInput,
  SnoozeInput,
  TakeInput,
  TreatmentInput,
  TreatmentPatch,
} from './schemas';
import {
  addToBuyList,
  addTreatment,
  findTreatment,
  listTreatments,
  removeTreatment,
  stopTreatment,
  updateTreatment,
} from './treatments';
import { localDate } from '../food/stock';

/** An empty body is fine for taking and skipping (a notification button posts none). */
async function optionalJson<T extends z.ZodType>(c: Context<AppEnv>, schema: T): Promise<z.infer<T>> {
  const text = await c.req.text();
  if (!text.trim()) return schema.parse({});
  return readJson(c, schema);
}

/**
 * /api/medication — the household's medicine cabinet (medicines, packages with their expiry and
 * photos), treatments, the doses taken and the history behind them.
 */
export function medicationRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  app.use('*', requireAuth(deps), requireKitchen(deps));
  const ctx = (c: Context<AppEnv>) => foodCtx(deps, c.get('actor'));

  // The cabinet, and the numbers for the home card.
  app.get('/', async (c) => c.json(await cabinet(ctx(c), readQuery(c, ListQuery))));
  app.get('/summary', async (c) => c.json(await summary(ctx(c))));

  // Today: the doses of a day, and the as-needed treatments.
  app.get('/today', async (c) => {
    const query = readQuery(c, DayQuery);
    return c.json(await dayView(ctx(c), query.date ?? localDate(ctx(c).now), query.person));
  });
  app.get('/history', async (c) => c.json(await intake(ctx(c), readQuery(c, RangeQuery))));
  app.get('/export', async (c) => c.json(await doctorExport(ctx(c), readQuery(c, DayQuery).person)));

  // Medicines.
  app.post('/medicines', async (c) =>
    c.json(await addMedicine(ctx(c), await readJson(c, MedicineInput)), 201),
  );
  app.get('/medicines/:id', async (c) => c.json(await medicineDetail(ctx(c), c.req.param('id'))));
  app.patch('/medicines/:id', async (c) =>
    c.json(await updateMedicine(ctx(c), c.req.param('id'), await readJson(c, MedicinePatch))),
  );
  app.delete('/medicines/:id', async (c) => {
    await removeMedicine(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });
  app.post('/medicines/:id/packages', async (c) =>
    c.json(await addPackage(ctx(c), c.req.param('id'), await readJson(c, PackageInput)), 201),
  );
  app.post('/medicines/:id/photos', async (c) =>
    c.json(await addPhoto(ctx(c), c.req.param('id'), await readJson(c, PhotoInput)), 201),
  );

  // Packages.
  app.get('/packages/:id', async (c) => c.json({ package: await findPackage(ctx(c), c.req.param('id')) }));
  app.patch('/packages/:id', async (c) =>
    c.json(await updatePackage(ctx(c), c.req.param('id'), await readJson(c, PackagePatch))),
  );
  app.post('/packages/:id/discard', async (c) => c.json(await discardPackage(ctx(c), c.req.param('id'))));
  app.delete('/packages/:id', async (c) => {
    await removePackage(ctx(c), c.req.param('id'));
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

  // Treatments.
  app.get('/treatments', async (c) => c.json({ treatments: await listTreatments(ctx(c)) }));
  app.post('/treatments', async (c) =>
    c.json(await addTreatment(ctx(c), await readJson(c, TreatmentInput)), 201),
  );
  app.get('/treatments/:id', async (c) =>
    c.json({ treatment: await findTreatment(ctx(c), c.req.param('id')) }),
  );
  app.patch('/treatments/:id', async (c) =>
    c.json(await updateTreatment(ctx(c), c.req.param('id'), await readJson(c, TreatmentPatch))),
  );
  app.post('/treatments/:id/stop', async (c) => c.json(await stopTreatment(ctx(c), c.req.param('id'))));
  app.delete('/treatments/:id', async (c) => {
    await removeTreatment(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });
  app.post('/treatments/:id/take', async (c) =>
    c.json(await takeAsNeeded(ctx(c), c.req.param('id'), await optionalJson(c, TakeInput)), 201),
  );
  // Only when asked: the priority buy list never gets a medicine on its own.
  app.post('/treatments/:id/buy', async (c) => c.json(await addToBuyList(ctx(c), c.req.param('id'))));

  // Doses.
  app.get('/doses/:id', async (c) => c.json({ dose: await findDose(ctx(c), c.req.param('id')) }));
  app.post('/doses/:id/take', async (c) =>
    c.json(await takeDose(ctx(c), c.req.param('id'), await optionalJson(c, TakeInput))),
  );
  app.post('/doses/:id/skip', async (c) =>
    c.json(await skipDose(ctx(c), c.req.param('id'), await optionalJson(c, SkipInput))),
  );
  app.post('/doses/:id/snooze', async (c) =>
    c.json(
      await snoozeDose(ctx(c), c.req.param('id'), (await optionalJson(c, SnoozeInput)).minutes ?? 10),
    ),
  );
  app.post('/doses/:id/undo', async (c) => c.json(await undoDose(ctx(c), c.req.param('id'))));
  return app;
}
