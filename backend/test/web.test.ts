import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseHeaderRules, withNonce } from '../src/web';
import { setupTestApp } from './helpers';

// A small built web app, like frontend/dist.
const dir = mkdtempSync(path.join(tmpdir(), 'lms-web-'));
mkdirSync(path.join(dir, 'assets'));
writeFileSync(
  path.join(dir, 'index.html'),
  '<!doctype html><title>LMS</title><script type="module" src="/assets/app.js"></script>',
);
writeFileSync(path.join(dir, 'assets', 'app.js'), 'console.log(1)');
writeFileSync(path.join(dir, 'version.json'), '{"version":"test-1"}');
writeFileSync(path.join(dir, 'lms-health.apk'), 'PK');
writeFileSync(
  path.join(dir, '_headers'),
  `# comment
/*
  X-Frame-Options: DENY
  Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self'

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/index.html
  Cache-Control: no-cache
`,
);

const t = setupTestApp({ WEB_DIR: dir });

describe('the web app from the same server', () => {
  it('serves pages with a fresh nonce on every script', async () => {
    const res = await t.app.request('/food/kitchen');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    const nonce = /'nonce-([^']+)'/.exec(res.headers.get('content-security-policy') ?? '')?.[1];
    expect(nonce).toBeTruthy();
    expect(await res.text()).toContain(`<script nonce="${nonce}" type="module"`);
    const again = await t.app.request('/');
    expect(again.headers.get('content-security-policy')).not.toContain(nonce);
  });

  it('serves files with their type and caching, and 404s missing ones', async () => {
    const js = await t.app.request('/assets/app.js');
    expect(js.headers.get('content-type')).toContain('javascript');
    expect(js.headers.get('cache-control')).toContain('immutable');
    expect((await t.app.request('/lms-health.apk')).headers.get('content-type')).toBe(
      'application/vnd.android.package-archive',
    );
    expect((await t.app.request('/assets/gone.js')).status).toBe(404);
    expect(await (await t.app.request('/_headers')).text()).not.toContain('X-Frame-Options');
    expect((await t.app.request('/..%2f..%2fetc%2fpasswd')).status).not.toBe(200);
  });

  it('leaves /api to the API and reports /health for both', async () => {
    const api = await t.app.request('/api/nothing-here');
    expect(api.status).toBe(404);
    expect(api.headers.get('content-type')).toContain('application/json');
    const health = await t.app.request('/health');
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({
      status: 'ok',
      web: { version: 'test-1' },
      api: { status: 'ok' },
    });
  });
});

describe('_headers and the CSP nonce', () => {
  it('reads rules per path', () => {
    expect(parseHeaderRules('/x\n  A: 1\n  B: two: parts\n')).toEqual([
      {
        pattern: '/x',
        headers: [
          ['A', '1'],
          ['B', 'two: parts'],
        ],
      },
    ]);
  });
  it('lets the nonce and Cloudflare’s analytics in, nothing else', () => {
    expect(withNonce("default-src 'self'; script-src 'self'; connect-src 'self'", 'abc')).toBe(
      "default-src 'self'; script-src 'self' 'nonce-abc' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com",
    );
  });
});
