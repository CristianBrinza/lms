import { createHash, timingSafeEqual } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { AppDeps, AppEnv } from '../context';
import { randomToken, sha256Hex } from '../lib/crypto';
import { AppError } from '../lib/errors';
import { enforceRateLimits } from '../lib/rate-limit';
import { readJson } from '../lib/validation';
import { requireAuth, sessionOf } from '../middleware/auth';
import { createToken, TOKEN_SCOPES, type PublicScope, type TokenScope } from './tokens';
import { findUserById } from './users';

/**
 * Sign-in for assistants on the MCP server (OAuth 2.1, as the MCP spec has it): Claude Code,
 * Codex, claude.ai's connectors, ChatGPT. The assistant finds this server through the metadata
 * below, registers itself, and sends the person to the app's consent page (/oauth/authorize);
 * signed in there, they pick what it may do, and the assistant trades the code (with PKCE) for an
 * ordinary access key, shown and revocable in Settings → Claude access like any other.
 *
 * Public clients only (no client secrets: native apps and loopback redirects), S256 PKCE only,
 * codes single-use for ten minutes. A key is long-lived and revocable, so no refresh tokens.
 */

const CODE_TTL_MS = 10 * 60 * 1000;

export const SCOPE_TEXT: Record<PublicScope, string> = {
  'food:read': 'Look at the kitchen, recipes, lists, the plan and training; change nothing',
  food: 'Read and change everything in Food, the House and Training',
  admin: 'Everything, plus people’s accounts',
};

const urls = (deps: AppDeps) => {
  const issuer = deps.config.appUrl;
  return {
    issuer,
    resource: `${issuer}/api/mcp`,
    resourceMetadata: `${issuer}/.well-known/oauth-protected-resource/api/mcp`,
  };
};

/** The header that tells an assistant where to sign in (on a 401 from /api/mcp). */
export function mcpChallenge(deps: AppDeps, error?: 'invalid_token'): string {
  return `Bearer resource_metadata="${urls(deps).resourceMetadata}"${error ? `, error="${error}"` : ''}`;
}

/** https anywhere, or http on this machine (the loopback redirects of Claude Code and Codex). */
export function allowedRedirect(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.hash || url.username || url.password) return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

const RegisterInput = z.object({
  client_name: z.string().trim().min(1).max(80).optional(),
  redirect_uris: z.array(z.string().max(500)).min(1).max(10),
  token_endpoint_auth_method: z.string().optional(),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
});

const AuthorizeInput = z.object({
  clientId: z.string().min(1).max(100),
  redirectUri: z.string().min(1).max(500),
  codeChallenge: z.string().min(43).max(128),
  codeChallengeMethod: z.literal('S256', 'Only S256 PKCE'),
  scope: z.enum(TOKEN_SCOPES),
  state: z.string().max(500).optional(),
  resource: z.string().max(500).optional(),
  approve: z.boolean(),
});

interface ClientRow {
  id: string;
  name: string;
  redirect_uris: string[];
}

async function findClient(deps: AppDeps, id: string): Promise<ClientRow | null> {
  const { rows } = await deps.db.query<ClientRow>(
    'SELECT id, name, redirect_uris FROM oauth_clients WHERE id = $1',
    [id],
  );
  return rows[0] ?? null;
}

/** OAuth's own error shape (RFC 6749 §5.2), not the app's. */
const oauthError = (c: Context, status: 400 | 401, error: string, description: string) =>
  c.json({ error, error_description: description }, status, { 'Cache-Control': 'no-store' });

/** The token and registration endpoints are called by the assistants' own code, from anywhere. */
const openCors = (c: Context) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Headers', 'content-type, authorization, mcp-protocol-version');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
};

const s256 = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

function sameString(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** /.well-known/… metadata (mounted at the root, before the web app). */
export function oauthMetadataRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  const protectedResource = (c: Context) => {
    openCors(c);
    const { issuer, resource } = urls(deps);
    return c.json({
      resource,
      authorization_servers: [issuer],
      scopes_supported: TOKEN_SCOPES,
      bearer_methods_supported: ['header'],
      resource_name: 'LMS',
    });
  };
  app.get('/.well-known/oauth-protected-resource', protectedResource);
  app.get('/.well-known/oauth-protected-resource/api/mcp', protectedResource);
  app.get('/.well-known/oauth-authorization-server', (c) => {
    openCors(c);
    const { issuer } = urls(deps);
    return c.json({
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/api/oauth/token`,
      registration_endpoint: `${issuer}/api/oauth/register`,
      scopes_supported: TOKEN_SCOPES,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    });
  });
  app.options('/.well-known/*', (c) => {
    openCors(c);
    return c.body(null, 204);
  });
  return app;
}

/** /api/oauth/… */
export function oauthRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();

  app.options('/register', (c) => (openCors(c), c.body(null, 204)));
  app.options('/token', (c) => (openCors(c), c.body(null, 204)));

  // Dynamic client registration (RFC 7591): an assistant introduces itself.
  app.post('/register', async (c) => {
    openCors(c);
    await enforceRateLimits(deps, [
      { key: `oauth-register:${c.get('ip')}`, limit: 20, windowSec: 60 * 60 },
    ]);
    const body = RegisterInput.safeParse(await c.req.json().catch(() => null));
    if (!body.success)
      return oauthError(c, 400, 'invalid_client_metadata', 'redirect_uris are required');
    const bad = body.data.redirect_uris.find((uri) => !allowedRedirect(uri));
    if (bad)
      return oauthError(
        c,
        400,
        'invalid_redirect_uri',
        'Redirects must be https, or http on localhost',
      );
    if (body.data.token_endpoint_auth_method && body.data.token_endpoint_auth_method !== 'none')
      return oauthError(c, 400, 'invalid_client_metadata', 'Only public clients (no secret)');
    const id = `lms_client_${randomToken(18)}`;
    const name = body.data.client_name ?? 'An assistant';
    await deps.db.query(
      'INSERT INTO oauth_clients (id, name, redirect_uris, created_at) VALUES ($1, $2, $3, $4)',
      [id, name, body.data.redirect_uris, deps.now()],
    );
    return c.json(
      {
        client_id: id,
        client_name: name,
        redirect_uris: body.data.redirect_uris,
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code'],
        response_types: ['code'],
      },
      201,
    );
  });

  // For the consent page: who is asking (the name it registered with).
  app.get('/clients/:id', requireAuth(deps), async (c) => {
    const client = await findClient(deps, c.req.param('id'));
    if (!client) throw new AppError(404, 'NOT_FOUND', 'This assistant isn’t registered');
    return c.json({ id: client.id, name: client.name, scopes: SCOPE_TEXT });
  });

  // The person's answer on the consent page (signed in to the app, never with a key).
  app.post('/authorize', requireAuth(deps), async (c) => {
    sessionOf(c);
    const user = c.get('user')!;
    const input = await readJson(c, AuthorizeInput);
    const client = await findClient(deps, input.clientId);
    if (!client) throw new AppError(400, 'VALIDATION', 'This assistant isn’t registered');
    // Never redirect anywhere the assistant didn't register: no open redirect.
    if (!client.redirect_uris.includes(input.redirectUri))
      throw new AppError(400, 'VALIDATION', 'That return address isn’t this assistant’s');
    const back = new URL(input.redirectUri);
    if (input.state !== undefined) back.searchParams.set('state', input.state);
    back.searchParams.set('iss', urls(deps).issuer);
    if (input.resource && input.resource !== urls(deps).resource) {
      back.searchParams.set('error', 'invalid_target');
      return c.json({ redirect: back.toString() });
    }
    if (!input.approve) {
      back.searchParams.set('error', 'access_denied');
      return c.json({ redirect: back.toString() });
    }
    if (input.scope === 'admin' && user.role !== 'admin')
      throw new AppError(403, 'FORBIDDEN', 'Only admins can give an assistant admin access');
    const code = randomToken(32);
    await deps.db.query(
      `INSERT INTO oauth_codes (code_hash, client_id, user_id, redirect_uri, code_challenge, scope, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        sha256Hex(code),
        client.id,
        user.id,
        input.redirectUri,
        input.codeChallenge,
        input.scope,
        new Date(deps.now().getTime() + CODE_TTL_MS),
      ],
    );
    back.searchParams.set('code', code);
    return c.json({ redirect: back.toString() });
  });

  // The code (and the PKCE verifier) for an access key. Form-encoded, as OAuth sends it.
  app.post('/token', async (c) => {
    openCors(c);
    await enforceRateLimits(deps, [
      { key: `oauth-token:${c.get('ip')}`, limit: 60, windowSec: 10 * 60 },
    ]);
    const type = c.req.header('content-type') ?? '';
    const form: Record<string, string> = type.includes('application/json')
      ? ((await c.req.json().catch(() => ({}))) as Record<string, string>)
      : Object.fromEntries(
          [...new URLSearchParams(await c.req.text()).entries()].map(([k, v]) => [k, v]),
        );
    if (form.grant_type !== 'authorization_code')
      return oauthError(c, 400, 'unsupported_grant_type', 'Only authorization_code');
    const { code, code_verifier: verifier, redirect_uri: redirectUri, client_id: clientId } = form;
    if (!code || !verifier || !redirectUri || !clientId)
      return oauthError(
        c,
        400,
        'invalid_request',
        'code, code_verifier, redirect_uri and client_id are required',
      );
    if (form.resource && form.resource !== urls(deps).resource)
      return oauthError(c, 400, 'invalid_target', 'This server is only the LMS MCP server');

    // Spend the code first (once, atomically); then check it was meant for this request.
    const { rows } = await deps.db.query<{
      client_id: string;
      user_id: string;
      redirect_uri: string;
      code_challenge: string;
      scope: TokenScope;
      expires_at: Date;
    }>(
      `UPDATE oauth_codes SET used_at = $2 WHERE code_hash = $1 AND used_at IS NULL
       RETURNING client_id, user_id, redirect_uri, code_challenge, scope, expires_at`,
      [sha256Hex(code), deps.now()],
    );
    const grant = rows[0];
    if (
      !grant ||
      grant.expires_at < deps.now() ||
      grant.client_id !== clientId ||
      grant.redirect_uri !== redirectUri ||
      !sameString(s256(verifier), grant.code_challenge)
    )
      return oauthError(c, 400, 'invalid_grant', 'The code is wrong, used or expired');

    const client = await findClient(deps, clientId);
    const user = await findUserById(deps.db, grant.user_id);
    if (!client || !user?.isActive)
      return oauthError(c, 400, 'invalid_grant', 'No longer allowed');
    // One key per assistant and person: connecting again replaces the old one.
    await deps.db.query(
      'UPDATE api_tokens SET revoked_at = $3 WHERE user_id = $1 AND oauth_client_id = $2 AND revoked_at IS NULL',
      [user.id, client.id, deps.now()],
    );
    const { token } = await createToken(deps, user, {
      name: client.name,
      scope: grant.scope,
      oauthClientId: client.id,
    });
    return c.json(
      { access_token: token, token_type: 'Bearer', scope: grant.scope },
      200,
      { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
    );
  });

  return app;
}
