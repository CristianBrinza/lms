import { describe, expect, it } from 'vitest';
import { setupTestApp } from './helpers';

const t = setupTestApp();

async function person(email: string, name: string) {
  const user = await t.createUser({ email, name });
  const b = t.browser();
  await b.login(email);
  return { user, b };
}

describe('the priority buy list', () => {
  it('keeps things in the order they matter, and what was bought below', async () => {
    const { b } = await person('ana@example.com', 'Ana');
    expect((await b.get('/api/wishlist')).body).toMatchObject({ items: [], categories: [] });

    const vacuum = await b.post('/api/wishlist', {
      name: 'Cordless vacuum',
      price: 3500,
      category: 'Home',
      url: 'https://example.com/vacuum',
    });
    expect(vacuum.status).toBe(201);
    expect(vacuum.body.item).toMatchObject({
      name: 'Cordless vacuum',
      price: 3500,
      currency: 'MDL',
      urgency: 'soon',
      status: 'wanted',
      shared: true,
      mine: true,
    });
    await b.post('/api/wishlist', { name: 'Monitor', price: 4200, category: 'Tech' });
    const chair = await b.post('/api/wishlist', { name: 'Desk chair', urgency: 'now', top: true });

    let list = (await b.get('/api/wishlist')).body;
    expect(list.items.map((w: any) => w.name)).toEqual(['Desk chair', 'Cordless vacuum', 'Monitor']);
    expect(list.categories).toEqual(['Home', 'Tech']);

    // Reordered by hand.
    const ids = list.items.map((w: any) => w.id);
    list = (await b.put('/api/wishlist/order', { ids: [ids[2], ids[0], ids[1]] })).body;
    expect(list.items.map((w: any) => w.name)).toEqual(['Monitor', 'Desk chair', 'Cordless vacuum']);

    // Bought: today, at the expected price unless told otherwise; it drops below the wanted ones.
    const done = await b.patch(`/api/wishlist/${vacuum.body.item.id}`, { status: 'bought' });
    expect(done.body.item).toMatchObject({ status: 'bought', boughtPrice: 3500 });
    expect(done.body.item.boughtOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    list = (await b.get('/api/wishlist')).body;
    expect(list.items.map((w: any) => w.status)).toEqual(['wanted', 'wanted', 'bought']);

    // Back on the list: last, without the purchase.
    const back = await b.patch(`/api/wishlist/${vacuum.body.item.id}`, { status: 'wanted' });
    expect(back.body.item).toMatchObject({ status: 'wanted', boughtOn: null, boughtPrice: null });

    expect((await b.post('/api/wishlist', { name: 'x', url: 'not a link' })).status).toBe(400);
    expect((await b.delete(`/api/wishlist/${chair.body.item.id}`)).status).toBe(204);
    expect((await b.get('/api/wishlist')).body.items).toHaveLength(2);
  });

  it('another household never sees the list', async () => {
    const ana = await person('ana@example.com', 'Ana');
    const ion = await person('ion@example.com', 'Ion');
    const secret = await ana.b.post('/api/wishlist', { name: 'A gift for Ion', shared: false });
    expect(secret.body.item.shared).toBe(false);
    // Someone outside the household never sees Ana's list.
    expect((await ion.b.get('/api/wishlist')).body.items).toEqual([]);
    expect((await ion.b.patch(`/api/wishlist/${secret.body.item.id}`, { name: 'x' })).status).toBe(404);
  });
});
