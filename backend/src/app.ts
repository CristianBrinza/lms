import { Hono } from 'hono';
import type { AppDeps, AppEnv } from './context';
import { AppError } from './lib/errors';
import { requestLocale } from './lib/i18n';
import { translateFields, translateMessage } from './lib/messages';
import {
  apiSecurityHeaders,
  hostGuard,
  importBodyLimit,
  jsonBodyLimit,
  noStore,
  originGuard,
  requestContext,
} from './middleware/security';
import { adminRoutes } from './modules/admin/routes';
import { authRoutes } from './modules/auth/routes';
import { foodRoutes } from './modules/food/routes';
import { trainingRoutes } from './modules/training/routes';
import { travelRoutes } from './modules/travel/routes';
import { watchingRoutes } from './modules/watching/routes';
import { avatarRoutes } from './modules/profile';
import { healthRoutes } from './modules/health';
import { liveSync } from './modules/live/publish';
import { liveRoutes } from './modules/live/routes';
import { mcpRoutes } from './modules/mcp/server';
import { meRoutes } from './modules/me/routes';
import { oauthMetadataRoutes, oauthRoutes } from './modules/oauth';
import { reminderRoutes } from './modules/reminders/routes';
import { webApp, webVersion } from './web';

export function createApp(deps: AppDeps) {
  const app = new Hono<AppEnv>();

  app.use('*', requestContext(deps), hostGuard(deps));
  app.use('/api/*', apiSecurityHeaders(deps), noStore, originGuard(deps));
  // A TV Time or Trakt export is bigger than any other body: that one route gets more room.
  app.use('/api/*', (c, next) =>
    c.req.path === '/api/watching/import' ? importBodyLimit(c, next) : jsonBodyLimit(c, next),
  );
  // Every change that works is announced to the household's open apps (GET /api/events).
  app.use('/api/*', liveSync(deps));

  app.route('/', oauthMetadataRoutes(deps));
  app.route('/api', healthRoutes(deps));
  app.route('/api/oauth', oauthRoutes(deps));
  app.route('/api/auth', authRoutes(deps));
  app.route('/api/events', liveRoutes(deps));
  app.route('/api/me', reminderRoutes(deps));
  app.route('/api/me', meRoutes(deps));
  app.route('/api/admin', adminRoutes(deps));
  app.route('/api/food', foodRoutes(deps));
  app.route('/api/training', trainingRoutes(deps));
  app.route('/api/travel', travelRoutes(deps));
  app.route('/api/watching', watchingRoutes(deps));
  app.route('/api/users', avatarRoutes(deps));
  app.route(
    '/api/mcp',
    mcpRoutes(deps, () => app),
  );

  // Production: the web app from the same server. /health is the one URL for uptime checks:
  // 200 only when the web build is there and the API (with its database) is fine.
  const webDir = deps.config.webDir;
  if (webDir) {
    const web = webApp(webDir);
    app.get('/health', async (c) => {
      const api = await app.request('/api/health');
      const body = (await api.json().catch(() => null)) as Record<string, unknown> | null;
      const version = webVersion(webDir);
      const ok = api.status === 200 && body?.status === 'ok' && version !== null;
      c.header('Cache-Control', 'no-store');
      return c.json(
        {
          status: ok ? 'ok' : 'down',
          web: version ?? { status: 'unavailable' },
          api: body ?? { status: 'unreachable' },
          time: new Date().toISOString(),
        },
        ok ? 200 : 503,
      );
    });
    app.get('*', (c, next) => (c.req.path.startsWith('/api/') ? next() : web(c)));
  }

  app.notFound((c) =>
    c.json(
      { error: { code: 'NOT_FOUND', message: translateMessage('Not found', requestLocale(c)) } },
      404,
    ),
  );

  // Errors are thrown in English; they are answered in the person's language (lib/messages.ts).
  app.onError((error, c) => {
    const locale = requestLocale(c);
    if (error instanceof AppError) {
      const fields = translateFields(error.fields, locale);
      for (const [name, value] of Object.entries(error.headers ?? {})) c.header(name, value);
      return c.json(
        {
          error: {
            code: error.code,
            message: translateMessage(error.message, locale),
            ...(fields ? { fields } : {}),
          },
        },
        error.status as 400,
      );
    }
    const requestId = c.get('requestId');
    // An MCP key in the path never reaches the logs.
    const path = new URL(c.req.url).pathname.replace(/\/api\/mcp\/k\/[^/]+/, '/api/mcp/k/…');
    console.error(`[api] ${c.req.method} ${path} failed (request ${requestId})`, error);
    return c.json(
      {
        error: {
          code: 'INTERNAL',
          message: translateMessage('Something went wrong', locale),
          requestId,
        },
      },
      500,
    );
  });

  return app;
}
