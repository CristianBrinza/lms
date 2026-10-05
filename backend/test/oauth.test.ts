import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { allowedRedirect } from '../src/modules/oauth';
import { APP_URL, setupTestApp } from './helpers';

const t = setupTestApp();
const REDIRECT = 'http://127.0.0.1:33418/callback';

/** What an assistant (Claude Code, Codex) does: register, then trade a code for a key. */
async function register(redirectUris = [REDIRECT], name = 'Claude Code') {
  const res = await t.app.request('/api/oauth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_name: name, redirect_uris: redirectUris }),
  });
  return { status: res.status, body: (await res.json()) as any };
}
function pkce() {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}
async function token(form: Record<string, string>) {
  const res = await t.app.request('/api/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
  });
  return { status: res.status, body: (await res.json()) as any };
}
async function mcp(key: string | null, body: unknown) {
  const res = await t.app.request('/api/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(key ? { authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, headers: res.headers, body: (await res.json()) as any };
}

describe('signing an assistant in to the MCP server (OAuth)', () => {
  it('tells an assistant without a key where to sign in', async () => {
    const res = await mcp(null, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe(
      `Bearer resource_metadata="${APP_URL}/.well-known/oauth-protected-resource/api/mcp"`,
    );
    const resource = await (
      await t.app.request('/.well-known/oauth-protected-resource/api/mcp')
    ).json();
    expect(resource).toMatchObject({
      resource: `${APP_URL}/api/mcp`,
      authorization_servers: [APP_URL],
    });
    const server = await (await t.app.request('/.well-known/oauth-authorization-server')).json();
    expect(server).toMatchObject({
      issuer: APP_URL,
      authorization_endpoint: `${APP_URL}/oauth/authorize`,
      token_endpoint: `${APP_URL}/api/oauth/token`,
      registration_endpoint: `${APP_URL}/api/oauth/register`,
      code_challenge_methods_supported: ['S256'],
    });
  });

  it('registers, asks the person, and hands over a key that works on MCP', async () => {
    await t.createUser({ email: 'ana@example.com', name: 'Ana' });
    const client = await register();
    expect(client.status).toBe(201);
    const clientId = client.body.client_id;

    const b = t.browser();
    await b.login('ana@example.com');
    expect((await b.get(`/api/oauth/clients/${clientId}`)).body.name).toBe('Claude Code');
    const { challenge } = pkce();
    const consent = await b.post('/api/oauth/authorize', {
      clientId,
      redirectUri: REDIRECT,
      codeChallenge: challenge,
      codeChallengeMethod: 'S256',
      scope: 'food',
      state: 'xyz',
      resource: `${APP_URL}/api/mcp`,
      approve: true,
    });
    expect(consent.status).toBe(200);
    const back = new URL(consent.body.redirect);
    expect(back.origin + back.pathname).toBe(REDIRECT);
    expect(back.searchParams.get('state')).toBe('xyz');
    expect(back.searchParams.get('iss')).toBe(APP_URL);
    const code = back.searchParams.get('code')!;

    // A wrong verifier spends the code: an intercepted code is useless.
    const stolen = await token({
      grant_type: 'authorization_code',
      code,
      code_verifier: pkce().verifier,
      redirect_uri: REDIRECT,
      client_id: clientId,
    });
    expect(stolen).toMatchObject({ status: 400, body: { error: 'invalid_grant' } });

    // Again, properly.
    const again = pkce();
    const second = await b.post('/api/oauth/authorize', {
      clientId,
      redirectUri: REDIRECT,
      codeChallenge: again.challenge,
      codeChallengeMethod: 'S256',
      scope: 'food',
      approve: true,
    });
    const code2 = new URL(second.body.redirect).searchParams.get('code')!;
    const form = {
      grant_type: 'authorization_code',
      code: code2,
      code_verifier: again.verifier,
      redirect_uri: REDIRECT,
      client_id: clientId,
    };
    const issued = await token(form);
    expect(issued.status).toBe(200);
    expect(issued.body).toMatchObject({ token_type: 'Bearer', scope: 'food' });
    expect(issued.body.access_token).toMatch(/^lms_/);
    expect((await token(form)).body.error).toBe('invalid_grant'); // a code works once

    const tools = await mcp(issued.body.access_token, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
    });
    expect(tools.status).toBe(200);
    expect(tools.body.result.tools.length).toBeGreaterThan(10);

    // It is an ordinary key: listed in the app under the assistant's name, revocable.
    const { keys } = (await b.get('/api/me/tokens')).body;
    expect(keys.find((k: any) => k.name === 'Claude Code')).toMatchObject({ scope: 'food' });

    // Connecting the same assistant again replaces its old key.
    const third = pkce();
    const reconnect = await b.post('/api/oauth/authorize', {
      clientId,
      redirectUri: REDIRECT,
      codeChallenge: third.challenge,
      codeChallengeMethod: 'S256',
      scope: 'food:read',
      approve: true,
    });
    const newer = await token({
      ...form,
      code: new URL(reconnect.body.redirect).searchParams.get('code')!,
      code_verifier: third.verifier,
    });
    expect(newer.body.scope).toBe('food:read');
    expect(
      (await mcp(issued.body.access_token, { jsonrpc: '2.0', id: 3, method: 'tools/list' }))
        .status,
    ).toBe(401);
  });

  it('refuses what would leak a code or a key', async () => {
    await t.createUser({ email: 'ana@example.com', name: 'Ana' });
    expect((await register(['http://evil.example/callback'])).body.error).toBe(
      'invalid_redirect_uri',
    );
    const { body } = await register();
    const b = t.browser();
    await b.login('ana@example.com');
    const ask = (over: Record<string, unknown>) =>
      b.post('/api/oauth/authorize', {
        clientId: body.client_id,
        redirectUri: REDIRECT,
        codeChallenge: pkce().challenge,
        codeChallengeMethod: 'S256',
        scope: 'food',
        approve: true,
        ...over,
      });
    // Never a redirect the assistant didn't register.
    expect((await ask({ redirectUri: 'http://127.0.0.1:9/other' })).status).toBe(400);
    // Admin access only from an admin.
    expect((await ask({ scope: 'admin' })).status).toBe(403);
    // Declining goes back with access_denied and no code.
    const declined = new URL((await ask({ approve: false })).body.redirect);
    expect(declined.searchParams.get('error')).toBe('access_denied');
    expect(declined.searchParams.get('code')).toBeNull();
    // Without being signed in to the app, there is no consent.
    expect((await t.browser().post('/api/oauth/authorize', {})).status).toBe(401);
  });

  it('accepts only https or this machine for redirects', () => {
    expect(allowedRedirect('https://claude.ai/api/mcp/auth_callback')).toBe(true);
    expect(allowedRedirect('http://localhost:8765/callback')).toBe(true);
    expect(allowedRedirect('http://[::1]:8765/callback')).toBe(true);
    expect(allowedRedirect('http://192.168.1.5/callback')).toBe(false);
    expect(allowedRedirect('javascript:alert(1)')).toBe(false);
    expect(allowedRedirect('https://a.example/cb#frag')).toBe(false);
  });
});
