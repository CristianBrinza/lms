import pg from 'pg';

/**
 * Tests run against a real PostgreSQL: TEST_DATABASE_URL, or the `lms_test` database on the
 * dev server from `yarn db:up` (created here when missing).
 */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://lms:lms@127.0.0.1:5433/lms_test';

export default async function setup() {
  if (process.env.TEST_DATABASE_URL) return;
  const url = new URL(TEST_DATABASE_URL);
  const name = url.pathname.slice(1);
  url.pathname = '/postgres';
  const client = new pg.Client({ connectionString: url.toString() });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(`No test database at ${url.host} (${(error as Error).message}). Start one with \`yarn db:up\` or set TEST_DATABASE_URL.`, { cause: error });
  }
  const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  if (!rowCount) await client.query(`CREATE DATABASE "${name}"`);
  await client.end();
}
