import { describe, expect, it } from 'vitest';
import { setupTestApp } from './helpers';

const t = setupTestApp();

// 1×1 pixel images, real headers.
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const FAKE = `data:image/png;base64,${Buffer.from('<svg onload=alert(1)>').toString('base64')}`;

const cookieOf = (b: { jar: Map<string, string> }) =>
  [...b.jar].map(([k, v]) => `${k}=${v}`).join('; ');

describe('the profile', () => {
  it('keeps gender, birth date, height and a picture, for the household and admins only', async () => {
    t.setNow(new Date('2026-10-04T12:00:00Z'));
    await t.createUser({ email: 'ana@example.com', name: 'Ana' });
    await t.createUser({ email: 'ion@example.com', name: 'Ion' });
    await t.createUser({ email: 'bob@example.com', name: 'Bob' });
    await t.createUser({ email: 'boss@example.com', name: 'Boss', role: 'admin' });
    const [ana, ion, bob, boss] = [t.browser(), t.browser(), t.browser(), t.browser()];
    await ana.login('ana@example.com');
    await ion.login('ion@example.com');
    await bob.login('bob@example.com');
    await boss.login('boss@example.com');

    const saved = await ana.patch('/api/me', {
      gender: 'female',
      birthDate: '1994-11-02',
      heightCm: 168,
    });
    expect(saved.body.user).toMatchObject({
      name: 'Ana',
      gender: 'female',
      birthDate: '1994-11-02',
      heightCm: 168,
      avatarUrl: null,
    });
    expect((await ana.patch('/api/me', { birthDate: '2099-01-01' })).status).toBe(400);
    expect((await ana.patch('/api/me', { heightCm: null })).body.user).toMatchObject({
      heightCm: null,
      gender: 'female',
    });

    expect((await ana.put('/api/me/avatar', { image: FAKE })).status).toBe(400);
    const withPicture = (await ana.put('/api/me/avatar', { image: PNG })).body.user;
    expect(withPicture.avatarUrl).toMatch(/^\/api\/users\/.+\/avatar\?v=\d+$/);

    // Ion shares Ana's household; Bob doesn't.
    const anaId = withPicture.id;
    await ana.get('/api/food/kitchen');
    await ion.get('/api/food/kitchen');
    await bob.get('/api/food/kitchen');
    const { rows } = await t.db.query<{ household_id: string }>(
      'SELECT household_id FROM users WHERE id = $1',
      [anaId],
    );
    await t.db.query(`UPDATE users SET household_id = $1 WHERE email = 'ion@example.com'`, [
      rows[0]!.household_id,
    ]);
    const picture = await t.app.request(withPicture.avatarUrl, {
      headers: { cookie: cookieOf(ion) },
    });
    expect(picture.status).toBe(200);
    expect(picture.headers.get('content-type')).toBe('image/png');
    expect(
      (await t.app.request(withPicture.avatarUrl, { headers: { cookie: cookieOf(bob) } })).status,
    ).toBe(404);
    expect(
      (await t.app.request(withPicture.avatarUrl, { headers: { cookie: cookieOf(boss) } })).status,
    ).toBe(200);

    // Who is who, for Training and Claude.
    const people = (await ion.get('/api/training/people')).body.people;
    expect(people.find((p: any) => p.id === anaId)).toMatchObject({
      gender: 'female',
      age: 31,
      avatarUrl: withPicture.avatarUrl,
    });

    // The admin sets anyone's profile and picture.
    const ionId = people.find((p: any) => p.name === 'Ion').id;
    const byAdmin = (
      await boss.patch(`/api/admin/users/${ionId}`, { gender: 'male', birthDate: '2012-03-15' })
    ).body.user;
    expect(byAdmin).toMatchObject({ gender: 'male', birthDate: '2012-03-15' });
    expect(
      (await boss.put(`/api/admin/users/${ionId}/avatar`, { image: PNG })).body.user.avatarUrl,
    ).toBeTruthy();
    expect((await ana.put(`/api/admin/users/${ionId}/avatar`, { image: PNG })).status).toBe(403);
    expect((await ana.delete('/api/me/avatar')).body.user.avatarUrl).toBeNull();
  });
});
