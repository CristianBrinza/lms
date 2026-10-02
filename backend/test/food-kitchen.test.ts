import { describe, expect, it } from 'vitest';
import { setupTestApp } from './helpers';

const t = setupTestApp();

async function cook(email = 'ana@example.com', name = 'Ana') {
  const user = await t.createUser({ email, name });
  const b = t.browser();
  await b.login(email);
  return { user, b };
}

const NOW = new Date('2026-10-02T09:00:00');

describe('food: kitchen inventory', () => {
  it('opens an empty kitchen on the first visit, one per person', async () => {
    const { b, user } = await cook();
    const res = await b.get('/api/food/kitchen');
    expect(res.status).toBe(200);
    expect(res.body.products).toEqual([]);
    const { rows } = await t.db.query<{ household_id: string }>('SELECT household_id FROM users WHERE id = $1', [user.id]);
    expect(rows[0]!.household_id).toBeTruthy();
    await b.get('/api/food/kitchen');
    expect((await t.db.query('SELECT 1 FROM households')).rowCount).toBe(1);
  });

  it('needs a signed-in person', async () => {
    expect((await t.browser().get('/api/food/kitchen')).status).toBe(401);
  });

  it('adds stock by name with the built-in defaults', async () => {
    t.setNow(NOW);
    const { b } = await cook();
    const res = await b.post('/api/food/stock', { name: 'tomato', quantity: 2 });
    expect(res.status).toBe(201);
    expect(res.body.product).toMatchObject({ name: 'Tomatoes', icon: 'tomato', unit: 'pcs', category: 'produce', location: 'fridge', pieceSize: 120 });
    expect(res.body.lot).toMatchObject({ quantity: 2, location: 'fridge', expiresOn: '2026-10-09' });
    // The same item by another form of its name, and by its Romanian name.
    expect((await b.post('/api/food/stock', { name: 'Tomatoes', quantity: 1 })).body.product.id).toBe(res.body.product.id);
    expect((await b.post('/api/food/stock', { name: 'roșii', quantity: 1 })).body.product.id).toBe(res.body.product.id);
    const kitchen = await b.get('/api/food/kitchen');
    expect(kitchen.body.products).toHaveLength(1);
    expect(kitchen.body.products[0]).toMatchObject({ name: 'Tomatoes', total: 4 });
  });

  it('keeps each steak as its own piece and takes from the one you choose', async () => {
    t.setNow(NOW);
    const { b } = await cook();
    const big = await b.post('/api/food/stock', { name: 'Beef steak', quantity: 1.3, unit: 'kg', expiresOn: '2026-10-05' });
    const bigger = await b.post('/api/food/stock', { name: 'Beef steak', quantity: 2, unit: 'kg', expiresOn: '2026-10-04', location: 'freezer' });
    await b.post('/api/food/stock', { name: 'steak', quantity: 300, unit: 'g', expiresOn: '2026-10-03' });
    const productId = big.body.product.id;
    expect(bigger.body.product.id).toBe(productId);

    const kitchen = await b.get('/api/food/kitchen');
    const steak = kitchen.body.products[0];
    expect(steak).toMatchObject({ name: 'Beef steak', unit: 'g', total: 3600, nextExpiry: '2026-10-03' });
    expect(steak.lots.map((lot: any) => lot.quantity)).toEqual([300, 2000, 1300]);

    const used = await b.post('/api/food/stock/use', { productId, quantity: 300, unit: 'g', lotId: big.body.lot.id });
    expect(used.body.result).toMatchObject({ used: 300, shortfall: 0, lots: [{ lotId: big.body.lot.id, taken: 300, left: 1000 }] });

    const freezer = await b.get('/api/food/kitchen?location=freezer');
    expect(freezer.body.products[0].lots).toHaveLength(1);
    expect(freezer.body.products[0].total).toBe(2000);
  });

  it('uses stock first-expiring-first and reports what was missing', async () => {
    t.setNow(NOW);
    const { b } = await cook();
    const late = await b.post('/api/food/stock', { name: 'Milk', quantity: 1, unit: 'l', expiresOn: '2026-10-10' });
    const soon = await b.post('/api/food/stock', { name: 'Milk', quantity: 500, unit: 'ml', expiresOn: '2026-10-04' });
    const productId = late.body.product.id;

    const first = await b.post('/api/food/stock/use', { productId, quantity: 700, unit: 'ml' });
    expect(first.body.result.lots).toEqual([
      { lotId: soon.body.lot.id, taken: 500, left: 0 },
      { lotId: late.body.lot.id, taken: 200, left: 800 },
    ]);

    const more = await b.post('/api/food/stock/use', { productId, quantity: 1, unit: 'l' });
    expect(more.body.result).toMatchObject({ used: 800, shortfall: 200 });
    expect((await b.get('/api/food/kitchen')).body.products).toEqual([]);
  });

  it('counts pieces through their size: 240 g of tomatoes is two', async () => {
    const { b } = await cook();
    const res = await b.post('/api/food/stock', { name: 'Tomatoes', quantity: 5 });
    const used = await b.post('/api/food/stock/use', { productId: res.body.product.id, quantity: 240, unit: 'g' });
    expect(used.body.result.used).toBe(2);
  });

  it('refuses a unit that does not fit the item', async () => {
    const { b } = await cook();
    const eggs = await b.post('/api/food/stock', { name: 'Eggs', quantity: 10 });
    const res = await b.post('/api/food/stock/use', { productId: eggs.body.product.id, quantity: 1, unit: 'l' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.unit).toMatch(/can’t be converted/);
  });

  it('records waste and keeps a history', async () => {
    const { b } = await cook();
    const res = await b.post('/api/food/stock', { name: 'Lettuce', quantity: 1 });
    await b.post('/api/food/stock/use', { productId: res.body.product.id, quantity: 1, wasted: true });
    const detail = await b.get(`/api/food/products/${res.body.product.id}`);
    expect(detail.body.events.map((e: any) => [e.kind, e.delta, e.actor, e.via])).toEqual([
      ['wasted', -1, 'Ana', 'app'],
      ['added', 1, 'Ana', 'app'],
    ]);
  });

  it('moves, corrects and removes a lot', async () => {
    const { b } = await cook();
    const res = await b.post('/api/food/stock', { name: 'Chicken breast', quantity: 1, unit: 'kg' });
    const lotId = res.body.lot.id;
    const moved = await b.patch(`/api/food/lots/${lotId}`, { location: 'freezer', expiresOn: '2027-01-01' });
    expect(moved.body.lot).toMatchObject({ location: 'freezer', expiresOn: '2027-01-01' });
    const corrected = await b.patch(`/api/food/lots/${lotId}`, { quantity: 800, unit: 'g' });
    expect(corrected.body.lot.quantity).toBe(800);
    const opened = await b.patch(`/api/food/lots/${lotId}`, { opened: true });
    expect(opened.body.lot.openedAt).toBeTruthy();
    expect((await b.delete(`/api/food/lots/${lotId}`)).status).toBe(204);
    const detail = await b.get(`/api/food/products/${res.body.product.id}`);
    expect(detail.body.product.lots).toEqual([]);
    expect(detail.body.events.map((e: any) => e.kind)).toEqual(['adjusted', 'adjusted', 'moved', 'added']);
  });

  it('remembers prices per store as a price per kg', async () => {
    const { b } = await cook();
    await b.get('/api/food/kitchen');
    const store = await t.db.query<{ id: string }>(
      `INSERT INTO stores (id, household_id, name) SELECT gen_random_uuid(), household_id, 'Linella' FROM users WHERE email = 'ana@example.com' RETURNING id`,
    );
    const res = await b.post('/api/food/stock', { name: 'Cheese', quantity: 400, unit: 'g', price: 60, storeId: store.rows[0]!.id });
    const detail = await b.get(`/api/food/products/${res.body.product.id}`);
    expect(detail.body.prices).toEqual([expect.objectContaining({ storeName: 'Linella', price: 60, quantity: 400, unitPrice: 150 })]);
  });

  it('shows staples that run low, even at zero', async () => {
    const { b } = await cook();
    const created = await b.post('/api/food/products', { name: 'Eggs', minStock: 6 });
    expect(created.status).toBe(201);
    expect(created.body.product).toMatchObject({ unit: 'pcs', icon: 'egg', minStock: 6 });
    let kitchen = await b.get('/api/food/kitchen');
    expect(kitchen.body.products[0]).toMatchObject({ name: 'Eggs', total: 0, low: true });
    await b.post('/api/food/stock', { productId: created.body.product.id, quantity: 10 });
    kitchen = await b.get('/api/food/kitchen');
    expect(kitchen.body.products[0]).toMatchObject({ total: 10, low: false });
  });

  it('keeps product names unique and units stable while there is stock', async () => {
    const { b } = await cook();
    await b.post('/api/food/stock', { name: 'Rice', quantity: 1, unit: 'kg' });
    const twin = await b.post('/api/food/products', { name: 'rice' });
    expect(twin.status).toBe(409);
    const products = await b.get('/api/food/products?q=ric');
    expect(products.body.products.map((p: any) => p.name)).toEqual(['Rice']);
    const unit = await b.patch(`/api/food/products/${products.body.products[0].id}`, { unit: 'pcs' });
    expect(unit.status).toBe(409);
  });

  it('archiving clears the stock but a new purchase brings the item back', async () => {
    const { b } = await cook();
    const res = await b.post('/api/food/stock', { name: 'Bananas', quantity: 6 });
    expect((await b.delete(`/api/food/products/${res.body.product.id}`)).status).toBe(204);
    expect((await b.get('/api/food/kitchen')).body.products).toEqual([]);
    const again = await b.post('/api/food/stock', { name: 'banana', quantity: 3 });
    expect(again.body.product.id).toBe(res.body.product.id);
    expect((await b.get('/api/food/kitchen')).body.products[0].total).toBe(3);
  });

  it('keeps kitchens apart, and shares one when people are seated together', async () => {
    const ana = await cook('ana@example.com', 'Ana');
    const ion = await cook('ion@example.com', 'Ion');
    const res = await ana.b.post('/api/food/stock', { name: 'Cucumbers', quantity: 3 });
    const productId = res.body.product.id;
    expect((await ion.b.get('/api/food/kitchen')).body.products).toEqual([]);
    expect((await ion.b.get(`/api/food/products/${productId}`)).status).toBe(404);
    expect((await ion.b.post('/api/food/stock/use', { productId, quantity: 1 })).status).toBe(404);
    expect((await ion.b.patch(`/api/food/lots/${res.body.lot.id}`, { quantity: 0 })).status).toBe(404);

    await t.db.query('UPDATE users SET household_id = (SELECT household_id FROM users WHERE id = $1) WHERE id = $2', [ana.user.id, ion.user.id]);
    expect((await ion.b.get('/api/food/kitchen')).body.products[0]).toMatchObject({ name: 'Cucumbers', total: 3 });
  });

  it('validates input', async () => {
    const { b } = await cook();
    const res = await b.post('/api/food/stock', { quantity: -1, unit: 'bags' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields)).toEqual(expect.arrayContaining(['quantity', 'unit']));
    const nameless = await b.post('/api/food/stock', { quantity: 1 });
    expect(nameless.body.error.fields.name).toBe('Say which item');
    expect((await b.get('/api/food/kitchen?location=garage')).status).toBe(400);
    expect((await b.get('/api/food/products/not-an-id')).status).toBe(404);
  });
});
