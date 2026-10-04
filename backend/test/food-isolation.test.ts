import { describe, expect, it } from 'vitest';
import { setupTestApp } from './helpers';

const t = setupTestApp();

/**
 * One kitchen can never reach another's: every id from Ana's kitchen, used by Bob (another
 * household) in a path or inside a body, is refused, and Ana's data stays as it was.
 */
describe('food: kitchens are separate', () => {
  it('refuses every id from another kitchen, in paths and in bodies', async () => {
    await t.createUser({ email: 'ana@example.com', name: 'Ana' });
    await t.createUser({ email: 'bob@example.com', name: 'Bob' });
    const ana = t.browser();
    await ana.login('ana@example.com');
    const bob = t.browser();
    await bob.login('bob@example.com');

    // Ana's kitchen: one of everything.
    const store = (await ana.post('/api/food/stores', { name: 'Linella' })).body.store;
    const milk = (await ana.post('/api/food/stock', { name: 'Milk', quantity: 1000, unit: 'ml' }))
      .body;
    const pot = (await ana.post('/api/food/kitchenware', { name: 'Big pot' })).body.tool;
    const recipe = (
      await ana.post('/api/food/recipes', {
        title: 'Latte',
        ingredients: [{ name: 'Milk', amount: 200, unit: 'ml', or: [{ name: 'Whipped cream' }] }],
        tools: [{ name: 'Big pot' }],
      })
    ).body.recipe;
    const meal = (
      await ana.post('/api/food/meals', {
        date: '2026-10-05',
        time: '09:00',
        recipeId: recipe.id,
        parts: [{ title: 'Coffee', kind: 'drink' }],
      })
    ).body.meal;
    const [line] = (
      await ana.post('/api/food/shopping/items', { items: [{ name: 'Bread', storeId: store.id }] })
    ).body.items;
    await ana.patch(`/api/food/shopping/items/${line.id}`, { checked: true });
    const trip = (await ana.post('/api/food/shopping/checkout', { storeId: store.id, lines: [] }))
      .body.trip;
    const tripLine = (await ana.get(`/api/food/shopping/trips/${trip.id}`)).body.items[0];
    const anaUser = (await ana.get('/api/me')).body.user;
    const restriction = (
      await ana.post('/api/food/restrictions', { userId: anaUser.id, kind: 'avoid', name: 'Honey' })
    ).body.restriction;
    const [line2] = (await ana.post('/api/food/shopping/items', { items: [{ name: 'Cheese' }] }))
      .body.items;

    await bob.get('/api/food/kitchen'); // Bob's own kitchen exists.
    const refused = (status: number) => status === 404 || status === 400 || status === 403;
    const attempts: Array<[string, Promise<{ status: number }>]> = [
      ['read Ana’s product', bob.get(`/api/food/products/${milk.product.id}`)],
      [
        'change Ana’s product',
        bob.patch(`/api/food/products/${milk.product.id}`, { name: 'Mine' }),
      ],
      ['set Ana’s level', bob.put(`/api/food/products/${milk.product.id}/level`, { level: 'out' })],
      ['delete Ana’s product', bob.delete(`/api/food/products/${milk.product.id}`)],
      [
        'add stock to Ana’s product',
        bob.post('/api/food/stock', { productId: milk.product.id, quantity: 1 }),
      ],
      [
        'use Ana’s stock',
        bob.post('/api/food/stock/use', { productId: milk.product.id, quantity: 100, unit: 'ml' }),
      ],
      [
        'use Ana’s lot from his milk',
        bob
          .post('/api/food/stock', { name: 'Milk', quantity: 500, unit: 'ml' })
          .then((r) =>
            bob.post('/api/food/stock/use', {
              productId: r.body.product.id,
              lotId: milk.lot.id,
              quantity: 10,
              unit: 'ml',
            }),
          ),
      ],
      ['change Ana’s lot', bob.patch(`/api/food/lots/${milk.lot.id}`, { quantity: 1 })],
      [
        'pour from Ana’s lot',
        bob.post(`/api/food/lots/${milk.lot.id}/pour`, { quantity: 100, unit: 'ml' }),
      ],
      ['delete Ana’s lot', bob.delete(`/api/food/lots/${milk.lot.id}`)],
      ['change Ana’s store', bob.patch(`/api/food/stores/${store.id}`, { name: 'x' })],
      ['delete Ana’s store', bob.delete(`/api/food/stores/${store.id}`)],
      [
        'a line in Ana’s store',
        bob.post('/api/food/shopping/items', { items: [{ name: 'Eggs', storeId: store.id }] }),
      ],
      ['change Ana’s line', bob.patch(`/api/food/shopping/items/${line2.id}`, { checked: true })],
      ['delete Ana’s line', bob.delete(`/api/food/shopping/items/${line2.id}`)],
      [
        'check out Ana’s store',
        bob.post('/api/food/shopping/checkout', { storeId: store.id, lines: [] }),
      ],
      ['read Ana’s trip', bob.get(`/api/food/shopping/trips/${trip.id}`)],
      [
        'change Ana’s trip line',
        bob.patch(`/api/food/shopping/trips/${trip.id}/items/${tripLine.id}`, { price: 1 }),
      ],
      ['read Ana’s recipe', bob.get(`/api/food/recipes/${recipe.id}`)],
      ['change Ana’s recipe', bob.patch(`/api/food/recipes/${recipe.id}`, { title: 'x' })],
      ['cook Ana’s recipe', bob.post(`/api/food/recipes/${recipe.id}/cook`, {})],
      ['delete Ana’s recipe', bob.delete(`/api/food/recipes/${recipe.id}`)],
      [
        'plan with Ana’s recipe',
        bob.post('/api/food/meals', { date: '2026-10-05', recipeId: recipe.id }),
      ],
      [
        'a part from Ana’s recipe',
        bob.post('/api/food/meals', {
          date: '2026-10-05',
          title: 'x',
          parts: [{ recipeId: recipe.id }],
        }),
      ],
      ['read Ana’s meal', bob.get(`/api/food/meals/${meal.id}`)],
      ['change Ana’s meal', bob.patch(`/api/food/meals/${meal.id}`, { servings: 9 })],
      ['Ana’s meal lines', bob.put(`/api/food/meals/${meal.id}/ingredients`, { ingredients: [] })],
      [
        'pick in Ana’s meal',
        bob.put(`/api/food/meals/${meal.id}/ingredients/${meal.ingredients[0].id}/choice`, {
          choice: 1,
        }),
      ],
      ['add to Ana’s meal', bob.post(`/api/food/meals/${meal.id}/parts`, { title: 'x' })],
      [
        'change Ana’s part',
        bob.patch(`/api/food/meals/${meal.id}/parts/${meal.parts[0].id}`, { servings: 5 }),
      ],
      ['remove Ana’s part', bob.delete(`/api/food/meals/${meal.id}/parts/${meal.parts[0].id}`)],
      ['eat Ana’s meal', bob.post(`/api/food/meals/${meal.id}/done`, {})],
      ['eat Ana’s meal out', bob.post(`/api/food/meals/${meal.id}/out`, { kind: 'restaurant' })],
      ['reopen Ana’s meal', bob.post(`/api/food/meals/${meal.id}/reopen`, {})],
      ['delete Ana’s meal', bob.delete(`/api/food/meals/${meal.id}`)],
      [
        'a meal line on Ana’s lot',
        bob.post('/api/food/meals', {
          date: '2026-10-05',
          title: 'x',
          ingredients: [{ name: 'Milk', amount: 1, unit: 'ml', lotId: milk.lot.id }],
        }),
      ],
      [
        'a recipe line on Ana’s product',
        bob.post('/api/food/recipes', {
          title: 'x',
          ingredients: [{ productId: milk.product.id, name: 'Milk' }],
        }),
      ],
      [
        'a recipe with Ana’s pot',
        bob.post('/api/food/recipes', { title: 'x', tools: [{ toolId: pot.id }] }),
      ],
      [
        'a recipe with Ana’s pot as the "or"',
        bob.post('/api/food/recipes', {
          title: 'x',
          tools: [{ name: 'Pan', or: [{ toolId: pot.id }] }],
        }),
      ],
      ['change Ana’s pot', bob.patch(`/api/food/kitchenware/${pot.id}`, { count: 9 })],
      ['dirty Ana’s pot', bob.post(`/api/food/kitchenware/${pot.id}/used`, { count: 1 })],
      [
        'wash Ana’s pot',
        bob.post('/api/food/kitchenware/wash', { how: 'hand', toolIds: [pot.id] }),
      ],
      ['delete Ana’s pot', bob.delete(`/api/food/kitchenware/${pot.id}`)],
      [
        'a restriction for Ana',
        bob.post('/api/food/restrictions', { userId: anaUser.id, kind: 'allergy', name: 'Nuts' }),
      ],
      ['delete Ana’s restriction', bob.delete(`/api/food/restrictions/${restriction.id}`)],
      [
        'a restriction on Ana’s product',
        bob.post('/api/food/restrictions', {
          userId: (await bob.get('/api/me')).body.user.id,
          kind: 'avoid',
          productId: milk.product.id,
        }),
      ],
    ];
    const leaks: string[] = [];
    for (const [name, attempt] of attempts) {
      const { status } = await attempt;
      if (!refused(status)) leaks.push(`${name}: ${status}`);
    }
    // The wash call answers 200 with Bob's own (empty) list; it must not have touched Ana's pot.
    expect(leaks.filter((l) => !l.startsWith('wash Ana’s pot'))).toEqual([]);

    // Ana's kitchen is as she left it.
    const kitchen = (await ana.get('/api/food/kitchen')).body.products;
    expect(kitchen.find((p: any) => p.id === milk.product.id)).toMatchObject({
      name: 'Milk',
      total: 1000,
    });
    expect((await ana.get(`/api/food/meals/${meal.id}`)).body.meal).toMatchObject({
      status: 'planned',
      servings: 2,
    });
    expect(
      (await ana.get('/api/food/kitchenware')).body.tools.find((x: any) => x.id === pot.id),
    ).toMatchObject({ count: 1, dirty: 0 });
    expect((await ana.get(`/api/food/recipes/${recipe.id}`)).body.recipe.title).toBe('Latte');
    expect(
      (await ana.get('/api/food/shopping')).body.items.find((i: any) => i.id === line2.id),
    ).toMatchObject({ checked: false });
    // Bob's lists show nothing of Ana's.
    const bobKitchen = (await bob.get('/api/food/kitchen')).body.products;
    expect(bobKitchen.some((p: any) => p.id === milk.product.id)).toBe(false);
    expect((await bob.get('/api/food/kitchenware')).body.tools).toEqual([]);
    expect((await bob.get('/api/food/shopping/trips')).body.trips).toEqual([]);
  });
});
