import { describe, expect, it } from 'vitest';
import { setupTestApp } from './helpers';

const t = setupTestApp();
const NOW = new Date('2026-10-02T07:00:00');

async function cook() {
  await t.createUser({ email: 'ana@example.com', name: 'Ana' });
  const b = t.browser();
  await b.login('ana@example.com');
  return b;
}
type B = Awaited<ReturnType<typeof cook>>;

const totals = async (b: B) =>
  Object.fromEntries(
    ((await b.get('/api/food/kitchen')).body.products as any[])
      .filter((p) => p.trackMode === 'exact')
      .map((p) => [p.name, p.total]),
  );

/** Breakfast with a drink made one way or another: a creamy coffee, or a tea. */
async function breakfast(b: B) {
  const res = await b.post('/api/food/recipes', {
    title: 'Scrambled eggs on toast',
    servings: 1,
    tags: ['breakfast'],
    ingredients: [{ name: 'Eggs', amount: 2 }],
    steps: ['Scramble the eggs'],
    choices: [
      {
        name: 'Drink',
        translations: { ro: { name: 'Băutură' }, ru: { name: 'Напиток' } },
        options: [
          {
            name: 'Creamy coffee',
            ingredients: [
              { name: 'Coffee', amount: 20, unit: 'g' },
              { name: 'Water', amount: 100, unit: 'ml', link: false },
              { name: 'Milk', amount: 300, unit: 'ml', or: [{ name: 'Cream' }] },
            ],
            steps: ['Brew the coffee', 'Add the milk'],
          },
          {
            name: 'Tea',
            translations: { ro: { name: 'Ceai' }, ru: { name: 'Чай' } },
            ingredients: [
              { name: 'Lemon', amount: 1 },
              { name: 'Sugar', amount: 20, unit: 'g', optional: true },
            ],
            steps: ['Steep the tea'],
          },
        ],
      },
    ],
  });
  expect(res.status).toBe(201);
  return res.body.recipe;
}

const names = (lines: any[]) => lines.map((l) => l.name);

describe('food: recipe choices', () => {
  it('keeps a choice with its options; the default one counts for availability', async () => {
    t.setNow(NOW);
    const b = await cook();
    await b.post('/api/food/stock', { name: 'Eggs', quantity: 10 });
    await b.post('/api/food/stock', { name: 'Coffee', quantity: 250, unit: 'g' });
    await b.post('/api/food/stock', { name: 'Milk', quantity: 1000, unit: 'ml' });
    const recipe = await breakfast(b);

    // The recipe's own lines; each option carries its own lines and steps.
    expect(names(recipe.ingredients)).toEqual(['Eggs']);
    expect(recipe.choices).toHaveLength(1);
    const drink = recipe.choices[0];
    expect(drink).toMatchObject({ name: 'Drink', translations: { ro: { name: 'Băutură' } } });
    expect(drink.options.map((o: any) => o.name)).toEqual(['Creamy coffee', 'Tea']);
    expect(drink.chosen).toBe(drink.options[0].id);
    expect(drink.remembered).toBeNull();
    expect(names(drink.options[0].ingredients)).toEqual(['Coffee', 'Water', 'Milk']);
    expect(drink.options[0].ingredients[2].alternatives[0].name).toBe('Cream');
    expect(drink.options[1].steps).toEqual(['Steep the tea']);
    expect(drink.options[1].translations).toMatchObject({ ro: { name: 'Ceai' } });

    // Coffee is the default and there is all of it: ready. Tea needs a lemon.
    expect(recipe.availability).toMatchObject({ ready: true, have: 3, total: 3 });
    expect(drink.options[1].availability.ready).toBe(false);
    const list = (await b.get('/api/food/recipes')).body.recipes;
    expect(list[0].availability.ready).toBe(true);

    // Asked with tea: what is missing is the lemon.
    const tea = (await b.get(`/api/food/recipes/${recipe.id}?options=Ceai`)).body.recipe;
    expect(tea.choices[0].chosen).toBe(drink.options[1].id);
    expect(tea.availability.ready).toBe(false);
    expect(tea.availability.missing.map((m: any) => m.name)).toEqual(['Lemon']);
    // Nutrition counts the coffee's milk, not the tea.
    expect(recipe.nutrition.total.kcal).toBeGreaterThan(tea.nutrition.total.kcal);

    const unknown = await b.get(`/api/food/recipes/${recipe.id}?options=Juice`);
    expect(unknown.status).toBe(400);
  });

  it('plans with each option, switches it, scales it and takes only what was made', async () => {
    t.setNow(NOW);
    const b = await cook();
    await b.post('/api/food/stock', { name: 'Eggs', quantity: 10 });
    await b.post('/api/food/stock', { name: 'Coffee', quantity: 250, unit: 'g' });
    await b.post('/api/food/stock', { name: 'Milk', quantity: 1000, unit: 'ml' });
    await b.post('/api/food/stock', { name: 'Lemon', quantity: 3 });
    const recipe = await breakfast(b);
    const [coffee, tea] = recipe.choices[0].options;

    // Tea for two: the lemon (scaled), not the coffee.
    const planned = (
      await b.post('/api/food/meals', {
        date: '2026-10-03',
        time: '08:00',
        recipeId: recipe.id,
        servings: 2,
        options: ['Tea'],
      })
    ).body.meal;
    expect(names(planned.ingredients)).toEqual(['Eggs', 'Lemon', 'Sugar']);
    expect(planned.ingredients[1]).toMatchObject({ amount: 2, optionId: tea.id });
    expect(planned.parts[0].choices[0]).toMatchObject({ name: 'Drink', chosen: tea.id });
    expect(planned.availability.ready).toBe(true);
    // Picked on purpose: tea is the default now.
    const after = (await b.get(`/api/food/recipes/${recipe.id}`)).body.recipe;
    expect(after.choices[0]).toMatchObject({ chosen: tea.id, remembered: tea.id });

    // Coffee after all: the tea's lines go, the coffee's come scaled to two.
    const switched = (
      await b.put(`/api/food/meals/${planned.id}/parts/${planned.parts[0].id}/option`, {
        option: coffee.id,
      })
    ).body.meal;
    expect(names(switched.ingredients)).toEqual(['Eggs', 'Coffee', 'Water', 'Milk']);
    expect(switched.ingredients.find((l: any) => l.name === 'Milk').amount).toBe(600);
    expect(switched.parts[0].choices[0].chosen).toBe(coffee.id);
    const unknown = await b.put(
      `/api/food/meals/${planned.id}/parts/${planned.parts[0].id}/option`,
      { option: 'Juice' },
    );
    expect(unknown.status).toBe(400);

    // Three people: the option's lines scale with the rest.
    const three = (await b.patch(`/api/food/meals/${planned.id}`, { servings: 3 })).body.meal;
    expect(three.ingredients.find((l: any) => l.name === 'Milk').amount).toBe(900);
    expect(three.ingredients.find((l: any) => l.name === 'Eggs').amount).toBe(6);

    // Cooked: coffee and milk leave the kitchen, the lemons stay.
    await b.post(`/api/food/meals/${planned.id}/done`, {});
    expect(await totals(b)).toMatchObject({ Eggs: 4, Coffee: 190, Milk: 100, Lemons: 3 });
    // Coffee was made last: it is the default again.
    const remembered = (await b.get(`/api/food/recipes/${recipe.id}`)).body.recipe;
    expect(remembered.choices[0].chosen).toBe(coffee.id);
  });

  it('cooks now with the option picked, and plan needs follow the option', async () => {
    t.setNow(NOW);
    const b = await cook();
    await b.post('/api/food/stock', { name: 'Eggs', quantity: 10 });
    await b.post('/api/food/stock', { name: 'Lemon', quantity: 3 });
    const recipe = await breakfast(b);

    const cooked = await b.post(`/api/food/recipes/${recipe.id}/cook`, {
      servings: 1,
      options: ['Tea'],
    });
    expect(cooked.status).toBe(201);
    expect(names(cooked.body.meal.ingredients)).toEqual(['Eggs', 'Lemon', 'Sugar']);
    expect(cooked.body.shortfalls).toEqual([]);
    expect(await totals(b)).toMatchObject({ Eggs: 8, Lemons: 2 });

    // Planned with the default (tea, made last): nothing of the coffee is to buy.
    await b.post('/api/food/meals', {
      date: '2026-10-04',
      time: '08:00',
      recipeId: recipe.id,
      servings: 1,
    });
    const needs = (await b.get('/api/food/plan/needs?from=2026-10-04&to=2026-10-04')).body;
    const needed = JSON.stringify(needs);
    expect(needed).not.toContain('Coffee');
    expect(needed).not.toContain('Milk');
  });

  it('keeps choices by id or name when the recipe is saved again, and drops the rest', async () => {
    t.setNow(NOW);
    const b = await cook();
    const recipe = await breakfast(b);
    const drink = recipe.choices[0];
    const [coffee, tea] = drink.options;

    const saved = (
      await b.patch(`/api/food/recipes/${recipe.id}`, {
        ingredients: [{ name: 'Eggs', amount: 3 }],
        choices: [
          {
            id: drink.id,
            name: 'Drink',
            options: [
              { name: 'Tea', ingredients: [{ name: 'Lemon', amount: 1 }] },
              { name: 'Cocoa', ingredients: [{ name: 'Milk', amount: 250, unit: 'ml' }] },
            ],
          },
        ],
      })
    ).body.recipe;
    expect(saved.choices[0].id).toBe(drink.id);
    expect(saved.choices[0].options.map((o: any) => o.name)).toEqual(['Tea', 'Cocoa']);
    // Tea kept its id (and its translations, the name unchanged); the coffee is gone.
    expect(saved.choices[0].options[0]).toMatchObject({
      id: tea.id,
      translations: { ro: { name: 'Ceai' } },
    });
    expect(saved.choices[0].options.some((o: any) => o.id === coffee.id)).toBe(false);
    expect(names(saved.choices[0].options[0].ingredients)).toEqual(['Lemon']);
    // The recipe's own lines were replaced without touching the options'.
    expect(names(saved.ingredients)).toEqual(['Eggs']);

    // Only its own lines changed: the choices stay.
    const own = (
      await b.patch(`/api/food/recipes/${recipe.id}`, {
        ingredients: [{ name: 'Eggs', amount: 2 }],
      })
    ).body.recipe;
    expect(own.choices[0].options).toHaveLength(2);
    expect(names(own.choices[0].options[1].ingredients)).toEqual(['Milk']);

    const twice = await b.patch(`/api/food/recipes/${recipe.id}`, {
      choices: [{ name: 'Drink', options: [{ name: 'Tea' }, { name: 'tea' }] }],
    });
    expect(twice.status).toBe(400);
    const one = await b.patch(`/api/food/recipes/${recipe.id}`, {
      choices: [{ name: 'Drink', options: [{ name: 'Tea' }] }],
    });
    expect(one.status).toBe(400);

    const none = (await b.patch(`/api/food/recipes/${recipe.id}`, { choices: [] })).body.recipe;
    expect(none.choices).toEqual([]);
  });
});

/** Cristian's breakfast, as the main chat will save it: two courses, the drink a choice. */
const BREAKFAST = {
  title: 'Scrambled eggs on toast',
  servings: 2,
  tags: ['breakfast'],
  translations: {
    ro: { title: 'Omletă pe pâine prăjită' },
    ru: { title: 'Яичница-болтунья на тосте' },
    en: { title: 'Scrambled eggs on toast' },
  },
  ingredients: [
    { name: 'Eggs', amount: 5, course: 'second' },
    { name: 'Salt', course: 'dish' },
    { name: 'Black pepper', course: 'dish' },
    { name: 'Bread', amount: 4, unit: 'slices', course: 'dish' },
    { name: 'Philadelphia', amount: 60, unit: 'g', course: 'dish' },
    { name: 'Tomatoes', amount: 1, course: 'dish' },
  ],
  choices: [
    {
      name: 'Drink',
      course: 'drink',
      translations: { ro: { name: 'Băutură' }, ru: { name: 'Напиток' }, en: { name: 'Drink' } },
      options: [
        {
          name: 'Coffee',
          translations: { ro: { name: 'Cafea' }, ru: { name: 'Кофе' }, en: { name: 'Coffee' } },
          ingredients: [
            { name: 'Coffee', amount: 20, unit: 'g' },
            { name: 'Water', amount: 100, unit: 'ml', link: false },
            { name: 'Milk', amount: 300, unit: 'ml', or: [{ name: 'Cream' }] },
            { name: 'Cream', amount: 80, unit: 'ml', or: [{ name: 'Milk' }] },
            { name: 'Coffee syrup', amount: 20, unit: 'ml', optional: true },
          ],
        },
        {
          name: 'Tea',
          translations: { ro: { name: 'Ceai' }, ru: { name: 'Чай' }, en: { name: 'Tea' } },
          ingredients: [
            { name: 'Tea', amount: 2, unit: 'pcs' },
            { name: 'Water', amount: 500, unit: 'ml', link: false },
            {
              name: 'Sugar',
              amount: 40,
              unit: 'g',
              optional: true,
              or: [{ name: 'Honey', amount: 20, unit: 'g' }],
            },
          ],
        },
      ],
    },
  ],
};

describe('food: courses', () => {
  it('keeps a recipe’s courses, its drink a choice, and the meal its sections', async () => {
    t.setNow(NOW);
    const b = await cook();
    const res = await b.post('/api/food/recipes', BREAKFAST);
    expect(res.status).toBe(201);
    const recipe = res.body.recipe;
    // "second" is the main dish.
    expect(recipe.ingredients.map((l: any) => l.course)).toEqual(Array(6).fill('dish'));
    expect(recipe.choices[0]).toMatchObject({ name: 'Drink', course: 'drink' });
    const coffee = recipe.choices[0].options[0];
    expect(coffee.ingredients.every((l: any) => l.course === 'drink')).toBe(true);
    // Water isn't kept in the kitchen, yet reads in every language.
    const water = coffee.ingredients.find((l: any) => l.name === 'Water');
    expect(water.productId).toBeNull();
    expect(water.translations.ro.name).not.toBe('Water');
    expect(water.translations.ru.name).toBeTruthy();

    const meal = (
      await b.post('/api/food/meals', {
        date: '2026-10-03',
        time: '08:00',
        recipeId: recipe.id,
        servings: 2,
        options: ['Ceai'],
      })
    ).body.meal;
    expect(meal.parts[0].choices[0]).toMatchObject({ course: 'drink' });
    const sections = meal.ingredients.map((l: any) => [l.name, l.course]);
    expect(sections).toContainEqual(['Eggs', 'dish']);
    expect(sections).toContainEqual(['Tea', 'drink']);
    expect(meal.ingredients.find((l: any) => l.name === 'Water').translations.ro.name).toBe(
      water.translations.ro.name,
    );

    // Lines given their own names in other languages keep them.
    const own = (
      await b.post(`/api/food/meals/${meal.id}/parts`, {
        title: 'Soup',
        kind: 'first',
        ingredients: [
          { name: 'Broth', amount: 300, unit: 'ml', link: false, translations: { ro: { name: 'Supă' } } },
        ],
      })
    ).body.meal;
    expect(own.parts.map((p: any) => p.kind)).toEqual(['first', 'dish']);
    expect(own.ingredients.find((l: any) => l.name === 'Broth').translations.ro.name).toBe('Supă');
    const dessert = await b.post(`/api/food/meals/${meal.id}/parts`, {
      title: 'Cake',
      kind: 'dessert',
    });
    expect(dessert.body.meal.parts.map((p: any) => p.kind)).toEqual(['first', 'dish', 'dessert']);
  });
});

describe('food: optional lines switched on or off for a meal', () => {
  it('leaves an optional line out of what is missing, eaten and taken, or counts it', async () => {
    t.setNow(NOW);
    const b = await cook();
    await b.post('/api/food/stock', { name: 'Eggs', quantity: 10 });
    await b.post('/api/food/stock', { name: 'Lemon', quantity: 3 });
    await b.post('/api/food/stock', { name: 'Sugar', quantity: 10, unit: 'g' });
    const recipe = await breakfast(b);
    const meal = (
      await b.post('/api/food/meals', {
        date: '2026-10-02',
        time: '08:00',
        recipeId: recipe.id,
        servings: 1,
        options: ['Tea'],
      })
    ).body.meal;
    const sugar = meal.ingredients.find((l: any) => l.name === 'Sugar');
    // As usual: optional, not needed (there is only 10 g of the 20).
    expect(sugar).toMatchObject({ optional: true, included: null });
    expect(meal.availability.ready).toBe(true);
    const plain = meal.nutrition.total.kcal;

    // Switched on: it is needed (10 g missing) and eaten.
    const on = (
      await b.put(`/api/food/meals/${meal.id}/ingredients/${sugar.id}/included`, {
        included: true,
      })
    ).body.meal;
    expect(on.ingredients.find((l: any) => l.name === 'Sugar').included).toBe(true);
    expect(on.availability.missing.map((m: any) => m.name)).toEqual(['Sugar']);
    expect(on.nutrition.total.kcal).toBeGreaterThan(plain + 50);
    const needs = (await b.get('/api/food/plan/needs?from=2026-10-02&to=2026-10-02')).body;
    expect(JSON.stringify(needs)).toContain('Sugar');

    // Switched off: not missing, not eaten, not bought, not taken.
    const off = (
      await b.put(`/api/food/meals/${meal.id}/ingredients/${sugar.id}/included`, {
        included: false,
      })
    ).body.meal;
    expect(off.availability.missing).toEqual([]);
    expect(off.nutrition.total.kcal).toBe(plain);
    const offNeeds = (await b.get('/api/food/plan/needs?from=2026-10-02&to=2026-10-02')).body;
    expect(JSON.stringify(offNeeds)).not.toContain('Sugar');

    // Kept when the lines are saved back.
    const resaved = (
      await b.put(`/api/food/meals/${meal.id}/ingredients`, {
        ingredients: off.ingredients.map((l: any) => ({
          productId: l.productId ?? undefined,
          name: l.name,
          amount: l.amount,
          unit: l.unit,
          optional: l.optional,
          partId: l.partId,
          optionId: l.optionId,
          included: l.included,
        })),
      })
    ).body.meal;
    expect(resaved.ingredients.find((l: any) => l.name === 'Sugar')).toMatchObject({
      included: false,
    });
    expect(resaved.ingredients.find((l: any) => l.name === 'Lemon').optionId).toBe(
      recipe.choices[0].options[1].id,
    );

    await b.post(`/api/food/meals/${meal.id}/done`, {});
    expect(await totals(b)).toMatchObject({ Eggs: 8, Lemons: 2, Sugar: 10 });

    // Back on, reopened and eaten again: the sugar there is goes.
    await b.post(`/api/food/meals/${meal.id}/reopen`);
    const sugarNow = resaved.ingredients.find((l: any) => l.name === 'Sugar');
    await b.put(`/api/food/meals/${meal.id}/ingredients/${sugarNow.id}/included`, {
      included: true,
    });
    await b.post(`/api/food/meals/${meal.id}/done`, {});
    const left = await totals(b);
    expect(left.Sugar ?? 0).toBe(0);

    // Only optional lines can be left out.
    await b.post(`/api/food/meals/${meal.id}/reopen`);
    const eggs = resaved.ingredients.find((l: any) => l.name === 'Eggs');
    const refused = await b.put(`/api/food/meals/${meal.id}/ingredients/${eggs.id}/included`, {
      included: false,
    });
    expect(refused.status).toBe(400);
  });
});
