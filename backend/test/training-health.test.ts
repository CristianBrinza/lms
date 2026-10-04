import { describe, expect, it } from 'vitest';
import { looseNumber } from '../src/modules/training/health';
import { setupTestApp } from './helpers';

const t = setupTestApp();

describe('health data from the phone', () => {
  it('reads numbers the way phones write them', () => {
    expect(looseNumber('8 543', true)).toBe(8543);
    expect(looseNumber('8,543', true)).toBe(8543);
    expect(looseNumber('72,5', false)).toBe(72.5);
    expect(looseNumber('1.234,5', false)).toBe(1234.5);
    expect(looseNumber('6.5 h', false)).toBe(6.5);
    expect(looseNumber(61, true)).toBe(61);
    expect(looseNumber('', true)).toBeNull();
    expect(looseNumber('lots', true)).toBeNull();
  });

  it('takes a Shortcut’s flat day with a key, overwrites it as the day fills, and keeps workouts once', async () => {
    t.setNow(new Date('2026-10-04T21:00:00+03:00'));
    await t.createUser({ email: 'ana@example.com', name: 'Ana' });
    const b = t.browser();
    await b.login('ana@example.com');
    const { token } = (
      await b.post('/api/me/tokens', { name: 'Health sync (iPhone)', scope: 'food' })
    ).body;
    const phone = async (body: unknown) => {
      const res = await t.app.request('/api/training/health', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: res.status, body: (await res.json()) as any };
    };

    // Morning: a few steps. Evening: the same day, fuller — it replaces, not adds.
    expect((await phone({ date: '2026-10-04', steps: '2 100' })).body).toMatchObject({
      days: 1,
      values: 1,
    });
    const evening = await phone({
      date: '2026-10-04',
      steps: '9 870',
      sleepHours: '6,5',
      restingHeartRate: 58,
      weight: '78,4',
      distanceKm: '7,2',
    });
    expect(evening.status).toBe(200);
    // Past days in one go, and a run from the watch, sent twice.
    const run = {
      id: 'A1B2',
      type: 'Running',
      start: '2026-10-03T08:00:00+03:00',
      end: '2026-10-03T08:31:00+03:00',
      distanceKm: 5.2,
      energy: '410',
    };
    await phone({
      days: [
        { date: '2026-09-27', steps: 6000, sleepHours: 8, restingHeartRate: 62, weight: 79.2 },
        { date: '2026-09-28', steps: 6500, sleepHours: 7.5, restingHeartRate: 63 },
        { date: '2026-10-01', steps: 9000, sleepHours: 6, restingHeartRate: 58 },
        { date: '2026-10-02', steps: 11000, sleepHours: 6.2 },
        { date: '2026-10-03', steps: 10000, sleepHours: 5.9 },
      ],
      workouts: [run, { type: 'Yoga', start: '2026-10-02T19:00:00+03:00', durationMinutes: 30 }],
    });
    expect((await phone({ workouts: [run] })).body.workouts).toBe(1);

    const health = (await b.get('/api/training/health?from=2026-09-20&to=2026-10-04')).body.health;
    const today = health.days.find((d: any) => d.day === '2026-10-04');
    expect(today.values).toEqual({
      steps: 9870,
      sleep: 390,
      restingHeartRate: 58,
      weight: 78.4,
      distance: 7200,
    });
    expect(health.latest.weight).toEqual({ value: 78.4, day: '2026-10-04' });
    expect(health.week.steps.now).toBeGreaterThan(health.week.steps.before);
    expect(health.insights.map((i: any) => i.text).join(' | ')).toMatch(/Steps up/);
    expect(health.insights.map((i: any) => i.text).join(' | ')).toMatch(/Under 7 hours/);
    expect(health.insights.map((i: any) => i.text).join(' | ')).toMatch(/Weight −0\.8 kg/);
    expect(health.lastSync.apple).toBeTruthy();

    // The run counts as a Run set once; Yoga became the household's own exercise.
    const runs = (await b.get(`/api/training/sets?day=2026-10-03`)).body.sets;
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ exercise: 'Run', distance: 5200, seconds: 1860 });
    expect(runs[0].note).toContain('Apple Health');
    expect(
      (await b.get('/api/training/exercises')).body.exercises.some((e: any) => e.name === 'Yoga'),
    ).toBe(true);

    // Nonsense is refused; a read-only key can't send.
    expect((await phone({ steps: 999_999_999 })).status).toBe(400);
    expect((await phone({ date: '2026-12-01', steps: 10 })).status).toBe(400);
    const reader = (await b.post('/api/me/tokens', { name: 'r', scope: 'food:read' })).body.token;
    const res = await t.app.request('/api/training/health', {
      method: 'POST',
      headers: { authorization: `Bearer ${reader}`, 'content-type': 'application/json' },
      body: '{"steps":1}',
    });
    expect(res.status).toBe(403);
    // Typed in by hand from the app counts too (manual), the phone's value wins the day.
    expect(
      (await b.post('/api/training/health', { source: 'manual', date: '2026-10-04', weight: 80 }))
        .status,
    ).toBe(200);
    expect(
      (await b.get('/api/training/health?from=2026-10-04&to=2026-10-04')).body.health.days[0].values
        .weight,
    ).toBe(78.4);
  });
});
