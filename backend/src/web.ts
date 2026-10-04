import { existsSync, readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Context } from 'hono';

/**
 * The web app, served by the same server as the API (production: one container on the PC behind
 * the Cloudflare Tunnel). Files come from the built frontend (WEB_DIR = frontend/dist), with the
 * headers its `_headers` file sets per path (security headers, caching). Any other page path gets
 * index.html (the app routes itself). Every HTML page gets a fresh CSP nonce on its scripts, so
 * the scripts Cloudflare adds to the zone (Web Analytics) can run under a strict policy.
 */

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.apk': 'application/vnd.android.package-archive',
};

interface Rule {
  pattern: string;
  headers: Array<[string, string]>;
}

/** Cloudflare's `_headers` format: a path (`/*`, `/assets/*`, `/sw.js`), then indented `Name: value` lines. */
export function parseHeaderRules(text: string): Rule[] {
  const rules: Rule[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      rules.push({ pattern: line.trim(), headers: [] });
      continue;
    }
    const at = line.indexOf(':');
    if (at > 0 && rules.length) {
      rules.at(-1)!.headers.push([line.slice(0, at).trim(), line.slice(at + 1).trim()]);
    }
  }
  return rules;
}

const matches = (pattern: string, pathname: string) =>
  pattern.endsWith('*') ? pathname.startsWith(pattern.slice(0, -1)) : pattern === pathname;

/** Cloudflare Web Analytics, which the zone injects into pages (its beacon and where it reports). */
const ANALYTICS_SCRIPT = 'https://static.cloudflareinsights.com';
const ANALYTICS_CONNECT = 'https://cloudflareinsights.com';

/** The CSP of an HTML page with this request's nonce, and room for Cloudflare's own scripts. */
export function withNonce(csp: string, nonce: string): string {
  return csp
    .split(';')
    .map((directive) => {
      const trimmed = directive.trim();
      if (trimmed.startsWith('script-src '))
        return `${trimmed} 'nonce-${nonce}' ${ANALYTICS_SCRIPT}`;
      if (trimmed.startsWith('connect-src ')) return `${trimmed} ${ANALYTICS_CONNECT}`;
      return trimmed;
    })
    .filter(Boolean)
    .join('; ');
}

export function webApp(dir: string) {
  const root = path.resolve(dir);
  const rulesFile = path.join(root, '_headers');
  const rules = existsSync(rulesFile) ? parseHeaderRules(readFileSync(rulesFile, 'utf8')) : [];
  // ponytail: index.html and files are read per request; fine for a family's traffic.
  const headersFor = (pathname: string) => {
    const out = new Headers();
    for (const rule of rules) {
      if (matches(rule.pattern, pathname))
        for (const [name, value] of rule.headers) out.set(name, value);
    }
    return out;
  };

  async function file(pathname: string): Promise<{ body: Buffer; served: string } | null> {
    let decoded: string;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return null;
    }
    const full = path.join(root, path.normalize(decoded));
    if (!full.startsWith(root + path.sep) || path.basename(full).startsWith('_')) return null;
    const info = await stat(full).catch(() => null);
    if (!info?.isFile()) return null;
    return { body: await readFile(full), served: pathname };
  }

  return async (c: Context): Promise<Response> => {
    const { pathname } = new URL(c.req.url);
    const found = await file(pathname);
    if (found) {
      const headers = headersFor(found.served);
      if (!headers.has('content-type'))
        headers.set(
          'content-type',
          TYPES[path.extname(found.served).toLowerCase()] ?? 'application/octet-stream',
        );
      if (found.served.endsWith('.html')) return page(found.body.toString('utf8'), headers);
      return new Response(new Uint8Array(found.body), { headers });
    }
    // A path with an extension that isn't there is a missing file, not a page of the app.
    if (path.extname(pathname)) return new Response('Not Found', { status: 404 });
    const index = await readFile(path.join(root, 'index.html'), 'utf8');
    const headers = headersFor('/index.html');
    headers.set('content-type', TYPES['.html']!);
    return page(index, headers);
  };
}

function page(html: string, headers: Headers): Response {
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString('base64');
  const csp = headers.get('content-security-policy');
  if (csp) headers.set('content-security-policy', withNonce(csp, nonce));
  return new Response(html.replaceAll('<script', `<script nonce="${nonce}"`), { headers });
}

/** The web build's version.json (what the updater and uptime checks compare), or null. */
export function webVersion(dir: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path.join(path.resolve(dir), 'version.json'), 'utf8'));
  } catch {
    return null;
  }
}
