import { Hono } from 'hono';
import type { AppDeps, AppEnv } from './context';
import { AppError } from './lib/errors';
import {
  apiSecurityHeaders,
  jsonBodyLimit,
  noStore,
  originGuard,
  proxyGuard,
  requestContext,
} from './middleware/security';
import { adminRoutes } from './modules/admin/routes';
import { authRoutes } from './modules/auth/routes';
import { foodRoutes } from './modules/food/routes';
import { trainingRoutes } from './modules/training/routes';
import { avatarRoutes } from './modules/profile';
import { healthRoutes } from './modules/health';
import { mcpRoutes } from './modules/mcp/server';
import { meRoutes } from './modules/me/routes';
import { reminderRoutes } from './modules/reminders/routes';

export function createApp(deps: AppDeps) {
  const app = new Hono<AppEnv>();

  app.use('*', proxyGuard(deps), requestContext(deps));
  app.use('/api/*', apiSecurityHeaders(deps), noStore, originGuard(deps), jsonBodyLimit);

  app.route('/api', healthRoutes(deps));
  app.route('/api/auth', authRoutes(deps));
  app.route('/api/me', reminderRoutes(deps));
  app.route('/api/me', meRoutes(deps));
  app.route('/api/admin', adminRoutes(deps));
  app.route('/api/food', foodRoutes(deps));
  app.route('/api/training', trainingRoutes(deps));
  app.route('/api/users', avatarRoutes(deps));
  app.route(
    '/api/mcp',
    mcpRoutes(deps, () => app),
  );

  app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404));

  app.onError((error, c) => {
    if (error instanceof AppError) {
      for (const [name, value] of Object.entries(error.headers ?? {})) c.header(name, value);
      return c.json(
        {
          error: {
            code: error.code,
            message: error.message,
            ...(error.fields ? { fields: error.fields } : {}),
          },
        },
        error.status as 400,
      );
    }
    const requestId = c.get('requestId');
    // An MCP key in the path never reaches the logs.
    const path = new URL(c.req.url).pathname.replace(/\/api\/mcp\/k\/[^/]+/, '/api/mcp/k/…');
    console.error(`[api] ${c.req.method} ${path} failed (request ${requestId})`, error);
    return c.json({ error: { code: 'INTERNAL', message: 'Something went wrong', requestId } }, 500);
  });

  return app;
}
