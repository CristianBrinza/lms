import { describe, expect, it } from 'vitest';
import { PASSWORD, setupTestApp } from './helpers';

const t = setupTestApp();

describe('sign-in', () => {
  it('signs in with email and password and remembers the session for a year', async () => {
    const user = await t.createUser({ email: 'ana@example.com' });
    const b = t.browser();
    const res = await b.login('ANA@example.com');
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: user.id, email: 'ana@example.com', role: 'member' });
    expect(res.body.user.passwordHash).toBeUndefined();

    const refresh = res.setCookies.find((line) => line.startsWith('lms_rt='))!;
    expect(refresh).toMatch(/HttpOnly/);
    expect(refresh).toMatch(/SameSite=Strict/);
    expect(refresh).toMatch(/Path=\/api\/auth/);
    expect(refresh).toMatch(/Max-Age=31536000/);
    expect(res.setCookies.find((line) => line.startsWith('lms_at='))).toMatch(/HttpOnly/);

    const me = await b.get('/api/me');
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(user.id);
  });

  it('keeps a session only until the browser closes without "keep me signed in"', async () => {
    await t.createUser({ email: 'ana@example.com' });
    const res = await t.browser().login('ana@example.com', PASSWORD, false);
    expect(res.setCookies.find((line) => line.startsWith('lms_rt='))).not.toMatch(/Max-Age/);
  });

  it('gives the same answer for an unknown email and a wrong password', async () => {
    await t.createUser({ email: 'ana@example.com' });
    const wrong = await t.browser().login('ana@example.com', 'not-the-password');
    const unknown = await t.browser().login('nobody@example.com');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.body).toEqual(wrong.body);
  });

  it('refuses switched-off accounts', async () => {
    await t.createUser({ email: 'off@example.com', isActive: false });
    const res = await t.browser().login('off@example.com');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('has no sign-up', async () => {
    const res = await t
      .browser()
      .post('/api/auth/register', { email: 'new@example.com', password: PASSWORD });
    expect(res.status).toBe(404);
  });
});

describe('session refresh', () => {
  it('rotates the refresh token and issues a new access token', async () => {
    await t.createUser({ email: 'ana@example.com' });
    const b = t.browser();
    await b.login('ana@example.com');
    const before = b.jar.get('lms_rt');
    const res = await b.post('/api/auth/refresh');
    expect(res.status).toBe(200);
    expect(b.jar.get('lms_rt')).toBeTruthy();
    expect(b.jar.get('lms_rt')).not.toBe(before);
  });

  it('treats a just-rotated token from another tab as a race, not theft', async () => {
    await t.createUser({ email: 'ana@example.com' });
    const b = t.browser();
    await b.login('ana@example.com');
    const old = b.jar.get('lms_rt')!;
    await b.post('/api/auth/refresh');
    const other = await t.app.request('/api/auth/refresh', {
      method: 'POST',
      headers: { cookie: `lms_rt=${old}`, origin: 'http://localhost:5190' },
    });
    expect(other.status).toBe(409);
    expect((await b.get('/api/me')).status).toBe(200);
  });

  it('ends the whole session when an old refresh token comes back later', async () => {
    await t.createUser({ email: 'ana@example.com' });
    const b = t.browser();
    await b.login('ana@example.com');
    const old = b.jar.get('lms_rt')!;
    await b.post('/api/auth/refresh');
    t.setNow(new Date(Date.now() + 5 * 60_000));
    const thief = await t.app.request('/api/auth/refresh', {
      method: 'POST',
      headers: { cookie: `lms_rt=${old}`, origin: 'http://localhost:5190' },
    });
    expect(thief.status).toBe(401);
    const owner = await b.post('/api/auth/refresh');
    expect(owner.status).toBe(401);
  });

  it('signs out: the refresh token stops working and cookies are cleared', async () => {
    await t.createUser({ email: 'ana@example.com' });
    const b = t.browser();
    await b.login('ana@example.com');
    const token = b.jar.get('lms_rt')!;
    const out = await b.post('/api/auth/logout');
    expect(out.status).toBe(204);
    expect(b.jar.has('lms_rt')).toBe(false);
    const reuse = await t.app.request('/api/auth/refresh', {
      method: 'POST',
      headers: { cookie: `lms_rt=${token}`, origin: 'http://localhost:5190' },
    });
    expect(reuse.status).toBe(401);
  });
});

describe('own account', () => {
  it('changes the password with the current one and signs other devices out', async () => {
    await t.createUser({ email: 'ana@example.com' });
    const phone = t.browser();
    const laptop = t.browser();
    await phone.login('ana@example.com');
    await laptop.login('ana@example.com');

    const wrong = await phone.post('/api/me/password', {
      currentPassword: 'nope-nope-nope',
      newPassword: 'a-brand-new-password',
    });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.fields.currentPassword).toBeTruthy();

    const ok = await phone.post('/api/me/password', {
      currentPassword: PASSWORD,
      newPassword: 'a-brand-new-password',
    });
    expect(ok.status).toBe(200);
    expect((await phone.get('/api/me')).status).toBe(200);
    expect((await laptop.get('/api/me')).status).toBe(401);
    expect((await laptop.post('/api/auth/refresh')).status).toBe(401);
    expect((await t.browser().login('ana@example.com', 'a-brand-new-password')).status).toBe(200);
  });

  it('chooses a first password without the temporary one after an admin reset', async () => {
    await t.createUser({ email: 'ana@example.com', mustChangePassword: true });
    const b = t.browser();
    const login = await b.login('ana@example.com');
    expect(login.body.user.mustChangePassword).toBe(true);
    const res = await b.post('/api/me/password', { newPassword: 'my-own-password-1' });
    expect(res.status).toBe(200);
    expect(res.body.user.mustChangePassword).toBe(false);
  });

  it('rejects short passwords', async () => {
    await t.createUser({ email: 'ana@example.com' });
    const b = t.browser();
    await b.login('ana@example.com');
    const res = await b.post('/api/me/password', {
      currentPassword: PASSWORD,
      newPassword: 'short',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.newPassword).toMatch(/10 characters/);
  });

  it('lists devices and ends another one', async () => {
    await t.createUser({ email: 'ana@example.com' });
    const phone = t.browser();
    const laptop = t.browser();
    await phone.login('ana@example.com');
    await laptop.login('ana@example.com');
    const list = await phone.get('/api/me/sessions');
    expect(list.body.sessions).toHaveLength(2);
    const other = list.body.sessions.find((s: any) => !s.current);
    expect((await phone.delete(`/api/me/sessions/${other.id}`)).status).toBe(204);
    expect((await laptop.post('/api/auth/refresh')).status).toBe(401);
  });

  it('updates name and surname', async () => {
    await t.createUser({ email: 'ana@example.com' });
    const b = t.browser();
    await b.login('ana@example.com');
    const res = await b.patch('/api/me', { name: 'Ana-Maria', surname: 'Brînză' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'Ana-Maria', surname: 'Brînză' });
  });
});
