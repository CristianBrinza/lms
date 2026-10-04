import { Hono } from 'hono';
import { BUILD } from '../build-info';
import type { AppDeps, AppEnv } from '../context';

/** GET /api/health — the Worker's /health and the deploy checks read this. */
export function healthRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  app.get('/health', async (c) => {
    let database: 'ok' | 'down' = 'ok';
    try {
      await deps.db.ping();
    } catch {
      database = 'down';
    }
    const ok = database === 'ok';
    return c.json(
      {
        status: ok ? 'ok' : 'down',
        service: 'lms-api',
        version: BUILD.version,
        builtAt: BUILD.builtAt,
        database,
        time: deps.now().toISOString(),
      },
      ok ? 200 : 503,
    );
  });
  return app;
}
