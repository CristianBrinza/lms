import { describe, expect, it } from 'vitest';
import { bmr, setKcal } from '../src/modules/training/energy';
import { setupTestApp } from './helpers';

const t = setupTestApp();
const byName = (list: any[], name: string) => list.find((e: any) => e.name === name);

describe('energy: the published formulas', () => {
  it('rests by Mifflin–St Jeor and trains by Compendium METs and the ACSM running equation', () => {
    expect(bmr({ weight: 65, heightCm: 168, age: 31, gender: 'female' })).toBe(1384);
    expect(bmr({ weight: 80, heightCm: 180, age: 35, gender: 'male' })).toBe(1755);
    expect(bmr({ weight: null, heightCm: 180, age: 35, gender: 'male' })).toBeNull();
    // 10 push-ups at 2.5 s each, MET 3.8, 70 kg: 3.8 × 70 × 25/3600 ≈ 1.85 kcal.
    const pushUps = {
      preset: 'push-up',
      category: 'strength' as const,
      measure: 'reps' as const,
      unilateral: false,
      reps: 10,
      seconds: null,
      distance: null,
      effort: null,
      side: null,
    };
    expect(setKcal(pushUps, 70)).toBeCloseTo(1.85, 1);
    // A hard set (effort 8+) counts the vigorous MET.
    expect(setKcal({ ...pushUps, effort: 9 }, 70)).toBeCloseTo((7.5 * 70 * 25) / 3600, 1);
    // 5 km in 30 min = 166.7 m/min: VO2 = 0.2·S + 3.5 → 10.5 MET → 10.5 × 70 × 0.5 ≈ 368 kcal.
    const run = {
      preset: 'run',
      category: 'cardio' as const,
      measure: 'distance' as const,
      unilateral: false,
      reps: null,
      seconds: 1800,
      distance: 5000,
      effort: null,
      side: null,
    };
    expect(setKcal(run, 70)).toBeGreaterThan(360);
    expect(setKcal(run, 70)).toBeLessThan(375);
  });
});

describe('energy: a day eaten and burned', () => {
  it('counts what she ate, what she burned, and sets a target from her goal', async () => {
    t.setNow(new Date('2026-10-04T20:00:00+03:00'));
    await t.createUser({ email: 'ana@example.com', name: 'Ana' });
    const b = t.browser();
    await b.login('ana@example.com');
    await b.patch('/api/me', {
      gender: 'female',
      birthDate: '1994-11-02',
      heightCm: 168,
      goal: 'lose',
      goalRate: 0.5,
      activity: 'light',
    });
    await b.post('/api/training/health', { source: 'manual', date: '2026-10-04', weight: 65 });

    // Breakfast from the kitchen, logged as eaten; the milk carries her own label values.
    await b.post('/api/food/stock', { name: 'Oats', quantity: 500, unit: 'g' });
    const milk = (await b.post('/api/food/stock', { name: 'Milk', quantity: 1000, unit: 'ml' }))
      .body.product;
    expect(milk.nutrition.source).toBe('catalog');
    const own = await b.patch(`/api/food/products/${milk.id}`, {
      nutrition: { per: '100ml', base: { kcal: 50, protein: 3, fat: 2.5, carbs: 4.7 } },
    });
    expect(own.body.product.nutrition).toMatchObject({
      source: 'own',
      entry: { base: { kcal: 50 } },
    });
    const ate = await b.post('/api/food/ate', {
      items: [
        { name: 'Oats', amount: 80, unit: 'g' },
        { name: 'Milk', amount: 200, unit: 'ml' },
      ],
      title: 'Porridge',
    });
    expect(ate.status).toBe(201);
    expect(ate.body.meal).toMatchObject({ status: 'done', eaters: [ate.body.meal.doneBy] });
    expect(ate.body.meal.nutrition.total.kcal).toBeGreaterThan(350);
    expect(
      (await b.get('/api/food/kitchen')).body.products.find((p: any) => p.name === 'Oats').total,
    ).toBe(420);

    // A run, logged here.
    const run = byName((await b.get('/api/training/exercises')).body.exercises, 'Run');
    await b.post('/api/training/sets', {
      exerciseId: run.id,
      distance: 5000,
      seconds: 1800,
      at: '2026-10-04T08:00:00+03:00',
    });

    const energy = (
      await b.get('/api/training/energy?from=2026-10-01&to=2026-10-04&today=2026-10-04')
    ).body.energy;
    expect(energy.person).toMatchObject({ weight: 65, bmr: 1384, assumedWeight: false });
    const today = energy.days.find((d: any) => d.day === '2026-10-04');
    expect(today.eaten.kcal).toBeGreaterThan(350);
    expect(today.burned).toMatchObject({ resting: 1384, source: 'estimate' });
    expect(today.burned.active).toBe(Math.round(1384 * 0.375));
    // Net running energy above rest: (10.5 − 1) × 65 × 0.5 ≈ 309.
    expect(today.burned.training).toBeGreaterThan(300);
    expect(today.balance).toBe(today.eaten.kcal - today.burned.total);
    // Losing 0.5 kg a week, never under what rest needs.
    expect(energy.target.kcal).toBeGreaterThanOrEqual(1384);
    expect(energy.target.protein).toBe(Math.round(65 * 1.6));

    // The phone's numbers replace the estimates.
    await b.post('/api/training/health', {
      date: '2026-10-04',
      activeEnergy: 650,
      restingEnergy: 1400,
    });
    const phone = (
      await b.get('/api/training/energy?from=2026-10-04&to=2026-10-04&today=2026-10-04')
    ).body.energy.days[0];
    expect(phone.burned).toMatchObject({ resting: 1400, active: 650, source: 'phone' });

    // Flat numbers for the Shortcut to write into Apple Health.
    const flat = (await b.get('/api/training/energy/today?today=2026-10-04')).body;
    expect(flat).toMatchObject({ date: '2026-10-04', eatenKcal: today.eaten.kcal });
  });

  it('gives a workout its kcal, planned or done', async () => {
    t.setNow(new Date('2026-10-04T08:00:00+03:00'));
    await t.createUser({ email: 'ion@example.com', name: 'Ion' });
    const b = t.browser();
    await b.login('ion@example.com');
    const ex = (await b.get('/api/training/exercises')).body.exercises;
    const w = (
      await b.post('/api/training/workouts', {
        date: '2026-10-04',
        items: [{ exerciseId: byName(ex, 'Burpees').id, sets: 3, reps: 10 }],
      })
    ).body.workout;
    const planned = (await b.get(`/api/training/workouts/${w.id}`)).body.workout;
    expect(planned).toMatchObject({ kcalSource: 'planned' });
    expect(planned.kcal).toBeGreaterThan(5);
    await b.post(`/api/training/workouts/${w.id}/sets`, {
      exerciseId: byName(ex, 'Burpees').id,
      reps: 10,
      itemIndex: 0,
      round: 1,
      setNumber: 1,
    });
    const done = (await b.post(`/api/training/workouts/${w.id}/finish`, { durationSeconds: 300 }))
      .body.workout;
    expect(done).toMatchObject({ kcalSource: 'done' });
    expect(done.kcal).toBeGreaterThan(5);
  });
});
