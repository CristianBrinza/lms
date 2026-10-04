import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { AppDeps, AppEnv } from '../../context';
import { readJson, readQuery } from '../../lib/validation';
import { requireAuth } from '../../middleware/auth';
import { foodCtx, requireKitchen } from '../food/kitchen';
import { dateField, idField } from '../food/schemas';
import { localDate } from '../food/stock';
import { CATEGORIES, EQUIPMENT_PRESETS, MEASURES, MUSCLES } from './catalog';
import { generateWorkout } from './generate';
import { HealthImport, healthSummary, HealthQuery, importHealth } from './health';
import {
  addEquipment,
  createExercise,
  describeExercise,
  findExercise,
  listEquipment,
  listExercises,
  pinsOf,
  removeEquipment,
  setPinned,
  syncCatalog,
  updateEquipment,
  updateExercise,
} from './library';
import {
  EquipmentInput,
  EquipmentPatch,
  ExerciseInput,
  ExercisePatch,
  FinishInput,
  GenerateInput,
  PersonQuery,
  RangeQuery,
  RoutineInput,
  RoutinePatch,
  SetInput,
  SetPatch,
  WorkoutInput,
  WorkoutPatch,
} from './schemas';
import { exerciseHistory, stats, trainingOverview } from './stats';
import {
  copyWorkout,
  createRoutine,
  createWorkout,
  finishWorkout,
  getWorkout,
  listRoutines,
  listWorkouts,
  logSet,
  personId,
  removeRoutine,
  removeSet,
  removeWorkout,
  setsOn,
  startWorkout,
  trainingPeople,
  updateRoutine,
  updateSet,
  updateWorkout,
} from './workouts';

/**
 * /api/training — home workouts for everyone in the household. The equipment and the exercises are
 * the household's; workouts, sets and statistics are each person's (`userId`, default the caller).
 */
export function trainingRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  app.use('*', requireAuth(deps), requireKitchen(deps));
  const ctx = (c: Context<AppEnv>) => foodCtx(deps, c.get('actor'));
  const person = async (c: Context<AppEnv>) => personId(ctx(c), readQuery(c, PersonQuery).userId);

  app.get('/overview', async (c) => {
    const query = readQuery(c, PersonQuery.extend({ today: dateField.optional() }));
    const userId = await personId(ctx(c), query.userId);
    await syncCatalog(ctx(c));
    return c.json(await trainingOverview(ctx(c), userId, query.today));
  });

  app.get('/people', async (c) => c.json({ people: await trainingPeople(ctx(c)) }));

  app.get('/catalog', (c) =>
    c.json({
      equipment: EQUIPMENT_PRESETS,
      muscles: MUSCLES,
      categories: CATEGORIES,
      measures: MEASURES,
    }),
  );

  // Equipment
  app.get('/equipment', async (c) =>
    c.json({ equipment: await listEquipment(ctx(c)), presets: EQUIPMENT_PRESETS }),
  );
  app.post('/equipment', async (c) =>
    c.json({ equipment: await addEquipment(ctx(c), await readJson(c, EquipmentInput)) }, 201),
  );
  app.patch('/equipment/:id', async (c) =>
    c.json({
      equipment: await updateEquipment(
        ctx(c),
        c.req.param('id'),
        await readJson(c, EquipmentPatch),
      ),
    }),
  );
  app.delete('/equipment/:id', async (c) => {
    await removeEquipment(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });

  // Exercises
  app.get('/exercises', async (c) => {
    const query = readQuery(
      c,
      PersonQuery.extend({ archived: z.enum(['true', 'false']).optional() }),
    );
    const userId = await personId(ctx(c), query.userId);
    return c.json({
      exercises: await listExercises(ctx(c), userId, { archived: query.archived === 'true' }),
    });
  });
  app.post('/exercises', async (c) =>
    c.json({ exercise: await createExercise(ctx(c), await readJson(c, ExerciseInput)) }, 201),
  );
  app.get('/exercises/:id', async (c) => {
    const userId = await person(c);
    const [history, equipment, pins] = await Promise.all([
      exerciseHistory(ctx(c), userId, c.req.param('id')),
      listEquipment(ctx(c)),
      pinsOf(ctx(c), userId),
    ]);
    return c.json({ ...history, exercise: describeExercise(history.exercise, equipment, pins) });
  });
  app.patch('/exercises/:id', async (c) =>
    c.json({
      exercise: await updateExercise(ctx(c), c.req.param('id'), await readJson(c, ExercisePatch)),
    }),
  );
  app.put('/exercises/:id/pin', async (c) => {
    const body = await readJson(c, z.object({ pinned: z.boolean(), userId: idField.optional() }));
    const userId = await personId(ctx(c), body.userId);
    await setPinned(ctx(c), userId, c.req.param('id'), body.pinned);
    const exercise = await findExercise(ctx(c), c.req.param('id'));
    return c.json({
      exercise: describeExercise(
        exercise,
        await listEquipment(ctx(c)),
        await pinsOf(ctx(c), userId),
      ),
    });
  });

  // Routines
  app.get('/routines', async (c) => c.json({ routines: await listRoutines(ctx(c)) }));
  app.post('/routines', async (c) =>
    c.json({ routine: await createRoutine(ctx(c), await readJson(c, RoutineInput)) }, 201),
  );
  app.patch('/routines/:id', async (c) =>
    c.json({
      routine: await updateRoutine(ctx(c), c.req.param('id'), await readJson(c, RoutinePatch)),
    }),
  );
  app.delete('/routines/:id', async (c) => {
    await removeRoutine(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });

  // Workouts
  app.get('/workouts', async (c) => {
    const query = readQuery(
      c,
      RangeQuery.extend({ everyone: z.enum(['true', 'false']).optional() }),
    );
    const userId = query.everyone === 'true' ? null : await personId(ctx(c), query.userId);
    return c.json({
      workouts: await listWorkouts(ctx(c), { userId, from: query.from, to: query.to }),
    });
  });
  app.post('/workouts', async (c) =>
    c.json({ workout: await createWorkout(ctx(c), await readJson(c, WorkoutInput)) }, 201),
  );
  app.get('/workouts/:id', async (c) =>
    c.json({ workout: await getWorkout(ctx(c), c.req.param('id')) }),
  );
  app.patch('/workouts/:id', async (c) =>
    c.json({
      workout: await updateWorkout(ctx(c), c.req.param('id'), await readJson(c, WorkoutPatch)),
    }),
  );
  app.delete('/workouts/:id', async (c) => {
    await removeWorkout(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });
  app.post('/workouts/:id/start', async (c) =>
    c.json({ workout: await startWorkout(ctx(c), c.req.param('id')) }),
  );
  app.post('/workouts/:id/finish', async (c) =>
    c.json({
      workout: await finishWorkout(ctx(c), c.req.param('id'), await readJson(c, FinishInput)),
    }),
  );
  app.post('/workouts/:id/copy', async (c) => {
    const body = await readJson(c, z.object({ date: dateField, userId: idField.optional() }));
    return c.json({ workout: await copyWorkout(ctx(c), c.req.param('id'), body) }, 201);
  });
  app.post('/workouts/:id/sets', async (c) =>
    c.json(await logSet(ctx(c), await readJson(c, SetInput), c.req.param('id')), 201),
  );

  // Sets on their own: a push-up in passing, or "20 squats this morning"
  app.get('/sets', async (c) => {
    const query = readQuery(c, PersonQuery.extend({ day: dateField.optional() }));
    const userId = await personId(ctx(c), query.userId);
    return c.json({ sets: await setsOn(ctx(c), userId, query.day ?? localDate(deps.now())) });
  });
  app.post('/sets', async (c) => c.json(await logSet(ctx(c), await readJson(c, SetInput)), 201));
  app.patch('/sets/:id', async (c) =>
    c.json({ set: await updateSet(ctx(c), c.req.param('id'), await readJson(c, SetPatch)) }),
  );
  app.delete('/sets/:id', async (c) => {
    await removeSet(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });

  app.get('/stats', async (c) => {
    const query = readQuery(c, RangeQuery.extend({ today: dateField.optional() }));
    const userId = await personId(ctx(c), query.userId);
    return c.json({
      stats: await stats(
        ctx(c),
        userId,
        query.from,
        query.to,
        query.today ?? localDate(deps.now()),
      ),
    });
  });

  // Health data the phone sends (an iOS Shortcut, the Android companion) or typed in.
  app.post('/health', async (c) =>
    c.json(await importHealth(ctx(c), await readJson(c, HealthImport))),
  );
  app.get('/health', async (c) => {
    const query = readQuery(c, HealthQuery);
    const userId = await personId(ctx(c), query.userId);
    return c.json({ health: await healthSummary(ctx(c), userId, query.from, query.to) });
  });

  app.post('/generate', async (c) => {
    const input = await readJson(c, GenerateInput);
    const userId = await personId(ctx(c), input.userId);
    return c.json({ workout: await generateWorkout(ctx(c), userId, input) });
  });

  return app;
}
