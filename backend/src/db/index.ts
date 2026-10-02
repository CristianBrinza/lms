import pg from 'pg';
import type { AppConfig } from '../config';

/**
 * PostgreSQL access: one pool, parameterised queries only, and a transaction helper.
 * Timestamps come back as Date, calendar dates as "YYYY-MM-DD"; bigint and numeric are parsed
 * to numbers (they stay small here).
 */

pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));
// Quantities and prices (numeric) are small enough for a JS number.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => Number(value));
// Calendar days (expiry, meal date) stay "YYYY-MM-DD": a Date would shift with the time zone.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

/** Anything that runs a parameterised query: the pool, or the client inside a transaction. */
export interface Queryable {
  query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]): Promise<pg.QueryResult<T>>;
}

export interface Database extends Queryable {
  /** Runs `work` in one transaction; rolls back if it throws. */
  tx<T>(work: (client: Queryable) => Promise<T>): Promise<T>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

export function createDatabase(config: Pick<AppConfig, 'database'>): Database {
  const pool = new pg.Pool({
    connectionString: config.database.url,
    max: config.database.poolMax,
    ssl: config.database.ssl ? { rejectUnauthorized: true } : undefined,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: 'lms-api',
  });
  // An idle client losing its connection (database restart) must not crash the process.
  pool.on('error', (error) => console.error('[db] idle client error', error.message));

  return {
    query: (text, params) => pool.query(text, params as unknown[]),
    async tx(work) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await work({ query: (text, params) => client.query(text, params as unknown[]) });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    async ping() {
      await pool.query('SELECT 1');
    },
    close: () => pool.end(),
  };
}

/** The database URL without its password, for logs. */
export function describeDatabase(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || 5432}${parsed.pathname}`;
  } catch {
    return 'unparseable DATABASE_URL';
  }
}
