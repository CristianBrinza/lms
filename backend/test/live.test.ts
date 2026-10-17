import { describe, expect, it } from 'vitest';
import { APP_URL, setupTestApp } from './helpers';

const t = setupTestApp();

interface Change {
  area: string;
  path: string;
  by: string;
  at: string;
}

/** Opens GET /api/events with a browser's cookies and reads `change` events off the stream. */
async function listen(jar: Map<string, string>) {
  const response = await t.app.request('/api/events', {
    headers: {
      origin: APP_URL,
      'sec-fetch-site': 'same-origin',
      cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; '),
    },
  });
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const pending: Change[] = [];

  /** The next change, or null when none comes within `ms`. */
  async function next(ms = 2_000): Promise<Change | null> {
    const deadline = Date.now() + ms;
    for (;;) {
      if (pending.length) return pending.shift()!;
      const left = deadline - Date.now();
      if (left <= 0) return null;
      let timer: NodeJS.Timeout | undefined;
      const chunk = await Promise.race([
        reader.read(),
        new Promise<null>((resolve) => (timer = setTimeout(() => resolve(null), left))),
      ]);
      clearTimeout(timer);
      if (!chunk) return null;
      if (chunk.done) throw new Error('stream ended');
      buffer += decoder.decode(chunk.value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const lines = frame.split('\n');
        if (!lines.includes('event: change')) continue;
        const data = lines.find((line) => line.startsWith('data: '))!.slice(6);
        pending.push(JSON.parse(data) as Change);
      }
    }
  }

  return { response, next, close: () => reader.cancel() };
}

/** Seats `user` in `other`'s household, as the admin's “share kitchen” does. */
async function shareKitchen(userId: string, withUserId: string) {
  await t.db.query(
    'UPDATE users SET household_id = (SELECT household_id FROM users WHERE id = $2) WHERE id = $1',
    [userId, withUserId],
  );
}

async function householdOf(userId: string): Promise<string | null> {
  const { rows } = await t.db.query<{ household_id: string | null }>(
    'SELECT household_id FROM users WHERE id = $1',
    [userId],
  );
  return rows[0]?.household_id ?? null;
}

describe('live sync', () => {
  it('streams a household member’s change to the others, and not to another household', async () => {
    const ana = await t.createUser({ email: 'ana@example.com', name: 'Ana' });
    const ion = await t.createUser({ email: 'ion@example.com', name: 'Ion' });
    const eva = await t.createUser({ email: 'eva@example.com', name: 'Eva' });
    const a = t.browser();
    const i = t.browser();
    const e = t.browser();
    await a.login('ana@example.com');
    await i.login('ion@example.com');
    await e.login('eva@example.com');
    // Ana's and Eva's kitchens; Ion joins Ana's.
    await a.get('/api/food/kitchen');
    await e.get('/api/food/kitchen');
    await shareKitchen(ion.id, ana.id);

    const ionHears = await listen(i.jar);
    const evaHears = await listen(e.jar);
    expect(ionHears.response.status).toBe(200);
    expect(ionHears.response.headers.get('content-type')).toMatch(/^text\/event-stream/);
    expect(ionHears.response.headers.get('cache-control')).toBe('no-cache, no-transform');
    expect(ionHears.response.headers.get('x-accel-buffering')).toBe('no');
    expect(t.deps.live.size).toBe(2);

    const added = await a.post('/api/food/stock', { name: 'Milk', quantity: 1000, unit: 'ml' });
    expect(added.status).toBe(201);

    const heard = await ionHears.next();
    expect(heard).toMatchObject({ area: 'food', path: '/api/food/stock', by: ana.id });
    expect(Date.parse(heard!.at)).not.toBeNaN();

    // Eva's household heard nothing: her own change is the first thing her stream carries.
    await e.post('/api/food/stock', { name: 'Eggs', quantity: 6 });
    expect(await evaHears.next()).toMatchObject({ area: 'food', by: eva.id });
    // And Ion didn't hear Eva's.
    expect(await ionHears.next(300)).toBeNull();

    await ionHears.close();
    await evaHears.close();
    await expect.poll(() => t.deps.live.size).toBe(0);
  });

  it('announces training to the household, reminders only to the person, profiles to everyone', async () => {
    const ana = await t.createUser({ email: 'ana@example.com', name: 'Ana' });
    const ion = await t.createUser({ email: 'ion@example.com', name: 'Ion' });
    await t.createUser({ email: 'eva@example.com', name: 'Eva' });
    const a = t.browser();
    const i = t.browser();
    const e = t.browser();
    await a.login('ana@example.com');
    await i.login('ion@example.com');
    await e.login('eva@example.com');
    await a.get('/api/food/kitchen');
    await shareKitchen(ion.id, ana.id);

    const anaElsewhere = t.browser();
    await anaElsewhere.login('ana@example.com');
    const anaHears = await listen(anaElsewhere.jar);
    const ionHears = await listen(i.jar);
    const evaHears = await listen(e.jar);

    const first = (await a.get('/api/me/reminders')).body.reminders[0];
    expect((await a.patch(`/api/me/reminders/${first.id}`, { enabled: false })).status).toBe(200);
    // Ana's other device hears it; Ion, in the same household, doesn't (his first is the profile).
    expect(await anaHears.next()).toMatchObject({ area: 'reminders', by: ana.id });

    t.deps.live.publish(
      { area: 'training', path: '/api/training/sets', by: ana.id, at: new Date().toISOString() },
      { userId: ana.id, householdId: (await householdOf(ana.id))! },
    );
    expect(await ionHears.next()).toMatchObject({ area: 'training', by: ana.id });
    expect(await anaHears.next()).toMatchObject({ area: 'training' });

    await a.patch('/api/me', { name: 'Anastasia' });
    expect(await anaHears.next()).toMatchObject({ area: 'people', path: '/api/me' });
    expect(await ionHears.next()).toMatchObject({ area: 'people', by: ana.id });
    expect(await evaHears.next()).toMatchObject({ area: 'people', by: ana.id });

    await anaHears.close();
    await ionHears.close();
    await evaHears.close();
  });

  it('announces what an access key changes, and keeps auth chatter quiet', async () => {
    const ana = await t.createUser({ email: 'ana@example.com', name: 'Ana' });
    const a = t.browser();
    await a.login('ana@example.com');
    await a.get('/api/food/kitchen');
    const hears = await listen(a.jar);

    // Signing in elsewhere and making a key change nothing the family sees.
    const other = t.browser();
    await other.login('ana@example.com');
    const key = (await a.post('/api/me/tokens', { name: 'Claude', scope: 'food' })).body.token;

    const viaKey = await t.app.request('/api/food/stock', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Bread', quantity: 1 }),
    });
    expect(viaKey.status).toBe(201);
    expect(await hears.next()).toMatchObject({ area: 'food', path: '/api/food/stock', by: ana.id });

    // A key can't open the stream: it has no screen to refresh.
    const keyStream = await t.app.request('/api/events', {
      headers: { authorization: `Bearer ${key}` },
    });
    expect(keyStream.status).toBe(403);
    await hears.close();
  });

  it('needs a session, and ends the stream when the session is revoked', async () => {
    expect((await t.app.request('/api/events')).status).toBe(401);

    await t.createUser({ email: 'ana@example.com', name: 'Ana' });
    const a = t.browser();
    await a.login('ana@example.com');
    const phone = t.browser();
    await phone.login('ana@example.com');
    const hears = await listen(phone.jar);
    expect(t.deps.live.size).toBe(1);

    // “Sign out other devices” from the first browser: the phone's stream closes at once.
    expect((await a.post('/api/me/sessions/sign-out-others')).status).toBeLessThan(400);
    await expect.poll(() => t.deps.live.size).toBe(0);
    await expect(hears.next(500)).rejects.toThrow('stream ended');
  });
});
