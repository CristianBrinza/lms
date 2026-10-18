import { describe, expect, it } from 'vitest';
import { runMedicationReminders } from '../src/modules/medication/notify';
import type { PushMessage, PushSender } from '../src/modules/reminders/push';
import { setupTestApp } from './helpers';

const sent: PushMessage[] = [];
const push: PushSender = {
  publicKey: 'test',
  async send(_target, message) {
    sent.push(message);
    return 'ok';
  },
};
const t = setupTestApp({}, { push });
const at = (h: number, m = 0) => new Date(2026, 9, 20, h, m);

async function setup() {
  sent.length = 0;
  const user = await t.createUser({ email: 'ana@example.com', name: 'Ana' });
  t.setNow(at(7, 0));
  const b = t.browser();
  await b.login('ana@example.com');
  await t.db.query(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at)
     VALUES (gen_random_uuid(), $1, 'https://push.example/1', 'k', 'a', 'test', now())`,
    [user.id],
  );
  const med = (await b.post('/api/medication/medicines', { name: 'Amoxicillin', strength: '500 mg' })).body.medicine;
  return { b, med };
}

describe('medication: reminders on the phone', () => {
  it('sends a dose at its time with Taken and Skip, once more after 10 minutes, then stops', async () => {
    const { b, med } = await setup();
    await b.post(`/api/medication/medicines/${med.id}/packages`, { quantity: 20, expiresOn: '2028-01-31' });
    await (
      await b.post('/api/medication/treatments', { medicineId: med.id, dose: 1, kind: 'times', times: ['08:00'], instructions: ['with_food'] })
    ).body.treatment;

    expect(await runMedicationReminders(t.deps, at(7, 59))).toBe(0);
    expect(await runMedicationReminders(t.deps, at(8, 0))).toBe(1);
    expect(sent[0]).toMatchObject({ title: 'Amoxicillin 500 mg', tag: expect.stringContaining('medication-dose-') });
    expect(sent[0]!.body).toContain('Ana');
    expect(sent[0]!.body).toContain('08:00');
    expect(sent[0]!.actions?.map((a) => a.action)).toEqual(['take', 'skip']);
    expect(sent[0]!.actions?.[0]!.post).toMatch(/^\/api\/medication\/doses\/[0-9a-f-]+\/take$/);

    // Not twice in the same minute window, and not before the ten minutes are up.
    expect(await runMedicationReminders(t.deps, at(8, 1))).toBe(0);
    expect(await runMedicationReminders(t.deps, at(8, 9))).toBe(0);
    expect(await runMedicationReminders(t.deps, at(8, 10))).toBe(1);
    expect(sent[1]!.body).toMatch(/Încă|Still/);
    expect(await runMedicationReminders(t.deps, at(8, 40))).toBe(0);
    expect(sent).toHaveLength(2);
  });

  it('does not remind once the dose is answered, and asks again when a snooze ends', async () => {
    const { b, med } = await setup();
    await b.post(`/api/medication/medicines/${med.id}/packages`, { quantity: 20, expiresOn: '2028-01-31' });
    await b.post('/api/medication/treatments', { medicineId: med.id, dose: 1, kind: 'times', times: ['08:00', '12:00'] });
    t.setNow(at(8, 0));
    await b.login('ana@example.com');
    const doses = (await b.get('/api/medication/today')).body.doses;
    await b.post(`/api/medication/doses/${doses[0].id}/take`, {});
    expect(await runMedicationReminders(t.deps, at(8, 0))).toBe(0);

    t.setNow(at(12, 0));
    await b.login('ana@example.com');
    expect(await runMedicationReminders(t.deps, at(12, 0))).toBe(1);
    await b.post(`/api/medication/doses/${doses[1].id}/snooze`, { minutes: 30 });
    expect(await runMedicationReminders(t.deps, at(12, 20))).toBe(0);
    expect(await runMedicationReminders(t.deps, at(12, 31))).toBe(1);
    // Two hours late it is a missed dose, not a reminder.
    expect(await runMedicationReminders(t.deps, at(14, 5))).toBe(0);
  });

  it('sends one expiry digest a day, each package told about each level once', async () => {
    const { b, med } = await setup();
    await b.post(`/api/medication/medicines/${med.id}/packages`, { quantity: 5, expiresOn: '2026-10-27' });
    await b.post(`/api/medication/medicines/${med.id}/packages`, { quantity: 5, expiresOn: '2027-12-31' });
    expect(await runMedicationReminders(t.deps, at(8, 59))).toBe(0);
    expect(await runMedicationReminders(t.deps, at(9, 0))).toBe(1);
    expect(sent[0]).toMatchObject({ tag: 'medication-expiry' });
    expect(sent[0]!.body).toContain('Amoxicillin 500 mg');
    expect(sent[0]!.body).toContain('7');
    // The same day, and the next day at the same level: nothing new to say.
    expect(await runMedicationReminders(t.deps, at(10, 0))).toBe(0);
    expect(await runMedicationReminders(t.deps, new Date(2026, 9, 21, 9, 0))).toBe(0);
    // A week later it is the day itself.
    expect(await runMedicationReminders(t.deps, new Date(2026, 9, 27, 9, 0))).toBe(1);
  });
});
