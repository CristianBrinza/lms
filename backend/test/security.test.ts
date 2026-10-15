import { describe, expect, it } from 'vitest';
import { APP_URL, PASSWORD, setupTestApp } from './helpers';

const t = setupTestApp({ RATE_LIMITS: 'true' });

describe('health', () => {
  it('answers with strict, uncached headers', async () => {
    const res = await t.browser().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'lms-api', database: 'ok' });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
  });
});

describe('request checks', () => {
  it('answers only its own host and this machine', async () => {
    const own = new URL(APP_URL).host;
    for (const host of [own, 'localhost', '127.0.0.1:8790', '[::1]:8790']) {
      const res = await t.app.request('/api/health', { headers: { host } });
      expect(res.status, host).toBe(200);
    }
    for (const host of ['evil.example', 'lms.shades.md.evil.example', `${own}.evil.example`, '']) {
      const res = await t.app.request('/api/health', { headers: { host } });
      expect(res.status, host).toBe(421);
    }
  });

  it('rejects cross-site and foreign-origin writes', async () => {
    const b = t.browser();
    const crossSite = await b.post(
      '/api/auth/login',
      { email: 'a@example.com', password: 'x' },
      { 'sec-fetch-site': 'cross-site' },
    );
    expect(crossSite.status).toBe(403);
    const foreign = await b.post(
      '/api/auth/login',
      { email: 'a@example.com', password: 'x' },
      { origin: 'https://evil.example' },
    );
    expect(foreign.status).toBe(403);
  });

  it('accepts only JSON bodies', async () => {
    const res = await t.app.request('/api/auth/login', {
      method: 'POST',
      headers: {
        origin: APP_URL,
        'content-type': 'application/x-www-form-urlencoded',
        'content-length': '20',
      },
      body: 'email=a&password=b&x',
    });
    expect(res.status).toBe(415);
  });

  it('limits repeated sign-in attempts on one email', async () => {
    await t.createUser({ email: 'ana@example.com' });
    const b = t.browser();
    for (let i = 0; i < 10; i += 1) {
      const res = await b.post('/api/auth/login', {
        email: 'ana@example.com',
        password: 'wrong-password',
      });
      expect(res.status).toBe(401);
    }
    const blocked = await b.post('/api/auth/login', {
      email: 'ana@example.com',
      password: PASSWORD,
    });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('needs a session for private routes', async () => {
    const res = await t.browser().get('/api/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });
});
