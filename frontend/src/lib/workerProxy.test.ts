import { afterEach, describe, expect, it, vi } from 'vitest';
import { proxyApi } from '../../worker/index';

const env = {
  ASSETS: { fetch: () => Promise.resolve(new Response('')) },
  API_ORIGIN: 'https://api.example.test',
  PROXY_SECRET: 'proxy-secret',
  CF_ACCESS_CLIENT_ID: 'access-id.access',
  CF_ACCESS_CLIENT_SECRET: 'access-secret',
};

afterEach(() => vi.unstubAllGlobals());

describe('the Worker’s API proxy', () => {
  it('sends its own keys (proxy secret, Access token) and never a client’s', async () => {
    const upstream = vi.fn((_url: URL, init: RequestInit) => {
      const headers = new Headers(init.headers);
      return Promise.resolve(Response.json({ seen: Object.fromEntries(headers) }));
    });
    vi.stubGlobal('fetch', upstream);
    const request = new Request('https://lms.example.test/api/food/kitchen?x=1', {
      headers: {
        'x-lms-proxy-key': 'forged',
        'cf-access-client-secret': 'forged',
        'cf-connecting-ip': '203.0.113.9',
        authorization: 'Bearer lms_key',
      },
    });
    const response = await proxyApi(request, env);
    const { seen } = (await response.json()) as { seen: Record<string, string> };
    expect(upstream.mock.calls[0]![0].toString()).toBe(
      'https://api.example.test/api/food/kitchen?x=1',
    );
    expect(seen['x-lms-proxy-key']).toBe('proxy-secret');
    expect(seen['cf-access-client-id']).toBe('access-id.access');
    expect(seen['cf-access-client-secret']).toBe('access-secret');
    expect(seen['x-lms-client-ip']).toBe('203.0.113.9');
    // Claude's access key passes through: the API checks it.
    expect(seen.authorization).toBe('Bearer lms_key');
  });

  it('hides Cloudflare’s pages: a down tunnel or an Access refusal is a plain 502', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        new Response('<html>Access</html>', {
          status: 302,
          headers: {
            location: 'https://x.cloudflareaccess.com/cdn-cgi/access/login',
            'content-type': 'text/html',
          },
        }),
      ),
    );
    const refused = await proxyApi(new Request('https://lms.example.test/api/health'), env);
    expect(refused.status).toBe(502);
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        new Response('<html>530</html>', { status: 530, headers: { 'content-type': 'text/html' } }),
      ),
    );
    expect((await proxyApi(new Request('https://lms.example.test/api/health'), env)).status).toBe(
      502,
    );
    vi.stubGlobal('fetch', () =>
      Promise.resolve(Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })),
    );
    expect((await proxyApi(new Request('https://lms.example.test/api/x'), env)).status).toBe(404);
  });
});
