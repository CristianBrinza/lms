import { describe, expect, it } from 'vitest';
import { EQUIPMENT_PRESETS, EXERCISE_PRESETS } from '../src/modules/training/catalog';
import { EQUIPMENT_TEXT, EXERCISE_TEXT, WAYS } from '../src/modules/training/catalog-i18n';
import { setupTestApp } from './helpers';

const t = setupTestApp();

async function signIn(email = 'ana@example.com', name = 'Ana') {
  const user = await t.createUser({ email, name });
  const b = t.browser();
  await b.login(email);
  return { b, user };
}

const byName = (list: any[], name: string) => list.find((e: any) => e.name === name);
const cyrillic = /[а-яё]/i;

describe('training in Romanian and Russian: the catalog', () => {
  it('has every exercise, way and piece of equipment in both languages', () => {
    for (const p of EXERCISE_PRESETS) {
      const text = EXERCISE_TEXT[p.key];
      expect(text, p.key).toBeDefined();
      for (const lang of ['ro', 'ru'] as const) {
        expect(text![lang].name, `${p.key} ${lang}`).toBeTruthy();
        expect(text![lang].steps, `${p.key} ${lang} steps`).toHaveLength(p.steps.length);
      }
      expect(text!.ru.name, p.key).toMatch(cyrillic);
      for (const way of p.variants ?? []) expect(WAYS[way], `${p.key}: ${way}`).toBeDefined();
    }
    expect(Object.keys(EXERCISE_TEXT).sort()).toEqual(EXERCISE_PRESETS.map((p) => p.key).sort());
    for (const p of EQUIPMENT_PRESETS) {
      expect(EQUIPMENT_TEXT[p.kind], p.kind).toBeDefined();
      for (const piece of p.pieces ?? []) expect(WAYS[piece.name], piece.name).toBeDefined();
      if (p.note) expect(EQUIPMENT_TEXT[p.kind]!.ro.note, p.kind).toBeTruthy();
    }
    // Romanian with comma-below letters, never the cedilla ones.
    expect(JSON.stringify([EXERCISE_TEXT, WAYS, EQUIPMENT_TEXT])).not.toMatch(/[şţŞŢ]/);
  });

  it('serves the equipment presets with their translations', async () => {
    const { b } = await signIn();
    const presets = (await b.get('/api/training/catalog')).body.equipment;
    expect(presets.find((p: any) => p.kind === 'bands').translations).toMatchObject({
      ro: { name: 'Benzi elastice', note: 'Ușoare, medii, grele' },
      ru: { name: 'Фитнес-резинки' },
    });
    expect(presets.find((p: any) => p.kind === 'bands').translations.ro.pieces).toHaveLength(5);
  });
});

describe('training in Romanian and Russian: records', () => {
  it('copies the catalog with its translations, and keeps them in step with edits', async () => {
    const { b } = await signIn();
    const exercises = (await b.get('/api/training/exercises')).body.exercises;
    const pushUps = byName(exercises, 'Push-ups');
    expect(pushUps.translations.ro).toMatchObject({ name: 'Flotări' });
    expect(pushUps.translations.ru.name).toBe('Отжимания');
    expect(pushUps.translations.ru.steps).toHaveLength(3);
    expect(pushUps.translations.ro.variants[0]).toBe('Mâinile larg');
    expect(pushUps.options[0].translations).toEqual({
      ro: { name: 'Mâinile larg' },
      ru: { name: 'Широкая постановка рук' },
    });

    // Renamed: the old name's translations go; sent ones are kept; an untouched step list stays.
    const renamed = (
      await b.patch(`/api/training/exercises/${pushUps.id}`, {
        name: 'Wall push-ups',
        translations: { ru: { name: 'Отжимания от стены' } },
      })
    ).body.exercise;
    expect(renamed.translations.ro.name).toBeUndefined();
    expect(renamed.translations.ro.steps).toHaveLength(3);
    expect(renamed.translations.ru.name).toBe('Отжимания от стены');

    // A way added: the others keep their translations, the new one reads as written.
    const ways = (
      await b.patch(`/api/training/exercises/${pushUps.id}`, {
        variants: ['Wide hands', 'Against the counter'],
      })
    ).body.exercise;
    expect(ways.translations.ro.variants).toEqual(['Mâinile larg', 'Against the counter']);

    // Own exercises take translations as given.
    const own = (
      await b.post('/api/training/exercises', {
        name: 'Doorframe rows',
        category: 'strength',
        measure: 'reps',
        translations: { ro: { name: 'Ramat la toc', steps: [''] }, ru: { name: '' } },
      })
    ).body.exercise;
    expect(own.translations).toEqual({ ro: { name: 'Ramat la toc' } });
  });

  it('gives equipment from a preset its translations, pieces included', async () => {
    const { b } = await signIn();
    const bands = (
      await b.post('/api/training/equipment', {
        kind: 'bands',
        variants: [
          { name: 'Red, medium', kg: 10 },
          { name: 'Our blue one', kg: 20 },
        ],
      })
    ).body.equipment;
    expect(bands.translations).toEqual({
      ro: { name: 'Benzi elastice', variants: ['Roșie, medie', 'Our blue one'] },
      ru: { name: 'Фитнес-резинки', variants: ['Красная, средняя', 'Our blue one'] },
    });
    const named = (await b.post('/api/training/equipment', { kind: 'dumbbells', name: 'Old pair' }))
      .body.equipment;
    expect(named.translations).toEqual({});

    const exercises = (await b.get('/api/training/exercises')).body.exercises;
    const option = byName(exercises, 'Band rows').options.find((o: any) => o.name === 'Red, medium');
    expect(option.translations.ro).toEqual({ name: 'Roșie, medie', equipment: 'Benzi elastice' });

    const renamed = (await b.patch(`/api/training/equipment/${bands.id}`, { name: 'Bands' })).body
      .equipment;
    expect(renamed.translations.ro).toEqual({ variants: ['Roșie, medie', 'Our blue one'] });
  });

  it('fills translations in for what was copied before, by preset key, once', async () => {
    const { b, user } = await signIn();
    await b.get('/api/training/exercises');
    await b.post('/api/training/equipment', { kind: 'pullup_bar', variants: [{ name: 'Wide grip' }] });
    // As it was before the catalog had other languages; one exercise renamed meanwhile.
    await t.db.query(`UPDATE training_exercises SET translations = '{}' WHERE user_id = $1`, [
      user.id,
    ]);
    await t.db.query(
      `UPDATE training_exercises SET name = 'My squats' WHERE user_id = $1 AND preset = 'squat'`,
      [user.id],
    );
    await t.db.query(`UPDATE training_equipment SET translations = '{}'`);
    await t.db.query('UPDATE users SET training_catalog_version = 2 WHERE id = $1', [user.id]);

    const exercises = (await b.get('/api/training/exercises')).body.exercises;
    expect(byName(exercises, 'Plank').translations.ro.name).toBe('Planșă');
    const squats = byName(exercises, 'My squats');
    expect(squats.translations.ro.name).toBeUndefined();
    expect(squats.translations.ro.steps[0]).toMatch(/Tălpile/);
    const bar = (await b.get('/api/training/equipment')).body.equipment[0];
    expect(bar.translations.ru).toEqual({ name: 'Турник', variants: ['Широкий хват'] });
  });

  it('keeps routine translations and names workouts in every language', async () => {
    const { b } = await signIn();
    const exercises = (await b.get('/api/training/exercises')).body.exercises;
    const items = [
      { exerciseId: byName(exercises, 'Push-ups').id, sets: 2, reps: 8 },
      { exerciseId: byName(exercises, 'Plank').id, sets: 2, seconds: 30 },
    ];
    const routine = (
      await b.post('/api/training/routines', {
        name: 'Morning',
        items,
        translations: { ro: { name: 'Dimineața' } },
      })
    ).body.routine;
    expect(routine.translations).toEqual({ ro: { name: 'Dimineața' } });
    expect(routine.exercises[0].translations.ro).toEqual({ name: 'Flotări' });

    const fromRoutine = (
      await b.post('/api/training/workouts', { date: '2026-10-08', routineId: routine.id })
    ).body.workout;
    expect(fromRoutine.translations).toEqual({ ro: { title: 'Dimineața' } });

    const plain = (await b.post('/api/training/workouts', { date: '2026-10-08', items })).body
      .workout;
    expect(plain.title).toBe('Push-ups + Plank');
    expect(plain.translations.ro.title).toBe('Flotări + Planșă');
    expect(plain.translations.ru.title).toBe('Отжимания + Планка');

    const set = (
      await b.post(`/api/training/workouts/${plain.id}/sets`, {
        exerciseId: items[0]!.exerciseId,
        reps: 8,
        variant: 'Wide hands',
      })
    ).body.set;
    expect(set.translations.ru).toEqual({ exercise: 'Отжимания', variant: 'Широкая постановка рук' });

    const renamed = (await b.patch(`/api/training/routines/${routine.id}`, { name: 'Evening' }))
      .body.routine;
    expect(renamed.translations).toEqual({});
  });

  it('writes its own words in the language asked for', async () => {
    const { b } = await signIn();
    await b.post('/api/training/equipment', { kind: 'mat' });
    const generated = (
      await b.post(
        '/api/training/generate',
        { minutes: 20, focus: 'full', style: 'circuit' },
        { 'accept-language': 'ro' },
      )
    ).body.workout;
    expect(generated.title).toBe('Tot corpul · 20 min în circuit');
    expect(generated.translations.en.title).toBe('Full body · 20 min circuit');
    expect(generated.translations.ru.title).toBe('Всё тело · 20 мин по кругу');
    expect(generated.exercises[0].translations.ro.name).toBeTruthy();

    // Saved with the Romanian title, it still reads in Russian.
    const saved = (
      await b.post('/api/training/workouts', {
        date: '2026-10-08',
        title: generated.title,
        items: generated.items,
      })
    ).body.workout;
    expect(saved.translations.ru.title).toBe('Всё тело · 20 мин по кругу');

    const today = new Date().toISOString().slice(0, 10);
    const energy = (
      await b.get(`/api/training/energy?from=${today}&to=${today}`, { 'accept-language': 'ru' })
    ).body.energy;
    expect(energy.target.why).toBe('Цель не задана: примерно дневной расход');
    expect(energy.insights.map((i: any) => i.text)).toContain(
      'Вес ещё не указан: считаем для 70 кг. Добавь сегодняшний вес ниже.',
    );
    const english = (await b.get(`/api/training/energy?from=${today}&to=${today}`)).body.energy;
    expect(english.target.why).toBe('No goal set: about what a day burns');
  });
});
