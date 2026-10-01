import type { Database } from './index';

/**
 * Schema changes, applied in order on start and recorded in schema_migrations. Never edit a
 * migration that has shipped: add the next one. Kept in code (not .sql files) so the API ships
 * as one bundled file.
 */
export const MIGRATIONS: ReadonlyArray<{ version: number; name: string; sql: string }> = [
  {
    version: 1,
    name: 'users, sessions, rate limits, audit log',
    sql: `
      CREATE TABLE users (
        id uuid PRIMARY KEY,
        email text NOT NULL,
        name text NOT NULL,
        surname text NOT NULL DEFAULT '',
        role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
        password_hash text NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        must_change_password boolean NOT NULL DEFAULT false,
        token_version integer NOT NULL DEFAULT 0,
        last_login_at timestamptz,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX users_email_key ON users (lower(email));

      CREATE TABLE sessions (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        token_hash text NOT NULL UNIQUE,
        prev_token_hash text,
        rotated_at timestamptz,
        remember boolean NOT NULL,
        user_agent text NOT NULL DEFAULT '',
        ip text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        last_used_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz
      );
      CREATE INDEX sessions_user_idx ON sessions (user_id) WHERE revoked_at IS NULL;
      CREATE INDEX sessions_prev_token_idx ON sessions (prev_token_hash) WHERE prev_token_hash IS NOT NULL;
      CREATE INDEX sessions_expires_idx ON sessions (expires_at);

      CREATE TABLE rate_limits (
        key text PRIMARY KEY,
        count integer NOT NULL,
        expires_at timestamptz NOT NULL
      );
      CREATE INDEX rate_limits_expires_idx ON rate_limits (expires_at);

      CREATE TABLE audit_log (
        id bigserial PRIMARY KEY,
        actor_id uuid REFERENCES users (id) ON DELETE SET NULL,
        action text NOT NULL,
        target_id uuid REFERENCES users (id) ON DELETE SET NULL,
        meta jsonb NOT NULL DEFAULT '{}'::jsonb,
        ip text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);
    `,
  },
];

/** Applies pending migrations. An advisory lock keeps two starting processes from racing. */
export async function migrate(db: Database, log: (message: string) => void = () => undefined): Promise<void> {
  await db.tx(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(727274)');
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         version integer PRIMARY KEY,
         name text NOT NULL,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    const { rows } = await client.query<{ version: number }>('SELECT version FROM schema_migrations');
    const applied = new Set(rows.map((row) => row.version));
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) continue;
      await client.query(migration.sql);
      await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [migration.version, migration.name]);
      log(`applied migration ${migration.version}: ${migration.name}`);
    }
  });
}

/** Removes expired sessions and rate-limit windows (run hourly by the server). */
export async function cleanup(db: Database, now: Date): Promise<void> {
  await db.query('DELETE FROM rate_limits WHERE expires_at < $1::timestamptz', [now]);
  // Revoked or expired sessions are kept a month, then dropped.
  await db.query(
    `DELETE FROM sessions WHERE expires_at < $1::timestamptz - interval '30 days' OR revoked_at < $1::timestamptz - interval '30 days'`,
    [now],
  );
  await db.query(`DELETE FROM audit_log WHERE created_at < $1::timestamptz - interval '365 days'`, [now]);
}
