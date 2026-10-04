import { describe, expect, it } from 'vitest';
import { setupTestApp } from './helpers';

const t = setupTestApp();

async function signIn(email = 'ana@example.com', name = 'Ana') {
  await t.createUser({ email, name });
  const b = t.browser();
  await b.login(email);
  return b;
}

const byName = (list: any[], name: string) => list.find((e: any) => e.name === name);

describe('training: the home gym', () => {
  it('knows what can be done at home from the equipment owned', async () => {
    const b = await signIn();
    let exercises = (await b.get('/api/training/exercises')).body.exercises;
    expect(exercises.length).toBeGreaterThan(60);
    expect(byName(exercises, 'Push-ups')).toMatchObject({ available: true, uses: [] });
    expect(byName(exercises, 'Pull-ups')).toMatchObject({ available: false, uses: null });
    expect(byName(exercises, 'Goblet squats').available).toBe(false);

    // A pull-up bar, a pair of 8 kg dumbbells and a single 12 kg one.
    await b.post('/api/training/equipment', { kind: 'pullup_bar' });
    const dumbbells = (
      await b.post('/api/training/equipment', {
        kind: 'dumbbells',
        weights: [8, 4, 8],
        pairs: true,
      })
    ).body.equipment;
    expect(dumbbells).toMatchObject({
      name: 'Dumbbells',
      weights: [4, 8],
      pairs: true,
      icon: 'dumbbells',
    });
    await b.post('/api/training/equipment', {
      kind: 'dumbbells',
      name: 'Heavy dumbbell',
      weights: [12],
      pairs: false,
    });

    exercises = (await b.get('/api/training/exercises')).body.exercises;
    expect(byName(exercises, 'Pull-ups')).toMatchObject({ available: true, uses: ['pullup_bar'] });
    expect(byName(exercises, 'Goblet squats')).toMatchObject({
      available: true,
      uses: ['dumbbells'],
      weights: [
        { kg: 4, pair: true },
        { kg: 8, pair: true },
        { kg: 12, pair: false },
      ],
    });
    // A bench press needs dumbbells and a bench together.
    expect(byName(exercises, 'Dumbbell bench press').available).toBe(false);

    // Lending the bar out: count 0 means not at home.
    const bar = (await b.get('/api/training/equipment')).body.equipment.find(
      (e: any) => e.kind === 'pullup_bar',
    );
    await b.patch(`/api/training/equipment/${bar.id}`, { count: 0 });
    expect(
      byName((await b.get('/api/training/exercises')).body.exercises, 'Pull-ups').available,
    ).toBe(false);
  });

  it('keeps own exercises, edits without losing fields, and hides rather than deletes', async () => {
    const b = await signIn();
    const own = (
      await b.post('/api/training/exercises', {
        name: 'Doorframe rows',
        category: 'strength',
        measure: 'reps',
        muscles: ['back'],
        reps: 12,
      })
    ).body.exercise;
    expect(own).toMatchObject({
      preset: null,
      muscles: ['back'],
      equipment: [],
      icon: 'squat',
      rest: 60,
    });
    const renamed = (await b.patch(`/api/training/exercises/${own.id}`, { name: 'Door rows' })).body
      .exercise;
    expect(renamed).toMatchObject({ name: 'Door rows', muscles: ['back'], reps: 12 });
    await b.patch(`/api/training/exercises/${own.id}`, { archived: true });
    expect(
      byName((await b.get('/api/training/exercises')).body.exercises, 'Door rows'),
    ).toBeUndefined();
    expect(
      byName((await b.get('/api/training/exercises?archived=true')).body.exercises, 'Door rows'),
    ).toMatchObject({ archived: true });
  });
});

describe('training: planning and doing a workout', () => {
  it('plans a sequence on a day, plays it set by set, and finishes it', async () => {
    t.setNow(new Date('2026-10-05T08:00:00+03:00'));
    const b = await signIn();
    const exercises = (await b.get('/api/training/exercises')).body.exercises;
    const pushUps = byName(exercises, 'Push-ups');
    const plank = byName(exercises, 'Plank');
    const lunges = byName(exercises, 'Lunges');

    const planned = (
      await b.post('/api/training/workouts', {
        date: '2026-10-05',
        time: '07:30',
        items: [
          { exerciseId: pushUps.id, sets: 3, reps: 10 },
          { exerciseId: plank.id, sets: 2 },
          { exerciseId: lunges.id, sets: 2, rest: 30 },
        ],
      })
    ).body.workout;
    expect(planned).toMatchObject({
      status: 'planned',
      title: 'Push-ups, Plank +1',
      setsPlanned: 3 + 2 + 2 * 2,
      setsDone: 0,
    });
    // The plan fills targets from the exercise where it left them open.
    expect(planned.items[1]).toMatchObject({ seconds: 45, rest: 45 });
    expect(planned.items[2]).toMatchObject({ reps: 10, rest: 30, exercise: { unilateral: true } });
    expect(planned.estimatedSeconds).toBeGreaterThan(300);

    // The calendar shows it.
    const week = (await b.get('/api/training/workouts?from=2026-10-05&to=2026-10-11')).body
      .workouts;
    expect(week.map((w: any) => w.id)).toEqual([planned.id]);

    // Logging the first set starts it.
    const first = await b.post(`/api/training/workouts/${planned.id}/sets`, {
      exerciseId: pushUps.id,
      reps: 10,
      itemIndex: 0,
      round: 1,
      setNumber: 1,
    });
    expect(first.status).toBe(201);
    expect(first.body.records).toEqual([]); // nothing to beat yet
    let workout = (await b.get(`/api/training/workouts/${planned.id}`)).body.workout;
    expect(workout).toMatchObject({ status: 'active', setsDone: 1 });
    expect(workout.startedAt).not.toBeNull();

    // A better set is a personal best.
    const second = await b.post(`/api/training/workouts/${planned.id}/sets`, {
      exerciseId: pushUps.id,
      reps: 12,
      itemIndex: 0,
      round: 1,
      setNumber: 2,
    });
    expect(second.body.records).toEqual(['reps']);
    await b.post(`/api/training/workouts/${planned.id}/sets`, {
      exerciseId: plank.id,
      seconds: 50,
      itemIndex: 1,
      round: 1,
      setNumber: 1,
    });

    // Finishing needs no more than the sets done; the time is the player's (pauses left out).
    t.setNow(new Date('2026-10-05T08:10:00+03:00'));
    workout = (
      await b.post(`/api/training/workouts/${planned.id}/finish`, {
        durationSeconds: 1200,
        feeling: 4,
      })
    ).body.workout;
    expect(workout).toMatchObject({
      status: 'done',
      durationSeconds: 1200,
      feeling: 4,
      setsDone: 3,
    });
    expect((await b.post(`/api/training/workouts/${planned.id}/finish`, {})).status).toBe(409);

    // Next time: last time's sets and a target to beat.
    const next = (
      await b.post('/api/training/workouts', {
        date: '2026-10-07',
        items: [{ exerciseId: pushUps.id, sets: 2, reps: 10 }],
      })
    ).body.workout;
    expect(next.items[0].last).toMatchObject({
      day: '2026-10-05',
      sets: [{ reps: 10 }, { reps: 12 }],
    });
    expect(next.items[0].suggest).toMatchObject({ reps: 11 });
  });

  it('skips, plans again, copies to another day, and refuses an empty finish', async () => {
    const b = await signIn();
    const squats = byName((await b.get('/api/training/exercises')).body.exercises, 'Squats');
    const w = (
      await b.post('/api/training/workouts', {
        date: '2026-10-06',
        items: [{ exerciseId: squats.id, sets: 3 }],
      })
    ).body.workout;
    expect((await b.post(`/api/training/workouts/${w.id}/finish`, {})).status).toBe(409);
    expect(
      (await b.patch(`/api/training/workouts/${w.id}`, { status: 'skipped' })).body.workout.status,
    ).toBe('skipped');
    expect(
      (await b.post(`/api/training/workouts/${w.id}/sets`, { exerciseId: squats.id, reps: 5 }))
        .status,
    ).toBe(409);
    expect(
      (await b.patch(`/api/training/workouts/${w.id}`, { status: 'planned' })).body.workout.status,
    ).toBe('planned');
    const copy = (await b.post(`/api/training/workouts/${w.id}/copy`, { date: '2026-10-08' })).body
      .workout;
    expect(copy).toMatchObject({ date: '2026-10-08', status: 'planned', title: 'Squats' });
    expect(copy.id).not.toBe(w.id);
  });

  it('saves routines and plans from them; circuits repeat only the main block', async () => {
    const b = await signIn();
    const ex = (await b.get('/api/training/exercises')).body.exercises;
    const routine = (
      await b.post('/api/training/routines', {
        name: 'Morning 10',
        rounds: 3,
        roundRest: 45,
        items: [
          { exerciseId: byName(ex, 'Arm circles').id, sets: 1, block: 'warmup' },
          { exerciseId: byName(ex, 'Squats').id, sets: 1, reps: 15 },
          { exerciseId: byName(ex, 'Push-ups').id, sets: 1, reps: 8 },
          { exerciseId: byName(ex, 'Child’s pose').id, sets: 1, block: 'cooldown' },
        ],
      })
    ).body.routine;
    expect(routine.exercises).toHaveLength(4);
    const w = (
      await b.post('/api/training/workouts', { date: '2026-10-06', routineId: routine.id })
    ).body.workout;
    expect(w).toMatchObject({
      title: 'Morning 10',
      rounds: 3,
      roundRest: 45,
      routineId: routine.id,
    });
    // Warm-up once + 2 exercises × 3 rounds + cool-down once.
    expect(w.setsPlanned).toBe(1 + 2 * 3 + 1);
  });
});

describe('training: a set in passing', () => {
  it('logs one push-up now, twenty squats sometime yesterday, and counts them', async () => {
    t.setNow(new Date('2026-10-05T19:00:00+03:00'));
    const b = await signIn();
    const ex = (await b.get('/api/training/exercises')).body.exercises;
    const pushUps = byName(ex, 'Push-ups');
    await b.put(`/api/training/exercises/${pushUps.id}/pin`, { pinned: true });

    const now = await b.post('/api/training/sets', { exerciseId: pushUps.id, reps: 1 });
    expect(now.body.set).toMatchObject({
      workoutId: null,
      reps: 1,
      day: '2026-10-05',
      timeKnown: true,
    });
    await b.post('/api/training/sets', { exerciseId: pushUps.id, reps: 15 });
    const yesterday = await b.post('/api/training/sets', {
      exerciseId: byName(ex, 'Squats').id,
      reps: 20,
      day: '2026-10-04',
    });
    expect(yesterday.body.set).toMatchObject({ day: '2026-10-04', timeKnown: false });
    expect((await b.post('/api/training/sets', { exerciseId: pushUps.id })).status).toBe(400);
    expect(
      (
        await b.post('/api/training/sets', {
          exerciseId: pushUps.id,
          reps: 5,
          at: '2026-10-06T10:00:00+03:00',
        })
      ).status,
    ).toBe(400);

    const overview = (await b.get('/api/training/overview?today=2026-10-05')).body;
    expect(overview.pins).toMatchObject([{ name: 'Push-ups', today: 16 }]);
    expect(overview.loggedToday.map((s: any) => s.reps)).toEqual([15, 1]);
    expect(overview.streak).toMatchObject({ current: 2, best: 2, weeks: 2 });

    // A mis-tap is removed.
    await b.delete(`/api/training/sets/${now.body.set.id}`);
    expect((await b.get('/api/training/overview?today=2026-10-05')).body.pins[0].today).toBe(15);

    const stats = (
      await b.get('/api/training/stats?from=2026-10-01&to=2026-10-07&today=2026-10-05')
    ).body.stats;
    expect(stats.totals).toMatchObject({ activeDays: 2, sets: 2, reps: 35 });
    expect(stats.muscles.chest).toBe(1);
    expect(stats.muscles.quads).toBe(1);
    expect(stats.top[0]).toMatchObject({ name: 'Push-ups' });

    const history = (await b.get(`/api/training/exercises/${pushUps.id}`)).body;
    expect(history.bests.reps).toMatchObject({ value: 15, day: '2026-10-05' });
    expect(history.exercise).toMatchObject({ pinned: true, available: true });
  });
});

describe('training: made up from what is at home', () => {
  it('builds a quiet workout of the length asked for, only with owned equipment', async () => {
    const b = await signIn();
    await b.post('/api/training/equipment', { kind: 'dumbbells', weights: [6, 10], pairs: true });
    for (const focus of ['full', 'upper', 'lower', 'core', 'cardio', 'mobility']) {
      const w = (await b.post('/api/training/generate', { minutes: 20, focus, quiet: true })).body
        .workout;
      expect(w.items.length).toBeGreaterThanOrEqual(2);
      expect(w.estimatedSeconds).toBeLessThanOrEqual(20 * 60 + 120);
      const all = (await b.get('/api/training/exercises')).body.exercises;
      for (const item of w.items) {
        const e = all.find((x: any) => x.id === item.exerciseId);
        expect(e.available).toBe(true);
        expect(e.impact).toBe('low');
        if (item.weight) expect([6, 10]).toContain(item.weight);
      }
      // It can be planned as it is.
      expect(
        (
          await b.post('/api/training/workouts', {
            date: '2026-10-09',
            title: w.title,
            items: w.items,
            rounds: w.rounds,
            roundRest: w.roundRest,
          })
        ).status,
      ).toBe(201);
    }
  });
});

describe('training: a household, each person their own', () => {
  it('plans for someone else in the household, never for another household', async () => {
    const ana = await signIn('ana@example.com', 'Ana');
    const ion = await signIn('ion@example.com', 'Ion');
    const bob = await signIn('bob@example.com', 'Bob');
    await ana.get('/api/training/people');
    await ion.get('/api/training/people');
    await bob.get('/api/training/people');
    const anaId = (await ana.get('/api/me')).body.user.id;
    const ionId = (await ion.get('/api/me')).body.user.id;
    // Ion joins Ana's household.
    const { rows } = await t.db.query<{ household_id: string }>(
      'SELECT household_id FROM users WHERE id = $1',
      [anaId],
    );
    await t.db.query('UPDATE users SET household_id = $2 WHERE id = $1', [
      ionId,
      rows[0]!.household_id,
    ]);

    expect(
      (await ana.get('/api/training/people')).body.people.map((p: any) => p.name).sort(),
    ).toEqual(['Ana', 'Ion']);
    const squats = byName((await ana.get('/api/training/exercises')).body.exercises, 'Squats');
    const forIon = (
      await ana.post('/api/training/workouts', {
        userId: ionId,
        date: '2026-10-06',
        items: [{ exerciseId: squats.id, sets: 2 }],
      })
    ).body.workout;
    expect(forIon).toMatchObject({ userId: ionId, person: 'Ion' });
    expect(
      (await ion.get('/api/training/workouts?from=2026-10-01&to=2026-10-31')).body.workouts,
    ).toHaveLength(1);
    expect(
      (await ana.get('/api/training/workouts?from=2026-10-01&to=2026-10-31')).body.workouts,
    ).toHaveLength(0);
    expect(
      (await ana.get('/api/training/workouts?from=2026-10-01&to=2026-10-31&everyone=true')).body
        .workouts,
    ).toHaveLength(1);

    // Bob, another household, reaches none of it.
    const bobId = (await bob.get('/api/me')).body.user.id;
    expect(
      (await ana.post('/api/training/workouts', { userId: bobId, date: '2026-10-06', items: [] }))
        .status,
    ).toBe(400);
    expect((await bob.get(`/api/training/workouts/${forIon.id}`)).status).toBe(404);
    expect(
      (
        await bob.post(`/api/training/workouts/${forIon.id}/sets`, {
          exerciseId: squats.id,
          reps: 3,
        })
      ).status,
    ).toBe(404);
    expect((await bob.post('/api/training/sets', { exerciseId: squats.id, reps: 3 })).status).toBe(
      400,
    );
    expect(
      (
        await bob.post('/api/training/workouts', {
          date: '2026-10-06',
          items: [{ exerciseId: squats.id, sets: 1 }],
        })
      ).status,
    ).toBe(400);
    expect(
      (await bob.get(`/api/training/stats?userId=${anaId}&from=2026-10-01&to=2026-10-31`)).status,
    ).toBe(400);
    const set = (await ana.post('/api/training/sets', { exerciseId: squats.id, reps: 3 })).body.set;
    expect((await bob.delete(`/api/training/sets/${set.id}`)).status).toBe(404);
    const eq = (await ana.post('/api/training/equipment', { kind: 'mat' })).body.equipment;
    expect((await bob.patch(`/api/training/equipment/${eq.id}`, { count: 3 })).status).toBe(404);
    expect((await bob.patch(`/api/training/exercises/${squats.id}`, { name: 'x' })).status).toBe(
      404,
    );
    expect(
      (await bob.put(`/api/training/exercises/${squats.id}/pin`, { pinned: true })).status,
    ).toBe(404);
  });
});

describe('training: each person their own library, one home gym', () => {
  it('keeps exercises and routines per person, equipment shared, and maps plans across people', async () => {
    const ana = await signIn('ana@example.com', 'Ana');
    const ion = await signIn('ion@example.com', 'Ion');
    const anaId = (await ana.get('/api/me')).body.user.id;
    const ionId = (await ion.get('/api/me')).body.user.id;
    await ana.get('/api/food/kitchen');
    const { rows } = await t.db.query<{ household_id: string }>(
      'SELECT household_id FROM users WHERE id = $1',
      [anaId],
    );
    await t.db.query('UPDATE users SET household_id = $2 WHERE id = $1', [
      ionId,
      rows[0]!.household_id,
    ]);

    // One bar for both, with its grips; one set of bands, each with its resistance.
    await ana.post('/api/training/equipment', {
      kind: 'pullup_bar',
      variants: [{ name: 'Wide grip' }, { name: 'Neutral grip (parallel)' }, { name: 'wide grip' }],
    });
    const bands = (
      await ana.post('/api/training/equipment', {
        kind: 'bands',
        variants: [
          { name: 'Red', kg: 10 },
          { name: 'Black', kg: 25 },
        ],
      })
    ).body.equipment;
    expect(bands.variants).toEqual([
      { name: 'Red', kg: 10 },
      { name: 'Black', kg: 25 },
    ]);
    expect((await ion.get('/api/training/equipment')).body.equipment).toHaveLength(2);

    // Two libraries: Ana hides burpees and adds her own; Ion's stay whole.
    const anaEx = (await ana.get('/api/training/exercises')).body.exercises;
    const ionEx = (await ion.get('/api/training/exercises')).body.exercises;
    expect(byName(anaEx, 'Burpees').id).not.toBe(byName(ionEx, 'Burpees').id);
    await ana.patch(`/api/training/exercises/${byName(anaEx, 'Burpees').id}`, { archived: true });
    await ana.post('/api/training/exercises', {
      name: 'Pilates hundred',
      category: 'core',
      measure: 'reps',
      variants: ['Legs bent', 'Legs straight'],
    });
    expect(
      byName((await ana.get('/api/training/exercises')).body.exercises, 'Burpees'),
    ).toBeUndefined();
    expect(
      byName((await ion.get('/api/training/exercises')).body.exercises, 'Burpees'),
    ).toBeDefined();
    expect(
      byName((await ion.get('/api/training/exercises')).body.exercises, 'Pilates hundred'),
    ).toBeUndefined();
    // Ana adds one to Ion's library, from her phone.
    expect(
      (
        await ana.post('/api/training/exercises', {
          userId: ionId,
          name: 'Shadow footwork',
          category: 'cardio',
          measure: 'time',
        })
      ).status,
    ).toBe(201);
    expect(
      byName((await ion.get('/api/training/exercises')).body.exercises, 'Shadow footwork'),
    ).toBeDefined();

    // The ways to do a pull-up: the bar's grips first (one "Wide grip"), then its own.
    const pullUps = byName(ionEx, 'Pull-ups');
    const options = byName(
      (await ion.get('/api/training/exercises')).body.exercises,
      'Pull-ups',
    ).options;
    expect(options.filter((o: any) => o.name.toLowerCase() === 'wide grip')).toHaveLength(1);
    expect(options[0]).toMatchObject({
      name: 'Wide grip',
      from: 'equipment',
      equipment: 'Pull-up bar',
    });
    expect(options.map((o: any) => o.name)).toContain('Close grip');
    expect(
      byName((await ion.get('/api/training/exercises')).body.exercises, 'Band rows').options,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Black', kg: 25, from: 'equipment' }),
      ]),
    );

    // Routines are each person's; a routine of Ana's planned for Ion uses Ion's exercises.
    const pilates = byName(
      (await ana.get('/api/training/exercises')).body.exercises,
      'Pilates hundred',
    );
    const routine = (
      await ana.post('/api/training/routines', {
        name: 'Ana’s core',
        items: [
          { exerciseId: pilates.id, sets: 2, reps: 20 },
          { exerciseId: byName(anaEx, 'Plank').id, sets: 2 },
        ],
      })
    ).body.routine;
    expect(routine.userId).toBe(anaId);
    expect((await ion.get('/api/training/routines')).body.routines).toEqual([]);
    expect((await ion.get('/api/training/routines?everyone=true')).body.routines).toHaveLength(1);
    const forIon = (
      await ana.post('/api/training/workouts', {
        userId: ionId,
        date: '2026-10-06',
        routineId: routine.id,
      })
    ).body.workout;
    const ionNow = (await ion.get('/api/training/exercises')).body.exercises;
    expect(forIon.items.map((i: any) => i.exerciseId)).toEqual([
      byName(ionNow, 'Pilates hundred').id,
      byName(ionNow, 'Plank').id,
    ]);
    expect(byName(ionNow, 'Pilates hundred').variants).toEqual(['Legs bent', 'Legs straight']);

    // A grip is kept with the set; the target compares like with like; a retried set counts once.
    const w = (
      await ion.post('/api/training/workouts', {
        date: '2026-10-05',
        items: [{ exerciseId: pullUps.id, sets: 2, reps: 5, variant: 'Wide grip' }],
      })
    ).body.workout;
    const clientId = '4b9cbd6e-6bd4-4c1e-9d0b-2a1d2f1e7c11';
    const first = (
      await ion.post(`/api/training/workouts/${w.id}/sets`, {
        exerciseId: pullUps.id,
        reps: 6,
        variant: 'Wide grip',
        clientId,
        itemIndex: 0,
        round: 1,
        setNumber: 1,
      })
    ).body.set;
    const again = (
      await ion.post(`/api/training/workouts/${w.id}/sets`, {
        exerciseId: pullUps.id,
        reps: 6,
        variant: 'Wide grip',
        clientId,
        itemIndex: 0,
        round: 1,
        setNumber: 1,
      })
    ).body.set;
    expect(again.id).toBe(first.id);
    expect(first.variant).toBe('Wide grip');
    await ion.post('/api/training/sets', {
      exerciseId: pullUps.id,
      reps: 12,
      variant: 'Neutral grip (parallel)',
    });
    const next = (
      await ion.post('/api/training/workouts', {
        date: '2026-10-07',
        items: [{ exerciseId: pullUps.id, sets: 2, reps: 5, variant: 'Wide grip' }],
      })
    ).body.workout;
    expect(next.items[0].suggest.text).toContain('6');
    // A pin belongs to its own library.
    expect(
      (await ana.put(`/api/training/exercises/${pullUps.id}/pin`, { pinned: true })).status,
    ).toBe(400);
    expect(
      (await ana.put(`/api/training/exercises/${pullUps.id}/pin`, { pinned: true, userId: ionId }))
        .status,
    ).toBe(200);
  });
});
