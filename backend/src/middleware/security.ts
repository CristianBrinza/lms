import { bodyLimit } from 'hono/body-limit';
import { createMiddleware } from 'hono/factory';
import { secureHeaders } from 'hono/secure-headers';
import type { AppDeps, AppEnv } from '../context';
import { AppError } from '../lib/errors';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const OAUTH_OPEN = new Set(['/api/oauth/token', '/api/oauth/register']);

/** Request id + resolved client IP, available to every handler. */
export function requestContext(deps: AppDeps) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const requestId = crypto.randomUUID();
    c.set('requestId', requestId);
    c.set('ip', deps.clientIp(c));
    await next();
    c.header('X-Request-Id', requestId);
  });
}

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Answers only requests addressed to the app's own host (APP_URL), or to this machine for checks
 * (localhost, any port). A web page whose DNS is rebound to this machine, or a hostname routed to
 * the tunnel by mistake, gets nothing. Development lets everything in (the phone on the LAN).
 */
export function hostGuard(deps: AppDeps) {
  const own = new URL(deps.config.appUrl).host;
  return createMiddleware<AppEnv>(async (c, next) => {
    if (deps.config.env !== 'development') {
      const host = (c.req.header('host') ?? new URL(c.req.url).host).toLowerCase();
      let hostname = '';
      try {
        hostname = new URL(`http://${host}`).hostname;
      } catch {
        // not a host at all: refused below
      }
      if (host !== own && !LOCAL_HOSTNAMES.has(hostname))
        throw new AppError(421, 'MISDIRECTED_REQUEST', 'Unknown host');
    }
    await next();
  });
}

/** Strict headers for JSON API responses: no caching, no framing, no sniffing. */
export function apiSecurityHeaders(deps: AppDeps) {
  return secureHeaders({
    contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    crossOriginResourcePolicy: 'same-origin',
    crossOriginOpenerPolicy: 'same-origin',
    referrerPolicy: 'no-referrer',
    strictTransportSecurity: deps.config.isProd ? 'max-age=63072000; includeSubDomains' : false,
    xFrameOptions: 'DENY',
    permissionsPolicy: { camera: [], microphone: [], geolocation: [], payment: [] },
  });
}

/** API responses are private and uncacheable unless a route opts into caching explicitly. */
export const noStore = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  if (!c.res.headers.has('Cache-Control')) c.header('Cache-Control', 'no-store');
});

/**
 * CSRF defence in depth for requests that change data. Cookies are SameSite=Strict, and on top
 * of that: a same-origin fetch (Fetch Metadata), an allowed Origin, and a JSON body (which
 * cross-site forms cannot send without a CORS preflight, and this API answers none).
 */
export function originGuard(deps: AppDeps) {
  const allowed = new Set(deps.config.allowedOrigins);
  const isAllowed = (origin: string) =>
    allowed.has(origin) ||
    (deps.config.env === 'development' && isLanDevOrigin(origin, deps.config.appUrl));
  return createMiddleware<AppEnv>(async (c, next) => {
    // OAuth's token and registration endpoints: called by assistants' own code from anywhere,
    // form-encoded, never with cookies (so no CSRF to stop).
    if (OAUTH_OPEN.has(c.req.path)) return next();
    if (UNSAFE_METHODS.has(c.req.method)) {
      const site = c.req.header('sec-fetch-site');
      if (site && site !== 'same-origin' && site !== 'none')
        throw new AppError(403, 'CSRF_REJECTED', 'Cross-site request rejected');
      const origin = c.req.header('origin');
      if (origin && !isAllowed(origin))
        throw new AppError(403, 'CSRF_REJECTED', 'Origin not allowed');
      // Judge by the headers, not by `body`: the Node adapter gives every POST a body stream,
      // even an empty one (logout, refresh), which must not need a Content-Type.
      const length = c.req.header('content-length');
      const hasBody =
        (length !== undefined && Number(length) > 0) ||
        c.req.header('transfer-encoding') !== undefined;
      const type = (c.req.header('content-type') ?? '').toLowerCase();
      if (hasBody && !type.startsWith('application/json')) {
        throw new AppError(415, 'BAD_REQUEST', 'Content-Type must be application/json');
      }
    }
    await next();
  });
}

/**
 * Development only: the dev server opened from a phone on the same network
 * (`yarn --cwd frontend dev:lan`, e.g. http://192.168.1.20:5190).
 */
export function isLanDevOrigin(origin: string, appUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const port = new URL(appUrl).port;
  const privateHost =
    /^(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/;
  return url.protocol === 'http:' && url.port === port && privateHost.test(url.hostname);
}

/** 32 KB is plenty for every JSON body this API accepts. */
export const jsonBodyLimit = bodyLimit({
  maxSize: 32 * 1024,
  onError: () => {
    throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large');
  },
});
