import { describe, expect, it } from 'vitest';
import type { PushMessage, PushSender } from '../src/modules/reminders/push';
import { runReminders } from '../src/modules/reminders/service';
import { setupTestApp } from './helpers';

const inbox: PushMessage[] = [];
const phone: PushSender = {
  publicKey: 'test-public-key',
  send: async (target, message) => {
    if (target.endpoint.includes('gone')) return 'gone';
    inbox.push(message);
    return 'ok';
  },
};
const t = setupTestApp({}, { push: phone });
const at = (time: string) => new Date(`2026-10-02T${time}:00`);

async function cook() {
  await t.createUser({ email: 'ana@example.com', name: 'Ana' });
  const b = t.browser();
  await b.login('ana@example.com');
  inbox.length = 0;
  return b;
}
const subscription = { endpoint: 'https://push.example.com/phone-1', keys: { p256dh: 'p256', auth: 'auth' } };

describe('reminders', () => {
  it('set up sensible defaults and say how to reach the phone', async () => {
    const b = await cook();
    const res = await b.get('/api/me/reminders');
    expect(res.body.push).toEqual({ available: true, publicKey: 'test-public-key', devices: 0 });
    expect(res.body.reminders.map((r: any) => [r.kind, r.time ?? r.minutesBefore, r.enabled])).toEqual([
      ['shopping', '18:30', true],
      ['prep', '21:00', true],
      ['expiring', '09:00', true],
      ['meal', 45, true],
      ['custom', '17:30', false],
    ]);
    expect((await b.post('/api/me/push', subscription)).body.devices).toBe(1);
    expect((await b.post('/api/me/push/test')).body.sent).toBe(1);
    expect(inbox[0]!.title).toMatch(/reminders are on/);
  });

  it('tell the evening before what tomorrow’s meals still need, and what to pack', async () => {
    t.setNow(at('12:00'));
    const b = await cook();
    await b.get('/api/me/reminders');
    await b.post('/api/me/push', subscription);
    const box = (await b.post('/api/food/recipes', { title: 'Chicken box', tags: ['to go'], ingredients: [{ name: 'Chicken breast', amount: 300, unit: 'g' }] })).body.recipe;
    await b.post('/api/food/meals', { date: '2026-10-03', slot: 'lunch', recipeId: box.id });

    expect(await runReminders(t.deps, at('18:00'))).toBe(0);
    expect(await runReminders(t.deps, at('18:31'))).toBe(1);
    expect(inbox.at(-1)).toMatchObject({ title: 'For tomorrow: 1 thing to buy', body: 'Chicken breast', url: '/food/shopping' });
    // Once a day.
    expect(await runReminders(t.deps, at('18:35'))).toBe(0);
    expect(await runReminders(t.deps, at('21:02'))).toBe(1);
    expect(inbox.at(-1)).toMatchObject({ title: 'Pack for tomorrow', body: 'Chicken box' });
  });

  it('say nothing when there is nothing to say, and nudge before a meal', async () => {
    t.setNow(at('08:00'));
    const b = await cook();
    const reminders = (await b.get('/api/me/reminders')).body.reminders;
    await b.post('/api/me/push', subscription);
    expect(await runReminders(t.deps, at('09:05'))).toBe(0);
    await b.post('/api/food/stock', { name: 'Milk', quantity: 1, unit: 'l', expiresOn: '2026-10-03' });
    await b.post('/api/food/meals', { date: '2026-10-02', time: '13:00', title: 'Soup' });
    expect(await runReminders(t.deps, at('12:16'))).toBe(1);
    expect(inbox.at(-1)).toMatchObject({ title: 'Soup at 13:00' });

    // The custom one, switched on, on weekdays only (2026-10-02 is a Friday).
    const custom = reminders.find((r: any) => r.kind === 'custom');
    await b.patch(`/api/me/reminders/${custom.id}`, { enabled: true, text: 'Linella on the way home', days: [5] });
    expect(await runReminders(t.deps, at('17:31'))).toBe(1);
    expect(inbox.at(-1)).toMatchObject({ body: 'Linella on the way home' });
  });

  it('forgets phones that are gone, and stays for people only', async () => {
    const b = await cook();
    await b.post('/api/me/push', { ...subscription, endpoint: 'https://push.example.com/gone' });
    await b.post('/api/me/push/test').catch(() => undefined);
    expect((await b.get('/api/me/reminders')).body.push.devices).toBe(0);
    const key = (await b.post('/api/me/tokens', { name: 'Claude', scope: 'food' })).body.token;
    const res = await t.app.request('/api/me/reminders', { headers: { authorization: `Bearer ${key}` } });
    expect(res.status).toBe(403);
  });
});
