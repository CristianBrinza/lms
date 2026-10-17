import { Hono } from 'hono';
import { z } from 'zod';
import type { AppDeps, AppEnv } from '../../context';
import { AppError } from '../../lib/errors';
import { Translations } from '../../lib/i18n';
import { readJson } from '../../lib/validation';
import { requireAuth, sessionOf } from '../../middleware/auth';
import { isUuid } from '../users';
import { reminderWords } from './i18n';
import {
  deleteReminder,
  deviceCount,
  listReminders,
  REMINDER_KINDS,
  saveReminder,
  sendToUser,
  subscribe,
  unsubscribe,
} from './service';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 18:30');
const ReminderBody = z.object({
  kind: z.enum(REMINDER_KINDS).optional(),
  time: time.nullable().optional(),
  minutesBefore: z.number().int().min(5).max(600).nullable().optional(),
  days: z.array(z.number().int().min(1).max(7)).min(1, 'Pick at least one day').max(7).optional(),
  text: z.string().trim().max(200).optional(),
  translations: Translations.optional(),
  enabled: z.boolean().optional(),
});
const SubscriptionBody = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** /api/me/reminders and /api/me/push: what to be reminded of, and the phones that get it. */
export function reminderRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  // Mounted beside /api/me: guard only its own paths (a key may still read /api/me itself).
  for (const path of ['/reminders', '/reminders/*', '/push', '/push/*']) {
    app.use(path, requireAuth(deps), async (c, next) => {
      sessionOf(c);
      await next();
    });
  }

  app.get('/reminders', async (c) => {
    const user = c.get('user');
    return c.json({
      reminders: await listReminders(deps, user.id),
      push: {
        available: Boolean(deps.push),
        publicKey: deps.push?.publicKey ?? null,
        devices: await deviceCount(deps, user.id),
      },
    });
  });
  app.post('/reminders', async (c) => {
    const body = await readJson(c, ReminderBody);
    if ((body.kind ?? 'custom') !== 'meal' && !body.time)
      throw new AppError(400, 'VALIDATION', 'Pick a time', { fields: { time: 'Pick a time' } });
    return c.json({ reminder: await saveReminder(deps, c.get('user').id, null, body) }, 201);
  });
  app.patch('/reminders/:id', async (c) => {
    const id = c.req.param('id');
    if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'Reminder not found');
    const { kind: _kind, ...body } = await readJson(c, ReminderBody);
    return c.json({ reminder: await saveReminder(deps, c.get('user').id, id, body) });
  });
  app.delete('/reminders/:id', async (c) => {
    const id = c.req.param('id');
    if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'Reminder not found');
    await deleteReminder(deps, c.get('user').id, id);
    return c.body(null, 204);
  });

  app.post('/push', async (c) => {
    if (!deps.push)
      throw new AppError(503, 'PUSH_OFF', 'Reminders aren’t set up on the server yet');
    const body = await readJson(c, SubscriptionBody);
    await subscribe(deps, c.get('user').id, {
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: c.req.header('user-agent') ?? '',
    });
    return c.json({ devices: await deviceCount(deps, c.get('user').id) }, 201);
  });
  app.delete('/push', async (c) => {
    const body = await readJson(c, z.object({ endpoint: z.url().max(1000) }));
    await unsubscribe(deps, c.get('user').id, body.endpoint);
    return c.body(null, 204);
  });
  app.post('/push/test', async (c) => {
    const words = reminderWords(c.get('user').locale);
    const sent = await sendToUser(deps, c.get('user').id, {
      title: words.testTitle,
      body: words.testBody,
      url: '/settings/reminders',
      tag: 'test',
    });
    if (!sent) throw new AppError(409, 'NO_DEVICES', 'No phone has reminders turned on yet');
    return c.json({ sent });
  });

  return app;
}
