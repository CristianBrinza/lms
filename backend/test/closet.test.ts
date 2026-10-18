import { describe, expect, it } from 'vitest';
import { hasAlpha } from '../src/modules/closet/photos';
import { findByPath } from '../src/modules/closet/places';
import { areaOf, toolArea } from '../src/modules/live/publish';
import { tokenMayAccess } from '../src/modules/tokens';
import { APP_URL, setupTestApp } from './helpers';

const t = setupTestApp();

/** A 1×1 PNG with an alpha channel (a cut-out), and one without (a photo with its background). */
const CUTOUT =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PHOTO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

async function person(email: string, name: string) {
  const user = await t.createUser({ email, name });
  const b = t.browser();
  await b.login(email);
  return { user, b };
}

/** Ana and Ion share a home; Eva lives elsewhere. */
async function family() {
  const ana = await person('ana@example.com', 'Ana');
  const ion = await person('ion@example.com', 'Ion');
  await ana.b.get('/api/closet');
  const { rows } = await t.db.query<{ household_id: string }>(
    'SELECT household_id FROM users WHERE id = $1',
    [ana.user.id],
  );
  await t.db.query('UPDATE users SET household_id = $2 WHERE id = $1', [
    ion.user.id,
    rows[0]!.household_id,
  ]);
  return { ana, ion };
}

async function raw(b: ReturnType<typeof t.browser>, path: string, headers: Record<string, string> = {}) {
  return t.app.request(path, {
    headers: {
      origin: APP_URL,
      cookie: [...b.jar].map(([name, value]) => `${name}=${value}`).join('; '),
      ...headers,
    },
  });
}

describe('closet: pieces', () => {
  it('adds, finds, changes and deletes pieces; only name and category are needed', async () => {
    const { b } = await person('ana@example.com', 'Ana');
    expect((await b.get('/api/closet')).body).toMatchObject({ items: [], places: [], currency: 'MDL' });

    const shirt = await b.post('/api/closet/items', {
      name: 'Navy oxford shirt',
      category: 'tops',
      subcategory: 'shirt',
      colors: ['navy', 'white', 'navy'],
      materials: [
        { material: 'cotton', percent: 97 },
        { material: 'elastane', percent: 3 },
      ],
      brand: 'Uniqlo',
      size: 'M',
      sizeSystem: 'letter',
      price: 600,
      seasons: ['spring', 'autumn'],
      condition: 'good',
      issues: ['pilling'],
      tags: ['work'],
    });
    expect(shirt.status).toBe(201);
    expect(shirt.body.item).toMatchObject({
      name: 'Navy oxford shirt',
      colors: ['navy', 'white'],
      currency: 'MDL',
      status: 'clean',
      wears: 0,
      costPerWear: null,
      needsDetails: false,
      cover: null,
    });
    const quick = await b.post('/api/closet/items', { category: 'shoes' });
    expect(quick.body.item).toMatchObject({ name: '', needsDetails: true });

    expect((await b.get('/api/closet/items?q=oxford')).body.items).toHaveLength(1);
    expect((await b.get('/api/closet/items?category=shoes')).body.items).toHaveLength(1);
    expect((await b.get('/api/closet/items?color=navy')).body.items).toHaveLength(1);
    expect((await b.get('/api/closet/items?needsDetails=true')).body.items).toHaveLength(1);
    expect((await b.get('/api/closet/items?season=autumn')).body.items).toHaveLength(1);

    // Pages: newest first, then where the next one starts.
    const first = (await b.get('/api/closet/items?limit=1')).body;
    expect(first.items[0].id).toBe(quick.body.item.id);
    const second = (await b.get(`/api/closet/items?limit=1&cursor=${encodeURIComponent(first.next)}`)).body;
    expect(second.items[0].id).toBe(shirt.body.item.id);

    const id = shirt.body.item.id;
    const lent = await b.patch(`/api/closet/items/${id}`, { status: 'lent', lentTo: 'Ion' });
    expect(lent.body.item).toMatchObject({ status: 'lent', lentTo: 'Ion' });
    const back = await b.patch(`/api/closet/items/${id}`, { status: 'clean' });
    expect(back.body.item.lentTo).toBe('');
    // A new category drops a kind that isn't its own.
    expect((await b.patch(`/api/closet/items/${id}`, { category: 'bottoms' })).body.item.subcategory).toBe('');

    expect((await b.post('/api/closet/items', { category: 'hats' })).status).toBe(400);
    expect((await b.post('/api/closet/items', { category: 'tops', subcategory: 'jeans' })).status).toBe(400);
    expect(
      (
        await b.post('/api/closet/items', {
          category: 'tops',
          materials: [
            { material: 'cotton', percent: 80 },
            { material: 'wool', percent: 40 },
          ],
        })
      ).status,
    ).toBe(400);
    expect((await b.patch(`/api/closet/items/${id}`, {})).status).toBe(400);

    const care = await b.patch(`/api/closet/items/${id}`, {
      care: {
        wash: { method: 'machine', temp: 30, gentle: 1 },
        bleach: 'none',
        tumble: 'none',
        dry: ['flat'],
        iron: 'low',
        professional: { method: 'P' },
      },
      storageAdvice: 'Fold it.',
      madeIn: 'bd',
    });
    expect(care.body.item).toMatchObject({ care: { wash: { temp: 30 } }, madeIn: 'BD' });
    expect((await b.patch(`/api/closet/items/${id}`, { care: { wash: { method: 'machine', temp: 35 } } })).status).toBe(400);

    expect((await b.delete(`/api/closet/items/${id}`)).status).toBe(204);
    expect((await b.get(`/api/closet/items/${id}`)).status).toBe(404);
    expect((await b.get('/api/closet/items/not-an-id')).status).toBe(404);
  });

  it('keeps each person’s closet apart, shows the household’s, and nothing to another home', async () => {
    const { ana, ion } = await family();
    const eva = await person('eva@example.com', 'Eva');
    const mine = (await ana.b.post('/api/closet/items', { name: 'Red dress', category: 'dresses' })).body.item;
    // Ana adds a piece to Ion's closet (the household keeps each other's).
    const his = (
      await ana.b.post('/api/closet/items', { name: 'Grey hoodie', category: 'tops', ownerId: ion.user.id })
    ).body.item;
    expect(his.ownerId).toBe(ion.user.id);

    expect((await ana.b.get('/api/closet')).body.items.map((i: any) => i.name)).toEqual(['Red dress']);
    expect((await ion.b.get('/api/closet')).body.items.map((i: any) => i.name)).toEqual(['Grey hoodie']);
    expect((await ion.b.get(`/api/closet?owner=${ana.user.id}`)).body.items).toHaveLength(1);
    expect((await ion.b.get('/api/closet?owner=all')).body.items).toHaveLength(2);
    expect((await ion.b.get('/api/closet')).body.people).toHaveLength(2);

    expect((await eva.b.get('/api/closet?owner=all')).body.items).toEqual([]);
    expect((await eva.b.get(`/api/closet?owner=${ana.user.id}`)).status).toBe(400);
    expect((await eva.b.get(`/api/closet/items/${mine.id}`)).status).toBe(404);
    expect((await eva.b.patch(`/api/closet/items/${mine.id}`, { name: 'x' })).status).toBe(404);
    expect((await eva.b.delete(`/api/closet/items/${mine.id}`)).status).toBe(404);
    expect((await eva.b.post('/api/closet/items', { category: 'tops', ownerId: ana.user.id })).status).toBe(400);
    expect((await eva.b.post(`/api/closet/items/${mine.id}/photos`, { image: PHOTO })).status).toBe(404);
  });
});

describe('closet: photos', () => {
  it('keeps photos and the label, flags chat photos for a cut-out, and keeps the original', async () => {
    const { ana, ion } = await family();
    const { item } = (await ana.b.post('/api/closet/items', { name: 'Wool coat', category: 'outerwear' })).body;

    const front = await ana.b.post(`/api/closet/items/${item.id}/photos`, { image: PHOTO });
    expect(front.status).toBe(201);
    expect(front.body.photo).toMatchObject({ kind: 'front', width: 1, height: 1, hasAlpha: false, needsCutout: true });
    expect(front.body.storage).toMatchObject({ warn: false, full: false });
    const label = await ana.b.post(`/api/closet/items/${item.id}/photos`, { image: PHOTO.split(',')[1], kind: 'label' });
    expect(label.body.photo).toMatchObject({ kind: 'label', needsCutout: false });

    let detail = (await ion.b.get(`/api/closet/items/${item.id}`)).body;
    expect(detail.photos.map((p: any) => p.kind)).toEqual(['front', 'label']);
    expect(detail.item).toMatchObject({ photos: 2, needsCutout: true, hasLabel: true });
    expect(detail.item.cover.id).toBe(front.body.photo.id);

    // The cut-out from the browser takes the original's place; the original is kept.
    const cut = await ana.b.post(`/api/closet/items/${item.id}/photos`, {
      image: CUTOUT,
      replaces: front.body.photo.id,
    });
    expect(cut.body.photo).toMatchObject({ kind: 'front', hasAlpha: true, needsCutout: false, cutoutOf: front.body.photo.id });
    detail = (await ana.b.get(`/api/closet/items/${item.id}`)).body;
    expect(detail.photos.map((p: any) => p.id)).toEqual([cut.body.photo.id, label.body.photo.id]);
    expect(detail.originals.map((p: any) => p.id)).toEqual([front.body.photo.id]);
    expect(detail.item).toMatchObject({ needsCutout: false, cover: { id: cut.body.photo.id, hasAlpha: true } });

    // Served to the household by ETag; never to anyone else.
    const picture = await raw(ion.b, detail.item.cover.thumb);
    expect(picture.status).toBe(200);
    expect(picture.headers.get('cache-control')).toContain('immutable');
    expect((await raw(ion.b, detail.item.cover.thumb, { 'if-none-match': picture.headers.get('etag')! })).status).toBe(304);
    const eva = await person('eva@example.com', 'Eva');
    expect((await raw(eva.b, detail.item.cover.full)).status).toBe(404);

    // Deleting the cut-out brings the original back.
    expect((await ana.b.delete(`/api/closet/photos/${cut.body.photo.id}`)).status).toBe(204);
    detail = (await ana.b.get(`/api/closet/items/${item.id}`)).body;
    expect(detail.photos.map((p: any) => p.id)).toEqual([front.body.photo.id, label.body.photo.id]);
    expect(detail.originals).toEqual([]);

    expect((await ana.b.patch(`/api/closet/photos/${front.body.photo.id}`, { needsCutout: false })).body.photo.needsCutout).toBe(false);
    expect((await ana.b.post(`/api/closet/items/${item.id}/photos`, { image: 'data:image/png;base64,aGVsbG8gd29ybGQh' })).status).toBe(400);
  });

  it('reads transparency from the bytes', () => {
    expect(hasAlpha(Buffer.from(CUTOUT.split(',')[1]!, 'base64'))).toBe(true);
    expect(hasAlpha(Buffer.from(PHOTO.split(',')[1]!, 'base64'))).toBe(false);
  });
});

describe('closet: places', () => {
  it('builds rooms, furniture and sections, moves pieces and finds places by words', async () => {
    const { b } = await person('ana@example.com', 'Ana');
    const room = (await b.post('/api/closet/places', { kind: 'room', name: 'Bedroom' })).body.place;
    const wardrobe = (await b.post('/api/closet/places', { kind: 'furniture', name: 'Wardrobe', parentId: room.id })).body.place;
    const shelf2 = (
      await b.post('/api/closet/places', { kind: 'shelf', number: 2, side: 'left', parentId: wardrobe.id })
    ).body.place;
    const rail = (await b.post('/api/closet/places', { kind: 'rail', parentId: wardrobe.id })).body.place;
    expect(rail.position).toBe(1);

    expect((await b.post('/api/closet/places', { kind: 'room', name: 'X', parentId: room.id })).status).toBe(400);
    expect((await b.post('/api/closet/places', { kind: 'furniture', name: 'Box', parentId: shelf2.id })).status).toBe(400);
    expect((await b.post('/api/closet/places', { kind: 'room' })).status).toBe(400);
    expect((await b.patch(`/api/closet/places/${wardrobe.id}`, { parentId: shelf2.id })).status).toBe(400);

    // A piece put on the rail hangs; on the shelf it's folded.
    const coat = (await b.post('/api/closet/items', { name: 'Coat', category: 'outerwear', placeId: rail.id })).body.item;
    expect(coat).toMatchObject({ placeId: rail.id, storage: 'hanging' });
    const jumper = (await b.post('/api/closet/items', { name: 'Jumper', category: 'tops' })).body.item;
    const moved = await b.post('/api/closet/items/bulk', { ids: [jumper.id], patch: { placeId: shelf2.id } });
    expect(moved.body.items[0]).toMatchObject({ placeId: shelf2.id, storage: 'folded' });

    const bag = (await b.post('/api/closet/places', { kind: 'vacuum_bag', parentId: room.id })).body.place;
    expect(bag.kind).toBe('vacuum_bag');
    const winter = (await b.post('/api/closet/items', { name: 'Winter duvet', category: 'tops', placeId: bag.id })).body.item;
    expect(winter.storage).toBe('vacuum');

    const all = (await b.get('/api/closet/places')).body.places;
    expect(all.find((p: any) => p.id === shelf2.id).items).toBe(1);
    expect((await b.get(`/api/closet/items?placeId=${wardrobe.id}`)).body.items).toHaveLength(2);
    expect(findByPath(all, 'Bedroom > Wardrobe > Shelf 2 left')?.id).toBe(shelf2.id);
    expect(findByPath(all, 'bedroom › wardrobe › rail')?.id).toBe(rail.id);
    expect(findByPath(all, 'Kitchen')).toBeNull();

    await b.delete(`/api/closet/places/${bag.id}`);
    // Removing the wardrobe takes its sections; the pieces just lose their place.
    expect((await b.delete(`/api/closet/places/${wardrobe.id}`)).status).toBe(204);
    expect((await b.get('/api/closet/places')).body.places.map((p: any) => p.name)).toEqual(['Bedroom']);
    expect((await b.get(`/api/closet/items/${coat.id}`)).body.item.placeId).toBeNull();
  });
});

describe('closet: worn, looks and the laundry', () => {
  it('counts wears and cost per wear, and never loses a look when a piece is deleted', async () => {
    const { b } = await person('ana@example.com', 'Ana');
    t.setNow(new Date('2026-10-18T09:00:00'));
    const jeans = (await b.post('/api/closet/items', { name: 'Jeans', category: 'bottoms', price: 900 })).body.item;
    const tee = (await b.post('/api/closet/items', { name: 'White tee', category: 'tops', price: 200 })).body.item;

    await b.post(`/api/closet/items/${jeans.id}/worn`, {});
    // Twice the same day counts once; the day keeps both pieces.
    await b.post(`/api/closet/items/${jeans.id}/worn`, {});
    await b.post('/api/closet/items/worn', { itemIds: [tee.id] });
    await b.post(`/api/closet/items/${jeans.id}/worn`, { wornOn: '2026-10-15' });
    const day = (await b.get('/api/closet/wears?from=2026-10-18&to=2026-10-18')).body;
    expect(day.wears).toHaveLength(1);
    expect(day.wears[0].itemIds.sort()).toEqual([jeans.id, tee.id].sort());

    const detail = (await b.get(`/api/closet/items/${jeans.id}`)).body;
    expect(detail.item).toMatchObject({ wears: 2, lastWorn: '2026-10-18', costPerWear: 450 });
    expect(detail.worn).toEqual(['2026-10-18', '2026-10-15']);

    const look = (await b.post('/api/closet/looks', { name: 'Easy Sunday', itemIds: [jeans.id, tee.id] })).body.look;
    expect(look.canvas.items).toHaveLength(2);
    // Planned days don't count as worn.
    await b.post('/api/closet/wears', { lookId: look.id, wornOn: '2026-10-20', planned: true });
    expect((await b.get(`/api/closet/items/${tee.id}`)).body.item.wears).toBe(1);

    expect((await b.delete(`/api/closet/items/${tee.id}`)).status).toBe(204);
    const kept = (await b.get(`/api/closet/looks/${look.id}`)).body;
    expect(kept.look.canvas.items.map((i: any) => i.label)).toEqual(['Jeans', 'White tee']);
    expect(Object.keys(kept.pieces)).toEqual([jeans.id]);
    expect((await b.get(`/api/closet/items/${jeans.id}`)).body.item.wears).toBe(2);

    // The laundry: to wash, then washed back to clean.
    await b.patch(`/api/closet/items/${jeans.id}`, { status: 'to_wash', storage: 'laundry' });
    const washed = (await b.post('/api/closet/laundry/washed', { all: true })).body.items;
    expect(washed[0]).toMatchObject({ status: 'clean', storage: '' });

    const stats = (await b.get('/api/closet/stats')).body;
    expect(stats.totals).toMatchObject({ pieces: 1, value: 900, wears: 2 });
    const csv = await raw(b, '/api/closet/export?format=csv');
    expect(csv.headers.get('content-type')).toContain('text/csv');
    expect(await csv.text()).toContain('Jeans');
  });
});

describe('closet: keys, live sync and MCP', () => {
  it('keys reach /api/closet like the kitchen; changes are announced as closet', () => {
    expect(tokenMayAccess('food:read', 'GET', '/api/closet/items')).toBe(true);
    expect(tokenMayAccess('food:read', 'POST', '/api/closet/items')).toBe(false);
    expect(tokenMayAccess('food', 'POST', '/api/closet/items/abc/photos')).toBe(true);
    expect(areaOf('/api/closet/items/abc')).toBe('closet');
    expect(toolArea('closet_add_photo')).toBe('closet');
    expect(toolArea('closet_places')).toBe('closet');
  });

  it('Claude adds a piece from chat photos, reads its label and puts it away', async () => {
    const { ana, ion } = await family();
    const key = (await ana.b.post('/api/me/tokens', { name: 'Claude', scope: 'food' })).body.token;
    const call = async (name: string, args: unknown, ok = true) => {
      const res = await t.app.request('/api/mcp', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
      });
      const body = (await res.json()) as any;
      expect(body.result.isError ?? false, JSON.stringify(body.result)).toBe(!ok);
      return ok ? JSON.parse(body.result.content[0].text) : body.result;
    };

    await call('closet_places', { action: 'create', kind: 'room', name: 'Bedroom' });
    await call('closet_places', { action: 'create', kind: 'furniture', name: 'Wardrobe', parent: 'Bedroom' });
    const { places } = await call('closet_places', {
      action: 'create',
      kind: 'shelf',
      number: 1,
      parent: 'Bedroom > Wardrobe',
    });
    expect(places.map((p: any) => p.path)).toContain('Bedroom › Wardrobe › Shelf 1');

    const added = await call('closet_add_item', {
      name: 'Merino jumper',
      category: 'tops',
      subcategory: 'sweater',
      colors: ['camel'],
      person: 'Ion',
      place: 'Bedroom > Wardrobe > Shelf 1',
    });
    expect(added).toMatchObject({ owner: 'Ion', place: 'Bedroom › Wardrobe › Shelf 1', storage: 'folded' });
    expect(await call('closet_add_photo', { itemId: added.id, image: PHOTO })).toMatchObject({
      kind: 'front',
      needsCutout: true,
    });
    expect(await call('closet_add_photo', { itemId: added.id, image: PHOTO, kind: 'label' })).toMatchObject({
      kind: 'label',
      needsCutout: false,
    });
    const cared = await call('closet_set_care', {
      id: added.id,
      care: { wash: { method: 'hand' }, bleach: 'none', tumble: 'none', dry: ['flat'], iron: 'low' },
      materials: [{ material: 'merino', percent: 100 }],
      size: 'L',
      sizeSystem: 'letter',
      madeIn: 'it',
      storageAdvice: 'Fold in a breathable bin with cedar.',
    });
    expect(cared).toMatchObject({ care: { wash: { method: 'hand' } }, size: 'L', labelPhoto: true });

    expect(await call('closet_set_place', { itemIds: [added.id], place: 'Kitchen' }, false)).toBeTruthy();
    expect(await call('closet_log_worn', { itemIds: [added.id], person: 'Ion' })).toMatchObject({
      pieces: [expect.objectContaining({ wears: 1 })],
    });
    expect(await call('closet_list', { person: 'Ion', q: 'merino' })).toMatchObject({ count: 1 });
    expect(await call('closet_list', {})).toMatchObject({ count: 0 });
    const got = await call('closet_get', { id: added.id });
    expect(got.item.madeIn).toBe('IT');
    expect((await ion.b.get(`/api/closet/items/${added.id}`)).body.item).toMatchObject({ needsCutout: true, hasLabel: true });
  });
});
