import { z } from 'zod';

/**
 * Every setting comes from the environment (backend/.env locally, deploy/.env on the server),
 * validated once at start. Production refuses to start with missing or placeholder secrets.
 */

export type Role = 'member' | 'admin';
export const ROLES: readonly Role[] = ['member', 'admin'];

const bool = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((value) =>
      value === undefined || value === '' ? fallback : /^(1|true|yes|on)$/i.test(value),
    );

const int = (fallback: number, min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((value) => (value === undefined || value === '' ? fallback : Number(value)))
    .pipe(z.number().int().min(min).max(max));

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() !== '' ? value.trim() : undefined));

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: int(8790, 1, 65_535),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_SSL: bool(false),
  DATABASE_POOL_MAX: int(10, 1, 100),
  APP_URL: z.url('APP_URL must be the web app address, e.g. https://lms.example.com'),
  ALLOWED_ORIGINS: optionalString,
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_PREVIOUS_SECRET: optionalString,
  ACCESS_TOKEN_TTL_MIN: int(15, 1, 120),
  REMEMBER_DAYS: int(365, 1, 400),
  SESSION_HOURS: int(12, 1, 168),
  /**
   * Behind the Cloudflare Tunnel: the proxies (host names or addresses, comma-separated; in
   * production `tunnel`) whose cf-connecting-ip header gives the visitor's address. Empty: none.
   */
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? '')
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name && !/^(0|false|no|off)$/i.test(name)),
    )
    .refine((names) => !names.some((name) => /^(1|true|yes|on)$/i.test(name)), {
      message: 'TRUST_PROXY names the proxy whose header is believed (e.g. tunnel), not true',
    }),
  /** The built web app (frontend/dist) to serve next to the API; unset in development. */
  WEB_DIR: optionalString,
  RATE_LIMITS: bool(true),
  PASSWORD_HASH_COST: z.enum(['standard', 'fast']).default('standard'),
  ADMIN_EMAIL: optionalString,
  ADMIN_PASSWORD: optionalString,
  ADMIN_NAME: optionalString,
  ADMIN_SURNAME: optionalString,
  /** Web push (reminders): `npx web-push generate-vapid-keys`. Without them, reminders are off. */
  VAPID_PUBLIC_KEY: optionalString,
  VAPID_PRIVATE_KEY: optionalString,
  VAPID_SUBJECT: optionalString,
  /** TMDB (Watching): a v4 read access token or a v3 API key. Without it, Watching says so. */
  TMDB_API_KEY: optionalString,
});

export interface AppConfig {
  env: 'development' | 'production' | 'test';
  isProd: boolean;
  port: number;
  database: { url: string; ssl: boolean; poolMax: number };
  appUrl: string;
  allowedOrigins: string[];
  cookieSecure: boolean;
  /** Web push keys; null when reminders can't be sent. */
  push: { publicKey: string; privateKey: string; subject: string } | null;
  jwt: {
    secret: Uint8Array;
    previousSecret: Uint8Array | null;
    issuer: string;
    audience: string;
    accessTtlSec: number;
  };
  session: { rememberDays: number; sessionHours: number };
  /** The built web app this server also serves (production), or null. */
  webDir: string | null;
  /** The proxies whose cf-connecting-ip is believed (lib/client-ip.ts); empty: none. */
  trustProxy: string[];
  rateLimits: boolean;
  passwordHashCost: 'standard' | 'fast';
  bootstrapAdmin: { email: string; password: string; name: string; surname: string } | null;
  /** TMDB for Watching; null when no key is configured. */
  tmdb: { apiKey: string } | null;
}

const PLACEHOLDER = /^(change[-_ ]?me|secret|password|test|example|placeholder|x+)$/i;

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid configuration:\n  - ${problems.join('\n  - ')}`);
    this.name = 'ConfigError';
  }
}

export function loadConfig(source: Record<string, string | undefined>): AppConfig {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new ConfigError(
      parsed.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`),
    );
  }
  const env = parsed.data;
  const isProd = env.NODE_ENV === 'production';
  const appUrl = new URL(env.APP_URL).origin;
  const problems: string[] = [];

  if (isProd) {
    if (!appUrl.startsWith('https://')) problems.push('APP_URL must use https:// in production');
    if (PLACEHOLDER.test(env.JWT_SECRET)) problems.push('JWT_SECRET is a placeholder');
    if (env.PASSWORD_HASH_COST === 'fast')
      problems.push('PASSWORD_HASH_COST=fast is for tests only');
    if (!env.RATE_LIMITS) problems.push('RATE_LIMITS cannot be turned off in production');
  }

  const admin =
    env.ADMIN_EMAIL && env.ADMIN_PASSWORD
      ? {
          email: env.ADMIN_EMAIL.toLowerCase(),
          password: env.ADMIN_PASSWORD,
          name: env.ADMIN_NAME ?? 'Admin',
          surname: env.ADMIN_SURNAME ?? '',
        }
      : null;
  if (admin && admin.password.length < 10)
    problems.push('ADMIN_PASSWORD must be at least 10 characters');
  if (problems.length > 0) throw new ConfigError(problems);

  const extraOrigins = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => new URL(origin).origin);

  const encoder = new TextEncoder();
  return {
    env: env.NODE_ENV,
    isProd,
    port: env.PORT,
    database: { url: env.DATABASE_URL, ssl: env.DATABASE_SSL, poolMax: env.DATABASE_POOL_MAX },
    appUrl,
    allowedOrigins: [...new Set([appUrl, ...extraOrigins])],
    // __Host- / __Secure- cookies need HTTPS; plain-HTTP local development uses plain names.
    cookieSecure: appUrl.startsWith('https://'),
    jwt: {
      secret: encoder.encode(env.JWT_SECRET),
      previousSecret: env.JWT_PREVIOUS_SECRET ? encoder.encode(env.JWT_PREVIOUS_SECRET) : null,
      issuer: 'lms-api',
      audience: 'lms-app',
      accessTtlSec: env.ACCESS_TOKEN_TTL_MIN * 60,
    },
    session: { rememberDays: env.REMEMBER_DAYS, sessionHours: env.SESSION_HOURS },
    webDir: env.WEB_DIR ?? null,
    trustProxy: env.TRUST_PROXY,
    rateLimits: env.RATE_LIMITS,
    passwordHashCost: env.PASSWORD_HASH_COST,
    bootstrapAdmin: admin,
    tmdb: env.TMDB_API_KEY ? { apiKey: env.TMDB_API_KEY } : null,
    push:
      env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
        ? {
            publicKey: env.VAPID_PUBLIC_KEY,
            privateKey: env.VAPID_PRIVATE_KEY,
            subject: env.VAPID_SUBJECT ?? `mailto:admin@${new URL(appUrl).hostname}`,
          }
        : null,
  };
}
