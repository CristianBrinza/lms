/**
 * LMS — Cloudflare Worker in front of the app.
 *
 * - Static files (the React PWA) are served by Workers Static Assets. This script runs first for
 *   pages, /api/* and /health (`run_worker_first` in wrangler.jsonc); hashed assets, icons and
 *   launch screens skip it.
 * - Every HTML page gets a fresh CSP nonce: the Worker adds it to the Content-Security-Policy and
 *   to each <script>. Cloudflare reads that nonce from the header and puts it on the scripts it
 *   injects for the zone (JavaScript detections, Web Analytics), so they run under a strict
 *   policy without 'unsafe-inline'.
 * - /api/* is reverse-proxied to the API through its Cloudflare Tunnel hostname (API_ORIGIN), so
 *   the browser only ever sees this origin: first-party cookies, no CORS, no API address in the
 *   client. Every proxied request carries a shared secret (PROXY_SECRET); the API answers 404 to
 *   anything without it, so the public tunnel hostname cannot be used to get around this Worker.
 */

interface Fetcher {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}

interface Env {
  ASSETS: Fetcher;
  /** HTTPS origin of the API's tunnel hostname, e.g. https://lms-api.example.com */
  API_ORIGIN?: string;
  /** Shared secret expected by the API (PROXY_SECRET there). Set with `wrangler secret put`. */
  PROXY_SECRET?: string;
}

/** Headers that would reveal the backend's software or location. */
const HIDDEN_RESPONSE_HEADERS = ['server', 'x-powered-by', 'via', 'x-served-by', 'x-backend', 'x-upstream', 'cf-cache-status'];

/** Client-supplied headers never forwarded upstream (they are the Worker's to set). */
const STRIPPED_REQUEST_HEADERS = ['x-lms-proxy-key', 'x-lms-client-ip', 'x-forwarded-for', 'x-real-ip', 'forwarded'];

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

async function proxyApi(request: Request, env: Env): Promise<Response> {
  if (!env.API_ORIGIN) return jsonError(503, 'API_NOT_CONFIGURED', 'The API is not configured');
  const url = new URL(request.url);
  const headers = new Headers(request.headers);
  for (const name of STRIPPED_REQUEST_HEADERS) headers.delete(name);

  const clientIp = request.headers.get('cf-connecting-ip') ?? '';
  if (clientIp) headers.set('x-lms-client-ip', clientIp);
  if (env.PROXY_SECRET) headers.set('x-lms-proxy-key', env.PROXY_SECRET);
  headers.set('x-forwarded-host', url.host);
  headers.set('x-forwarded-proto', url.protocol.replace(':', ''));

  let upstream: Response;
  try {
    upstream = await fetch(new URL(url.pathname + url.search, env.API_ORIGIN), {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
      signal: request.signal,
    });
  } catch {
    return jsonError(502, 'UPSTREAM_UNAVAILABLE', 'The service is temporarily unavailable');
  }

  // A tunnel with no running API answers with Cloudflare's own HTML error page (502/530).
  const type = upstream.headers.get('content-type') ?? '';
  if (upstream.status >= 500 && !type.includes('application/json')) {
    return jsonError(502, 'UPSTREAM_UNAVAILABLE', 'The service is temporarily unavailable');
  }

  const responseHeaders = new Headers(upstream.headers);
  for (const name of HIDDEN_RESPONSE_HEADERS) responseHeaders.delete(name);
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
}

/**
 * GET/HEAD /health — one URL for uptime monitors. Combines the web build (version.json) with the
 * API's own health; 200 + "status":"ok" only when both are fine, else 503.
 */
async function health(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const [webResult, apiResult] = await Promise.allSettled([
    env.ASSETS.fetch(new Request(new URL('/version.json', url.origin))).then((r) => (r.ok ? r.json() : null)),
    proxyApi(new Request(new URL('/api/health', url.origin), { signal: AbortSignal.timeout(5000) }), env).then(async (r) => ({
      httpStatus: r.status,
      body: (await r.json().catch(() => null)) as Record<string, unknown> | null,
    })),
  ]);
  const web = webResult.status === 'fulfilled' ? webResult.value : null;
  const api = apiResult.status === 'fulfilled' ? apiResult.value : null;
  const ok = Boolean(web) && api?.httpStatus === 200 && api.body?.status === 'ok';
  const body = {
    status: ok ? 'ok' : 'down',
    web: web ?? { status: 'unavailable' },
    api: api?.body ?? { status: 'unreachable' },
    time: new Date().toISOString(),
  };
  return new Response(request.method === 'HEAD' ? null : JSON.stringify(body, null, 2), {
    status: ok ? 200 : 503,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

/** Cloudflare Web Analytics, which the zone injects into pages (its beacon and where it reports). */
const ANALYTICS_SCRIPT = 'https://static.cloudflareinsights.com';
const ANALYTICS_CONNECT = 'https://cloudflareinsights.com';

function newNonce(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/** The CSP of an HTML page with this request's nonce, and room for Cloudflare's own scripts. */
export function withNonce(csp: string, nonce: string): string {
  return csp
    .split(';')
    .map((directive) => {
      const trimmed = directive.trim();
      if (trimmed.startsWith('script-src ')) return `${trimmed} 'nonce-${nonce}' ${ANALYTICS_SCRIPT}`;
      if (trimmed.startsWith('connect-src ')) return `${trimmed} ${ANALYTICS_CONNECT}`;
      return trimmed;
    })
    .filter(Boolean)
    .join('; ');
}

class NonceScripts {
  constructor(private readonly nonce: string) {}
  element(element: { setAttribute(name: string, value: string): void }) {
    element.setAttribute('nonce', this.nonce);
  }
}

interface HtmlRewriterLike {
  on(selector: string, handler: NonceScripts): HtmlRewriterLike;
  transform(response: Response): Response;
}
declare const HTMLRewriter: { new (): HtmlRewriterLike };

async function serveAsset(request: Request, env: Env): Promise<Response> {
  const response = await env.ASSETS.fetch(request);
  const csp = response.headers.get('content-security-policy');
  if (!csp || !(response.headers.get('content-type') ?? '').includes('text/html')) return response;
  const nonce = newNonce();
  const headers = new Headers(response.headers);
  headers.set('content-security-policy', withNonce(csp, nonce));
  const page = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  return new HTMLRewriter().on('script', new NonceScripts(nonce)).transform(page);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/health') return health(request, env);
    if (pathname === '/api' || pathname.startsWith('/api/')) return proxyApi(request, env);
    return serveAsset(request, env);
  },
};
