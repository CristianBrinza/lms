import { describe, expect, it } from 'vitest';
import { APP_URL, PASSWORD, setupTestApp } from './helpers';

const PROXY_SECRET = 'proxy-secret-proxy-secret-proxy-secret-42';
const t = setupTestApp({ RATE_LIMITS: 'true', PROXY_SECRET });
const viaWorker = { 'x-lms-proxy-key': PROXY_SECRET };

describe('behind the Cloudflare Worker', () => {
  it('answers a bare 404 to requests that skip the Worker (straight to the tunnel)', async () => {
    const res = await t.app.request('/api/health');
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Not Found');
    const forged = await t.app.request('/api/health', { headers: { 'x-lms-proxy-key': 'guess' } });
    expect(forged.status).toBe(404);
  });

  it('serves requests that carry the Worker key', async () => {
    const res = await t.browser().get('/api/health', viaWorker);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'lms-api', database: 'ok' });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
  });
});

describe('request checks', () => {
  it('rejects cross-site and foreign-origin writes', async () => {
    const b = t.browser();
    const crossSite = await b.post(
      '/api/auth/login',
      { email: 'a@example.com', password: 'x' },
      { ...viaWorker, 'sec-fetch-site': 'cross-site' },
    );
    expect(crossSite.status).toBe(403);
    const foreign = await b.post(
      '/api/auth/login',
      { email: 'a@example.com', password: 'x' },
      { ...viaWorker, origin: 'https://evil.example' },
    );
    expect(foreign.status).toBe(403);
  });

  it('accepts only JSON bodies', async () => {
    const res = await t.app.request('/api/auth/login', {
      method: 'POST',
      headers: {
        ...viaWorker,
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
      const res = await b.post(
        '/api/auth/login',
        { email: 'ana@example.com', password: 'wrong-password' },
        viaWorker,
      );
      expect(res.status).toBe(401);
    }
    const blocked = await b.post(
      '/api/auth/login',
      { email: 'ana@example.com', password: PASSWORD },
      viaWorker,
    );
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('needs a session for private routes', async () => {
    const res = await t.browser().get('/api/me', viaWorker);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });
});
