import { describe, expect, it } from 'vitest';
import { areaOf, toolArea } from '../src/modules/live/publish';
import { imageSize, sniff } from '../src/modules/drinks/photos';
import { tokenMayAccess } from '../src/modules/tokens';
import { APP_URL, setupTestApp } from './helpers';

const t = setupTestApp();

/** A 1×1 PNG: small enough to be kept as it is without vips. */
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function person(email: string, name: string) {
  const user = await t.createUser({ email, name });
  const b = t.browser();
  await b.login(email);
  return { user, b };
}

/** Two people at home: Ion is seated in Ana's household. */
async function family() {
  const ana = await person('ana@example.com', 'Ana');
  const ion = await person('ion@example.com', 'Ion');
  await ana.b.get('/api/drinks');
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

/** GET with the browser's cookies, keeping the raw body (a picture, not JSON). */
async function raw(b: ReturnType<typeof t.browser>, path: string, headers: Record<string, string> = {}) {
  return t.app.request(path, {
    headers: {
      origin: APP_URL,
      cookie: [...b.jar].map(([name, value]) => `${name}=${value}`).join('; '),
      ...headers,
    },
  });
}

describe('drinks: the cellar', () => {
  it('adds, finds, changes and deletes drinks, with versions of one line', async () => {
    const { b } = await person('ana@example.com', 'Ana');
    expect((await b.get('/api/drinks')).body).toMatchObject({ drinks: [], tags: [], countries: [] });

    const created = await b.post('/api/drinks', {
      category: 'whisky',
      name: 'Jack Daniel’s Old No. 7',
      producer: 'Jack Daniel Distillery',
      line: 'Jack Daniel’s',
      variant: 'Old No. 7',
      abv: 40,
      volumeMl: 700,
      country: 'us',
      region: 'Tennessee',
      tags: ['bourbon-ish', 'gift', 'gift'],
      price: 450,
      boughtAt: 'Duty free',
      stock: 2,
      location: 'Bar cabinet',
    });
    expect(created.status).toBe(201);
    const jd = created.body.drink;
    expect(jd).toMatchObject({
      name: 'Jack Daniel’s Old No. 7',
      country: 'US',
      abv: 40,
      tags: ['bourbon-ish', 'gift'],
      price: 450,
      currency: 'MDL',
      stock: 2,
      tastings: 0,
      rating: null,
      cover: null,
    });

    // A new version from the first: the family's facts come along, the bottle's don't.
    const honey = await b.post('/api/drinks', {
      fromId: jd.id,
      name: 'Jack Daniel’s Tennessee Honey',
      variant: 'Tennessee Honey',
      abv: 35,
    });
    expect(honey.body.drink).toMatchObject({
      category: 'whisky',
      line: 'Jack Daniel’s',
      country: 'US',
      region: 'Tennessee',
      abv: 35,
      stock: 0,
      price: null,
    });

    await b.post('/api/drinks', {
      category: 'wine',
      name: 'Purcari Rară Neagră 2019',
      vintage: 2019,
      country: 'MD',
      color: 'red',
      grapes: ['Rară Neagră'],
      wanted: true,
    });

    const all = (await b.get('/api/drinks')).body;
    expect(all.drinks).toHaveLength(3);
    expect(all.countries).toEqual(['MD', 'US']);
    expect(all.people).toEqual([expect.objectContaining({ name: 'Ana' })]);

    const search = (await b.get('/api/drinks/search?q=tennessee%20honey')).body.drinks;
    expect(search.map((d: any) => d.name)).toEqual(['Jack Daniel’s Tennessee Honey']);
    expect((await b.get('/api/drinks/search?shelf=cellar')).body.drinks).toHaveLength(1);
    expect((await b.get('/api/drinks/search?shelf=wanted')).body.drinks[0].vintage).toBe(2019);
    expect((await b.get('/api/drinks/search?category=wine&country=md')).body.drinks).toHaveLength(1);

    const detail = (await b.get(`/api/drinks/${jd.id}`)).body;
    expect(detail.family.map((d: any) => d.variant)).toEqual(['Tennessee Honey']);
    expect(detail.prices).toEqual([expect.objectContaining({ price: 450, boughtAt: 'Duty free' })]);

    // A new price is one more line of price history.
    const changed = await b.patch(`/api/drinks/${jd.id}`, { price: 480, notes: 'Smooth' });
    expect(changed.body.drink).toMatchObject({ price: 480, notes: 'Smooth' });
    expect((await b.get(`/api/drinks/${jd.id}`)).body.prices.map((p: any) => p.price)).toEqual([
      450, 480,
    ]);

    expect((await b.post('/api/drinks', { category: 'wine', name: '' })).status).toBe(400);
    expect((await b.post('/api/drinks', { category: 'tea', name: 'x' })).status).toBe(400);
    expect((await b.post('/api/drinks', { category: 'wine', name: 'x', country: 'France' })).status).toBe(400);
    expect((await b.patch(`/api/drinks/${jd.id}`, {})).status).toBe(400);

    expect((await b.delete(`/api/drinks/${honey.body.drink.id}`)).status).toBe(204);
    expect((await b.get(`/api/drinks/${honey.body.drink.id}`)).status).toBe(404);
    expect((await b.get('/api/drinks/not-an-id')).status).toBe(404);
  });

  it('counts bottles at home', async () => {
    const { b } = await person('ana@example.com', 'Ana');
    const { drink } = (
      await b.post('/api/drinks', { category: 'sparkling', name: 'Cricova Brut', wanted: true })
    ).body;

    let after = (await b.put(`/api/drinks/${drink.id}/stock`, { delta: 2, price: 220, boughtAt: 'Linella' }))
      .body.drink;
    // Bought: two at home, today, and no longer only wanted.
    expect(after).toMatchObject({ stock: 2, wanted: false, price: 220, boughtAt: 'Linella' });
    expect(after.boughtOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    after = (await b.put(`/api/drinks/${drink.id}/stock`, { opened: true, location: 'Fridge' })).body
      .drink;
    expect(after).toMatchObject({ stock: 2, opened: true, location: 'Fridge' });

    // The last bottles gone: nothing is open, and never below zero.
    after = (await b.put(`/api/drinks/${drink.id}/stock`, { delta: -5 })).body.drink;
    expect(after).toMatchObject({ stock: 0, opened: false });
    expect((await b.put(`/api/drinks/${drink.id}/stock`, { stock: -1 })).status).toBe(400);
    expect((await b.put(`/api/drinks/${drink.id}/stock`, {})).status).toBe(400);
  });
});

describe('drinks: tastings', () => {
  it('keeps everyone’s tastings, with a sheet, and adds them up', async () => {
    const { ana, ion } = await family();
    const { drink } = (
      await ana.b.post('/api/drinks', { category: 'wine', name: 'Negru de Purcari 2018', vintage: 2018 })
    ).body;

    const full = await ana.b.post(`/api/drinks/${drink.id}/tastings`, {
      tastedOn: '2026-05-01',
      place: 'Château Purcari',
      country: 'md',
      withPeople: [ion.user.id],
      withOthers: 'Victor',
      rating: 9,
      score: 92,
      buyAgain: true,
      comment: 'Dense, long.',
      pairing: 'Lamb',
      sheet: {
        v: 1,
        kind: 'wine',
        appearance: { clarity: 'clear', intensity: 'deep', colour: 'garnet', other: ['legs'] },
        nose: { condition: 'clean', intensity: 'pronounced', aromas: ['blackcurrant', 'cedar'] },
        palate: { sweetness: 'dry', tannin: 'high', body: 'full', finish: 'long' },
        conclusions: { quality: 'outstanding', readiness: 'can-drink-has-potential', length: true },
      },
    });
    expect(full.status).toBe(201);
    expect(full.body.tasting).toMatchObject({
      person: { name: 'Ana' },
      mine: true,
      country: 'MD',
      rating: 9,
      mode: 'full',
      withPeople: [ion.user.id],
      sheet: { kind: 'wine', nose: { aromas: ['blackcurrant', 'cedar'] } },
    });

    // Ion's own, quick: a rating and a few aromas.
    const quick = await ion.b.post(`/api/drinks/${drink.id}/tastings`, {
      tastedOn: '2026-06-10',
      rating: 6,
      comment: 'Too tannic for me',
      sheet: { v: 1, kind: 'wine', nose: { aromas: ['plum'] } },
    });
    expect(quick.body.tasting).toMatchObject({ person: { name: 'Ion' }, mode: 'quick' });

    const detail = (await ana.b.get(`/api/drinks/${drink.id}`)).body;
    expect(detail.tastings.map((x: any) => x.person.name)).toEqual(['Ion', 'Ana']);
    expect(detail.insights).toMatchObject({
      rating: 7.5,
      tastings: 2,
      lastTasted: '2026-06-10',
      firstTasted: '2026-05-01',
      best: 9,
      buyAgain: { yes: 1, of: 1 },
    });
    expect(detail.drink).toMatchObject({ rating: 7.5, tastings: 2, myRating: 9 });

    // The sheet has to fit the drink, its scales are fixed, people are the household's.
    const bad = (body: object) => ana.b.post(`/api/drinks/${drink.id}/tastings`, body);
    expect((await bad({ sheet: { v: 1, kind: 'beer', scores: { aroma: 10 } } })).status).toBe(400);
    expect((await bad({ sheet: { v: 1, kind: 'wine', palate: { tannin: 'huge' } } })).status).toBe(400);
    expect((await bad({ sheet: { v: 2, kind: 'wine' } })).status).toBe(400);
    expect((await bad({ rating: 11 })).status).toBe(400);
    expect((await bad({ withPeople: ['00000000-0000-4000-8000-000000000000'] })).status).toBe(400);

    // Each person changes only their own.
    const anas = full.body.tasting.id;
    expect((await ion.b.patch(`/api/drinks/tastings/${anas}`, { rating: 2 })).status).toBe(403);
    expect((await ana.b.patch(`/api/drinks/tastings/${anas}`, { rating: 10 })).body.tasting.rating).toBe(10);

    const journal = (await ion.b.get('/api/drinks/tastings')).body.tastings;
    expect(journal).toHaveLength(2);
    expect(journal[0]).toMatchObject({ drink: { name: 'Negru de Purcari 2018', vintage: 2018 } });

    const stats = (await ana.b.get('/api/drinks/stats')).body;
    expect(stats.totals).toMatchObject({ drinks: 1, tried: 1, tastings: 2, tastedIn: 1 });
    expect(stats.mostLoved[0].name).toBe('Negru de Purcari 2018');
    expect(stats.byCategory).toEqual([expect.objectContaining({ category: 'wine', drinks: 1 })]);
    expect(stats.people.map((p: any) => p.name).sort()).toEqual(['Ana', 'Ion']);

    expect((await ion.b.delete(`/api/drinks/tastings/${quick.body.tasting.id}`)).status).toBe(204);
    expect((await ana.b.get(`/api/drinks/${drink.id}`)).body.tastings).toHaveLength(1);
  });

  it('takes the beer and spirit sheets', async () => {
    const { b } = await person('ana@example.com', 'Ana');
    const beer = (await b.post('/api/drinks', { category: 'beer', name: 'Pilsner Urquell' })).body.drink;
    const scored = await b.post(`/api/drinks/${beer.id}/tastings`, {
      sheet: {
        v: 1,
        kind: 'beer',
        scores: { aroma: 9, appearance: 3, flavour: 16.5, mouthfeel: 4, overall: 8 },
        offFlavours: ['diacetyl'],
      },
    });
    expect(scored.status).toBe(201);
    expect(scored.body.tasting.tastedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(
      (await b.post(`/api/drinks/${beer.id}/tastings`, { sheet: { v: 1, kind: 'beer', scores: { aroma: 13 } } }))
        .status,
    ).toBe(400);

    const rum = (await b.post('/api/drinks', { category: 'rum', name: 'Diplomático Reserva' })).body.drink;
    expect(
      (
        await b.post(`/api/drinks/${rum.id}/tastings`, {
          rating: 8,
          sheet: {
            v: 1,
            kind: 'spirit',
            appearance: { intensity: 'deep', colour: 'amber' },
            palate: { sweetness: 'sweet', texture: ['oily', 'warming'], complexity: 'some' },
          },
        })
      ).status,
    ).toBe(201);
  });
});

describe('drinks: photos', () => {
  it('stores label photos, serves them to the household, first one the cover', async () => {
    const { ana, ion } = await family();
    const { drink } = (await ana.b.post('/api/drinks', { category: 'wine', name: 'Fautor Negru' })).body;

    const front = await ana.b.post(`/api/drinks/${drink.id}/photos`, { image: PNG });
    expect(front.status).toBe(201);
    expect(front.body.photo).toMatchObject({ kind: 'front', width: 1, height: 1 });
    const back = await ana.b.post(`/api/drinks/${drink.id}/photos`, {
      image: PNG.split(',')[1],
      kind: 'back',
    });
    expect(back.body.photo.kind).toBe('back');

    const detail = (await ion.b.get(`/api/drinks/${drink.id}`)).body;
    expect(detail.photos.map((p: any) => p.kind)).toEqual(['front', 'back']);
    expect(detail.drink.cover.id).toBe(front.body.photo.id);
    expect(detail.drink.photos).toBe(2);

    // Served to the household, cached by its ETag; never to anyone else.
    const picture = await raw(ion.b, detail.drink.cover.thumb);
    expect(picture.status).toBe(200);
    expect(picture.headers.get('content-type')).toBe('image/png');
    expect(picture.headers.get('cache-control')).toContain('immutable');
    const etag = picture.headers.get('etag')!;
    expect((await raw(ion.b, detail.drink.cover.thumb, { 'if-none-match': etag })).status).toBe(304);
    const stranger = await person('eva@example.com', 'Eva');
    expect((await raw(stranger.b, detail.drink.cover.full)).status).toBe(404);
    expect((await stranger.b.post(`/api/drinks/${drink.id}/photos`, { image: PNG })).status).toBe(404);

    // The back label becomes the cover; then it's deleted, and the front is the cover again.
    await ana.b.patch(`/api/drinks/photos/${back.body.photo.id}`, { cover: true });
    expect((await ana.b.get(`/api/drinks/${drink.id}`)).body.drink.cover.id).toBe(back.body.photo.id);
    expect((await ana.b.delete(`/api/drinks/photos/${back.body.photo.id}`)).status).toBe(204);
    expect((await ana.b.get(`/api/drinks/${drink.id}`)).body.drink.cover.id).toBe(front.body.photo.id);

    // A tasting's own photo.
    const tasting = (await ana.b.post(`/api/drinks/${drink.id}/tastings`, { rating: 7 })).body.tasting;
    const moment = await ana.b.post(`/api/drinks/${drink.id}/photos`, { image: PNG, tastingId: tasting.id });
    expect(moment.body.photo).toMatchObject({ kind: 'other', tastingId: tasting.id });
    expect((await ana.b.get(`/api/drinks/${drink.id}`)).body.tastings[0].photos).toHaveLength(1);

    // Not a picture, or lying about being one.
    expect((await ana.b.post(`/api/drinks/${drink.id}/photos`, { image: 'data:image/png;base64,aGVsbG8gd29ybGQh' })).status).toBe(400);
    expect((await ana.b.post(`/api/drinks/${drink.id}/photos`, { image: 'not base64 at all!' })).status).toBe(400);
  });

  it('reads sizes and kinds from the bytes', () => {
    const png = Buffer.from(PNG.split(',')[1]!, 'base64');
    expect(sniff(png)).toBe('image/png');
    expect(imageSize(png)).toEqual({ width: 1, height: 1 });
    const jpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03,
      0x20, 0x03,
    ]);
    expect(imageSize(jpeg)).toEqual({ width: 800, height: 600 });
    expect(sniff(Buffer.from('hello world'))).toBeNull();
  });
});

describe('drinks: households, keys, live sync and MCP', () => {
  it('another household never sees or changes them', async () => {
    const ana = await person('ana@example.com', 'Ana');
    const ion = await person('ion@example.com', 'Ion');
    const { drink } = (await ana.b.post('/api/drinks', { category: 'gin', name: 'Hendrick’s' })).body;
    const tasting = (await ana.b.post(`/api/drinks/${drink.id}/tastings`, { rating: 8 })).body.tasting;
    expect((await ion.b.get('/api/drinks')).body.drinks).toEqual([]);
    expect((await ion.b.get(`/api/drinks/${drink.id}`)).status).toBe(404);
    expect((await ion.b.patch(`/api/drinks/${drink.id}`, { name: 'x' })).status).toBe(404);
    expect((await ion.b.put(`/api/drinks/${drink.id}/stock`, { stock: 9 })).status).toBe(404);
    expect((await ion.b.delete(`/api/drinks/${drink.id}`)).status).toBe(404);
    expect((await ion.b.post(`/api/drinks/${drink.id}/tastings`, { rating: 1 })).status).toBe(404);
    expect((await ion.b.patch(`/api/drinks/tastings/${tasting.id}`, { rating: 1 })).status).toBe(404);
    expect((await ion.b.get('/api/drinks/tastings')).body.tastings).toEqual([]);
    expect((await ion.b.get('/api/drinks/stats')).body.totals.drinks).toBe(0);
    // Nor can Ana name Ion as a tasting's person.
    expect(
      (await ana.b.post(`/api/drinks/${drink.id}/tastings`, { personId: ion.user.id })).status,
    ).toBe(400);
  });

  it('keys reach /api/drinks like the kitchen; changes are announced as drinks', () => {
    expect(tokenMayAccess('food:read', 'GET', '/api/drinks/stats')).toBe(true);
    expect(tokenMayAccess('food:read', 'POST', '/api/drinks')).toBe(false);
    expect(tokenMayAccess('food', 'POST', '/api/drinks/abc/photos')).toBe(true);
    expect(areaOf('/api/drinks/abc/tastings')).toBe('drinks');
    expect(toolArea('drinks_add_tasting')).toBe('drinks');
  });

  it('Claude adds a bottle from its labels, a tasting for someone, and the stock', async () => {
    const { ana, ion } = await family();
    const key = (await ana.b.post('/api/me/tokens', { name: 'Claude', scope: 'food' })).body.token;
    const call = async (name: string, args: unknown) => {
      const res = await t.app.request('/api/mcp', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name, arguments: args },
        }),
      });
      const body = (await res.json()) as any;
      expect(body.result.isError ?? false, JSON.stringify(body.result)).toBe(false);
      return JSON.parse(body.result.content[0].text);
    };

    const added = await call('drinks_add', {
      category: 'brandy',
      name: 'Kvint XO 10 years',
      producer: 'Kvint',
      style: 'XO',
      ageYears: 10,
      abv: 40,
      country: 'MD',
      labelText: 'Aged in oak barrels for ten years.',
      stock: 1,
    });
    expect(added).toMatchObject({ name: 'Kvint XO 10 years', ageYears: 10, stock: 1, photos: 0 });

    expect(await call('drinks_add_photo', { drinkId: added.id, image: PNG, kind: 'back' })).toMatchObject({
      kind: 'back',
      width: 1,
    });
    expect(
      await call('drinks_add_tasting', { drinkId: added.id, person: 'ion', rating: 9, comment: 'Lovely' }),
    ).toMatchObject({ by: 'Ion', stars: 4.5 });
    expect(await call('drinks_set_stock', { id: added.id, delta: 1 })).toMatchObject({ stock: 2 });
    expect(await call('drinks_update', { id: added.id, region: 'Tiraspol' })).toMatchObject({
      region: 'Tiraspol',
    });
    const found = await call('drinks_list', { q: 'kvint' });
    expect(found).toMatchObject({ count: 1, drinks: [expect.objectContaining({ tastings: 1, stars: 4.5 })] });
    const got = await call('drinks_get', { id: added.id });
    expect(got.tastings[0]).toMatchObject({ by: 'Ion', stars: 4.5 });
    expect(got.drink.labelText).toBe('Aged in oak barrels for ten years.');
    expect((await ion.b.get(`/api/drinks/${added.id}`)).body.drink.cover).not.toBeNull();
  });
});
