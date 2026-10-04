import { describe, expect, it } from 'vitest';
import { setupTestApp } from './helpers';

const t = setupTestApp();
const NOW = new Date('2026-10-02T17:00:00');

async function cook() {
  await t.createUser({ email: 'ana@example.com', name: 'Ana' });
  const b = t.browser();
  await b.login('ana@example.com');
  return b;
}

describe('food: drinks with an exact brand, pouring, ice', () => {
  it('lets a recipe ask for one brand, and takes only that', async () => {
    t.setNow(NOW);
    const b = await cook();
    const absolut = (
      await b.post('/api/food/stock', { name: 'Absolut', quantity: 1, unit: 'bottle' })
    ).body;
    expect(absolut.product.name).toBe('Vodka');
    expect(absolut.lot).toMatchObject({ variant: 'Absolut', quantity: 500 });
    await b.post('/api/food/stock', { name: 'Finlandia vodka', quantity: 50, unit: 'ml' });
    await b.post('/api/food/stock', { name: 'maracuya syrup', quantity: 1, unit: 'bottle' });
    await b.post('/api/food/stock', { name: 'mango puree', quantity: 1, unit: 'pack' });
    const ice = (
      await b.post('/api/food/stock', {
        name: 'Ice cubes',
        package: 'pack',
        packages: [
          { count: 1, size: 3 },
          { count: 1, size: 4 },
        ],
      })
    ).body;
    expect(ice.lots.map((l: any) => l.quantity)).toEqual([3, 4]);
    expect(ice.lots[0].location).toBe('freezer');

    const drink = (
      await b.post('/api/food/recipes', {
        title: 'Passion fruit cooler',
        servings: 1,
        tags: ['drink'],
        ingredients: [
          { name: 'Finlandia vodka', amount: 40, unit: 'ml' },
          { name: 'Syrup', variant: 'Maracuya', amount: 20, unit: 'ml' },
          { name: 'Mango puree', amount: 30, unit: 'g' },
          { name: 'Sprite', amount: 100, unit: 'ml' },
          { name: 'Ice cubes', amount: 4 },
        ],
      })
    ).body.recipe;
    const vodka = drink.ingredients[0];
    expect(vodka).toMatchObject({ variant: 'Finlandia', inStock: 50, enough: true });
    expect(drink.ingredients[1]).toMatchObject({ variant: 'Maracuya', enough: true });
    expect(drink.ingredients[2]).toMatchObject({ variant: 'Mango', enough: true });

    // Two drinks need 80 ml of Finlandia: the Absolut doesn't count.
    const two = (await b.get(`/api/food/recipes/${drink.id}?servings=2`)).body.recipe;
    expect(two.ingredients[0]).toMatchObject({ enough: false, missing: 30 });

    await b.post(`/api/food/recipes/${drink.id}/cook`, {});
    const vodkas = (await b.get('/api/food/kitchen')).body.products.find(
      (p: any) => p.name === 'Vodka',
    ).lots;
    expect(vodkas.map((l: any) => [l.variant, l.quantity]).sort()).toEqual([
      ['Absolut', 500],
      ['Finlandia', 10],
    ]);
  });

  it('pours from the big oil bottle into the small one on the desk', async () => {
    t.setNow(NOW);
    const b = await cook();
    const big = (
      await b.post('/api/food/stock', {
        name: 'Sunflower oil',
        packages: [{ count: 1, size: 3, sizeUnit: 'l' }],
      })
    ).body;
    expect(big.product.trackMode).toBe('exact');
    const poured = (
      await b.post(`/api/food/lots/${big.lot.id}/pour`, {
        quantity: 200,
        package: 'dispenser',
        packageSize: 250,
        location: 'other',
        note: 'On the desk',
      })
    ).body;
    expect(poured.from).toMatchObject({ quantity: 2800 });
    expect(poured.into).toMatchObject({
      quantity: 200,
      initialQuantity: 250,
      package: 'dispenser',
      note: 'On the desk',
      location: 'other',
    });
    expect(poured.into.openedAt).not.toBeNull();

    // Topping it up later.
    const again = (
      await b.post(`/api/food/lots/${big.lot.id}/pour`, { quantity: 50, intoLotId: poured.into.id })
    ).body;
    expect(again.into.quantity).toBe(250);
    expect(again.from.quantity).toBe(2750);
    const oil = (await b.get('/api/food/kitchen')).body.products.find(
      (p: any) => p.name === 'Sunflower oil',
    );
    expect(oil.total).toBe(3000);
    expect((await b.post(`/api/food/lots/${big.lot.id}/pour`, { quantity: 5000 })).status).toBe(
      400,
    );
  });
});

describe('kitchenware', () => {
  it('counts pots and pens; recipes need them; cooking dirties them; the dishwasher cleans them', async () => {
    t.setNow(NOW);
    const b = await cook();
    const pot = (await b.post('/api/food/kitchenware', { name: 'big pot', count: 1 })).body.tool;
    expect(pot).toMatchObject({
      name: 'Big pot',
      icon: 'big-pot',
      kind: 'cookware',
      count: 1,
      clean: 1,
    });
    const pens = (
      await b.post('/api/food/kitchenware', { name: 'pens', count: 12, place: 'Desk drawer' })
    ).body.tool;
    expect(pens).toMatchObject({ name: 'Pens', kind: 'other', washable: false, count: 12 });

    await b.post('/api/food/stock', { name: 'Pasta', quantity: 500, unit: 'g' });
    const spaghetti = (
      await b.post('/api/food/recipes', {
        title: 'Spaghetti',
        servings: 2,
        ingredients: [{ name: 'Pasta', amount: 200, unit: 'g' }],
        tools: [{ name: 'Big pot' }, { name: 'Colander' }],
      })
    ).body.recipe;
    expect(spaghetti.tools.map((n: any) => [n.name, n.status])).toEqual([
      ['Big pot', 'ready'],
      ['Colander', 'ready'],
    ]);

    const lunch = (
      await b.post('/api/food/meals', { date: '2026-10-02', time: '18:00', recipeId: spaghetti.id })
    ).body.meal;
    expect(lunch.tools[0]).toMatchObject({ name: 'Big pot', status: 'ready' });
    await b.post(`/api/food/meals/${lunch.id}/done`, {});
    const listed = await b.get('/api/food/kitchenware');
    let tools = listed.body.tools;
    expect(tools.find((x: any) => x.name === 'Big pot')).toMatchObject({ dirty: 1, clean: 0 });

    // Dinner needs the pot again: it's dirty.
    const dinner = (
      await b.post('/api/food/meals', { date: '2026-10-02', time: '21:00', recipeId: spaghetti.id })
    ).body.meal;
    expect(dinner.tools[0]).toMatchObject({ name: 'Big pot', status: 'dirty' });

    // Into the dishwasher for three hours: clean by 20:00, ready for a 21:00 dinner.
    await b.put('/api/food/kitchenware/dishwasher', { minutes: 180 });
    tools = (await b.post('/api/food/kitchenware/wash', { how: 'machine' })).body.tools;
    expect(tools.find((x: any) => x.name === 'Big pot')).toMatchObject({
      washing: 1,
      clean: 0,
      washingUntil: new Date('2026-10-02T20:00:00').toISOString(),
    });
    expect((await b.get(`/api/food/meals/${dinner.id}`)).body.meal.tools[0]).toMatchObject({
      status: 'ready',
    });

    t.setNow(new Date('2026-10-02T20:30:00'));
    await b.post('/api/auth/refresh');
    tools = (await b.get('/api/food/kitchenware')).body.tools;
    expect(tools.find((x: any) => x.name === 'Big pot')).toMatchObject({
      washing: 0,
      clean: 1,
      washingUntil: null,
    });

    // Reopening the meal takes the dirt back too; washing by hand is immediate.
    await b.post(`/api/food/kitchenware/${pot.id}/used`, { count: 1 });
    await b.post(`/api/food/kitchenware/wash`, { how: 'hand', toolIds: [pot.id] });
    expect(
      (await b.get('/api/food/kitchenware')).body.tools.find((x: any) => x.id === pot.id).clean,
    ).toBe(1);
  });

  it('knows what is washed by hand, what is never washed, what is used up, and what is one each', async () => {
    t.setNow(NOW);
    const b = await cook();
    const add = async (name: string, count = 1) =>
      (await b.post('/api/food/kitchenware', { name, count })).body.tool;
    const kettle = await add('kettle');
    expect(kettle).toMatchObject({ name: 'Electric kettle', washable: false });
    const chef = await add('chef knife');
    const ceramic = await add('ceramic knife', 2);
    expect(chef).toMatchObject({ name: 'Chef’s knife', dishwasherSafe: false });
    expect(ceramic).toMatchObject({ name: 'Ceramic knife', count: 2 });
    const pan = await add('Frying pan');
    const grill = await add('grill');
    expect(grill).toMatchObject({ dishwasherSafe: false });
    const boxes = await add('Lunch box', 3);
    const paper = await add('Baking paper', 10);
    expect(paper).toMatchObject({ kind: 'disposable', washable: false, minCount: 2, low: false });

    await b.post('/api/food/stock', { name: 'Chicken breast', quantity: 600, unit: 'g' });
    const recipe = (
      await b.post('/api/food/recipes', {
        title: 'Chicken to go',
        servings: 1,
        ingredients: [{ name: 'Chicken breast', amount: 150, unit: 'g' }],
        tools: [
          { name: 'Frying pan', or: [{ name: 'Grill' }] },
          { name: 'Chef’s knife', or: [{ name: 'Ceramic knife' }] },
          { name: 'Lunch box' },
          { name: 'Baking paper' },
        ],
      })
    ).body.recipe;
    const box = recipe.tools.find((n: any) => n.name === 'Lunch box');
    expect(box).toMatchObject({ perServing: true, count: 1 });
    expect(
      recipe.tools.find((n: any) => n.name === 'Frying pan').options.map((o: any) => o.name),
    ).toEqual(['Frying pan', 'Grill']);

    // Two servings: two lunch boxes, still one pan. The pan is dirty: the grill will do.
    await b.post(`/api/food/kitchenware/${pan.id}/used`, { count: 1 });
    const meal = (
      await b.post('/api/food/meals', {
        date: '2026-10-02',
        time: '18:00',
        recipeId: recipe.id,
        servings: 2,
      })
    ).body.meal;
    expect(meal.tools.find((n: any) => n.name === 'Lunch box')).toMatchObject({
      count: 2,
      status: 'ready',
    });
    const cooking = meal.tools.find((n: any) => n.name === 'Frying pan');
    expect(cooking).toMatchObject({ count: 1, status: 'ready', using: grill.id });

    await b.post(`/api/food/meals/${meal.id}/done`, {});
    let tools = (await b.get('/api/food/kitchenware')).body.tools;
    const by = (id: string) => tools.find((x: any) => x.id === id);
    expect(by(grill.id)).toMatchObject({ dirty: 1 });
    expect(by(boxes.id)).toMatchObject({ dirty: 2, clean: 1 });
    expect(by(paper.id)).toMatchObject({ count: 9, dirty: 0 });
    expect(by(chef.id)).toMatchObject({ dirty: 1 });

    // The dishwasher takes the lunch boxes; the knife and the grill wait for a hand wash.
    tools = (await b.post('/api/food/kitchenware/wash', { how: 'machine' })).body.tools;
    expect(by(boxes.id)).toMatchObject({ washing: 2, dirty: 0 });
    expect(by(grill.id)).toMatchObject({ dirty: 1, washing: 0 });
    expect(by(chef.id)).toMatchObject({ dirty: 1, washing: 0 });

    // Reopening the meal gives the baking paper back.
    await b.post(`/api/food/meals/${meal.id}/reopen`, {});
    tools = (await b.get('/api/food/kitchenware')).body.tools;
    expect(by(paper.id).count).toBe(10);
    expect(by(kettle.id)).toMatchObject({ dirty: 0 });
  });
});
