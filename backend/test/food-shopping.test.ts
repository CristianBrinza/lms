import { describe, expect, it } from 'vitest';
import { setupTestApp } from './helpers';

const t = setupTestApp();

async function shopper(email = 'ana@example.com', name = 'Ana') {
  const user = await t.createUser({ email, name });
  const b = t.browser();
  await b.login(email);
  return { user, b };
}

const NOW = new Date('2026-10-02T09:00:00');

describe('food: stores and shopping', () => {
  it('manages stores with unique names', async () => {
    const { b } = await shopper();
    const linella = await b.post('/api/food/stores', { name: 'Linella', tone: 'cyan' });
    expect(linella.status).toBe(201);
    expect(linella.body.store).toMatchObject({ name: 'Linella', tone: 'cyan', sort: 0, open: 0, inCart: 0 });
    const metro = await b.post('/api/food/stores', { name: 'Metro' });
    expect(metro.body.store.sort).toBe(1);
    expect((await b.post('/api/food/stores', { name: 'linella' })).status).toBe(409);
    const renamed = await b.patch(`/api/food/stores/${metro.body.store.id}`, { name: 'Metro Cash & Carry', sort: 0 });
    expect(renamed.body.store.name).toBe('Metro Cash & Carry');
    expect((await b.get('/api/food/stores')).body.stores.map((s: any) => s.name)).toEqual(['Linella', 'Metro Cash & Carry']);
  });

  it('adds lines by name to a store, and tops up the same item', async () => {
    const { b } = await shopper();
    const metro = (await b.post('/api/food/stores', { name: 'Metro' })).body.store;
    const added = await b.post('/api/food/shopping/items', {
      items: [
        { name: 'tomatoes', amount: 2, storeId: metro.id },
        { name: 'Beef steak', amount: 1, unit: 'kg', storeId: metro.id },
        { name: 'Water', amount: 6, unit: 'pcs', storeId: metro.id },
        { name: 'Bread' },
      ],
    });
    expect(added.status).toBe(201);
    expect(added.body.items.map((i: any) => [i.name, i.amount, i.unit, i.icon, i.storeId])).toEqual([
      ['Tomatoes', 2, 'pcs', 'tomato', metro.id],
      ['Beef steak', 1, 'kg', 'steak', metro.id],
      ['Water', 6, 'pcs', 'water', metro.id],
      ['Bread', null, null, 'bread', null],
    ]);
    const more = await b.post('/api/food/shopping/items', { items: [{ name: 'Tomato', amount: 360, unit: 'g', storeId: metro.id }] });
    expect(more.body.items[0]).toMatchObject({ id: added.body.items[0].id, amount: 5 });

    const list = await b.get('/api/food/shopping');
    expect(list.body.items).toHaveLength(4);
    expect(list.body.stores[0]).toMatchObject({ name: 'Metro', open: 3 });
  });

  it('remembers the store an item is usually bought at', async () => {
    const { b } = await shopper();
    const linella = (await b.post('/api/food/stores', { name: 'Linella' })).body.store;
    const product = (await b.post('/api/food/products', { name: 'Milk', storeId: linella.id })).body.product;
    const added = await b.post('/api/food/shopping/items', { items: [{ productId: product.id, amount: 2, unit: 'l' }] });
    expect(added.body.items[0].storeId).toBe(linella.id);
  });

  it('checks out the cart into the kitchen with prices, and keeps the rest on the list', async () => {
    t.setNow(NOW);
    const { b } = await shopper();
    const metro = (await b.post('/api/food/stores', { name: 'Metro' })).body.store;
    const items = (
      await b.post('/api/food/shopping/items', {
        items: [
          { name: 'Beef steak', amount: 1.3, unit: 'kg', storeId: metro.id },
          { name: 'Tomatoes', amount: 4, storeId: metro.id },
          { name: 'Bread', storeId: metro.id },
          { name: 'Chips', storeId: metro.id },
        ],
      })
    ).body.items;
    const [steak, tomatoes, bread, chips] = items;
    await b.patch(`/api/food/shopping/items/${steak.id}`, { checked: true, price: 260 });
    await b.patch(`/api/food/shopping/items/${tomatoes.id}`, { checked: true });
    await b.patch(`/api/food/shopping/items/${bread.id}`, { checked: true, price: 12.5 });
    await b.patch(`/api/food/shopping/items/${chips.id}`, { checked: true, price: 30 });

    const empty = await b.post('/api/food/shopping/checkout', { storeId: null, lines: [] });
    expect(empty.status).toBe(409);

    const done = await b.post('/api/food/shopping/checkout', {
      storeId: metro.id,
      lines: [
        { id: tomatoes.id, price: 38, amount: 5 },
        { id: steak.id, expiresOn: '2026-10-04', location: 'freezer' },
      ],
    });
    expect(done.status).toBe(201);
    expect(done.body.trip).toMatchObject({ storeName: 'Metro', itemCount: 4, total: 340.5 });
    // Chips are counted in grams with no piece size: bought, but not stocked without an amount.
    expect(done.body).toMatchObject({ stocked: 3, notStocked: ['Chips'] });

    const kitchen = (await b.get('/api/food/kitchen')).body.products;
    const byName = Object.fromEntries(kitchen.map((p: any) => [p.name, p]));
    expect(byName['Beef steak'].lots[0]).toMatchObject({ quantity: 1300, location: 'freezer', expiresOn: '2026-10-04', price: 260, storeName: 'Metro' });
    expect(byName['Tomatoes']).toMatchObject({ total: 5 });
    expect(byName['Tomatoes'].lots[0]).toMatchObject({ price: 38, expiresOn: '2026-10-09' });
    expect(byName['Bread']).toMatchObject({ total: 1 });

    expect((await b.get('/api/food/shopping')).body.items).toEqual([]);
    const trips = await b.get('/api/food/shopping/trips');
    expect(trips.body.trips).toHaveLength(1);
  });

  it('uses the last price to estimate the next shop', async () => {
    const { b } = await shopper();
    const metro = (await b.post('/api/food/stores', { name: 'Metro' })).body.store;
    const first = (await b.post('/api/food/shopping/items', { items: [{ name: 'Cheese', amount: 400, unit: 'g', storeId: metro.id }] })).body.items[0];
    await b.patch(`/api/food/shopping/items/${first.id}`, { checked: true, price: 60 });
    await b.post('/api/food/shopping/checkout', { storeId: metro.id });
    const next = (await b.post('/api/food/shopping/items', { items: [{ name: 'Cheese', amount: 1, unit: 'kg', storeId: metro.id }] })).body.items[0];
    expect(next.lastPrice).toMatchObject({ price: 60, storeName: 'Metro' });
    expect(next.estimate).toBe(150);
  });

  it('lets a finished trip be corrected later, and the kitchen follows', async () => {
    const { b } = await shopper();
    const metro = (await b.post('/api/food/stores', { name: 'Metro' })).body.store;
    const line = (await b.post('/api/food/shopping/items', { items: [{ name: 'Rice', amount: 1, unit: 'kg', storeId: metro.id }] })).body.items[0];
    await b.patch(`/api/food/shopping/items/${line.id}`, { checked: true, price: 25 });
    const { trip } = (await b.post('/api/food/shopping/checkout', { storeId: metro.id })).body;

    const rice = (await b.get('/api/food/kitchen')).body.products[0];
    await b.post('/api/food/stock/use', { productId: rice.id, quantity: 200, unit: 'g' });

    const fixed = await b.patch(`/api/food/shopping/trips/${trip.id}/items/${line.id}`, { price: 32, amount: 2, unit: 'kg' });
    expect(fixed.status).toBe(200);
    expect(fixed.body.trip.total).toBe(32);
    const after = (await b.get(`/api/food/products/${rice.id}`)).body.product;
    expect(after.lots[0]).toMatchObject({ price: 32, initialQuantity: 2000, quantity: 1800 });

    expect((await b.patch(`/api/food/shopping/items/${line.id}`, { checked: false })).status).toBe(409);
  });

  it('removing a store moves its open lines to any store', async () => {
    const { b } = await shopper();
    const metro = (await b.post('/api/food/stores', { name: 'Metro' })).body.store;
    await b.post('/api/food/shopping/items', { items: [{ name: 'Eggs', amount: 10, storeId: metro.id }] });
    expect((await b.delete(`/api/food/stores/${metro.id}`)).status).toBe(204);
    expect((await b.get('/api/food/shopping')).body.items[0].storeId).toBeNull();
  });

  it('keeps lists private to the kitchen', async () => {
    const ana = await shopper('ana@example.com', 'Ana');
    const ion = await shopper('ion@example.com', 'Ion');
    const store = (await ana.b.post('/api/food/stores', { name: 'Linella' })).body.store;
    const line = (await ana.b.post('/api/food/shopping/items', { items: [{ name: 'Eggs' }] })).body.items[0];
    expect((await ion.b.get('/api/food/shopping')).body.items).toEqual([]);
    expect((await ion.b.patch(`/api/food/shopping/items/${line.id}`, { checked: true })).status).toBe(404);
    expect((await ion.b.post('/api/food/shopping/items', { items: [{ name: 'Eggs', storeId: store.id }] })).status).toBe(400);
    expect((await ion.b.post('/api/food/shopping/checkout', { storeId: store.id })).status).toBe(400);
  });
});
