import { describe, expect, it } from 'vitest';
import {
  claimNext,
  createThread,
  finishMessage,
  sendMessage,
  stopMessage,
} from '../src/modules/assistant/service';
import { createToken, tokenMayAccess } from '../src/modules/tokens';
import { setupTestApp } from './helpers';

const t = setupTestApp();

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

async function admin(email = 'boss@example.com') {
  const user = await t.createUser({ email, role: 'admin', name: 'Cristian' });
  const b = t.browser();
  await b.login(email);
  return { user, b };
}

/** A client with only a key (no cookies, no Origin), like the bridge script. */
function keyed(token: string) {
  async function request(method: string, path: string, body?: unknown) {
    const res = await t.app.request(path, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }
  return {
    get: (path: string) => request('GET', path),
    post: (path: string, body?: unknown) => request('POST', path, body ?? {}),
  };
}

async function setup() {
  const { user, b } = await admin();
  const bridgeKey = (await createToken(t.deps, user, { name: 'Bridge', scope: 'assistant-bridge' })).token;
  const thread = await createThread(t.deps, user.id, 'assistant');
  return { user, b, bridge: keyed(bridgeKey), thread, bridgeKey };
}

describe('assistant: who may use it', () => {
  it('is for admins signed in the app only', async () => {
    const member = await t.createUser({ email: 'm@example.com' });
    const mb = t.browser();
    await mb.login(member.email);
    expect((await mb.get('/api/assistant/threads')).status).toBe(403);
    const { b } = await admin();
    expect((await b.get('/api/assistant/threads')).status).toBe(200);
    expect((await t.browser().get('/api/assistant/threads')).status).toBe(401);
  });

  it('keeps the bridge key inside /api/assistant/bridge/', async () => {
    const { b, bridge, bridgeKey, user } = await setup();
    expect(tokenMayAccess('assistant-bridge', 'GET', '/api/assistant/bridge/next')).toBe(true);
    expect(tokenMayAccess('assistant-bridge', 'GET', '/api/assistant/threads')).toBe(false);
    expect(tokenMayAccess('assistant-bridge', 'GET', '/api/food/stock')).toBe(false);
    expect(tokenMayAccess('assistant-bridge', 'GET', '/api/me')).toBe(false);
    expect(tokenMayAccess('admin', 'GET', '/api/assistant/bridge/next')).toBe(false);
    expect(tokenMayAccess('food', 'POST', '/api/assistant/threads')).toBe(false);

    expect((await bridge.get('/api/assistant/threads')).status).toBe(403);
    expect((await bridge.get('/api/me')).status).toBe(403);
    expect((await bridge.post('/api/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list' })).status).toBe(403);
    // Another kind of key, and a signed-in person, can't use the bridge's routes.
    const admKey = (await createToken(t.deps, user, { name: 'Admin', scope: 'admin' })).token;
    expect((await keyed(admKey).post('/api/assistant/bridge/reset')).status).toBe(403);
    expect((await b.post('/api/assistant/bridge/reset')).status).toBe(403);
    expect((await keyed(bridgeKey).post('/api/assistant/bridge/reset')).status).toBe(200);
  });

  it('gives bridge keys to admins only', async () => {
    const member = await t.createUser({ email: 'm2@example.com' });
    await expect(
      createToken(t.deps, member, { name: 'x', scope: 'assistant-bridge' }),
    ).rejects.toMatchObject({ status: 403 });
    const { b } = await admin('b2@example.com');
    const res = await b.post('/api/me/tokens', { name: 'x', scope: 'assistant-bridge' });
    expect(res.status).toBe(400);
  });
});

describe('assistant: the queue', () => {
  it('hands out one job at a time, oldest first, and waits for the one running', async () => {
    const { user, thread } = await setup();
    const other = await createThread(t.deps, user.id, 'developer');
    const first = await sendMessage(t.deps, user.id, thread.id, { text: 'one', attachmentIds: [] });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await sendMessage(t.deps, user.id, other.id, { text: 'two', attachmentIds: [] });

    const job = await claimNext(t.deps);
    expect(job).toMatchObject({ type: 'chat', id: first, mode: 'assistant', text: 'one' });
    // The first is running: nothing else is handed out.
    expect(await claimNext(t.deps)).toBeNull();
    await finishMessage(t.deps, first, { ok: true, text: 'hi', sessionId: 'sess-1' });
    const next = await claimNext(t.deps);
    expect(next).toMatchObject({ type: 'chat', id: second, mode: 'developer' });
    expect(await claimNext(t.deps)).toBeNull();
  });

  it('keeps main-chat messages away from the bridge, and the bridge’s away from the relay', async () => {
    const { user, thread, bridge } = await setup();
    const main = await createThread(t.deps, user.id, 'main');
    const mainMsg = await sendMessage(t.deps, user.id, main.id, { text: 'for the desktop chat', attachmentIds: [] });
    // The bridge (default modes, or named) never sees it.
    expect(await claimNext(t.deps)).toBeNull();
    expect(await claimNext(t.deps, ['assistant', 'developer'])).toBeNull();
    // Peeking lists it without claiming.
    const peek = await bridge.get('/api/assistant/bridge/queue?modes=main');
    expect(peek.body.queued).toHaveLength(1);
    expect(peek.body.queued[0]).toMatchObject({ id: mainMsg, text: 'for the desktop chat' });
    expect((await bridge.get('/api/assistant/bridge/queue')).body.queued).toHaveLength(0);

    // A bridge message is queued too; the relay only gets the main one.
    const mine = await sendMessage(t.deps, user.id, thread.id, { text: 'for the bridge', attachmentIds: [] });
    const claimed = (await bridge.get('/api/assistant/bridge/next?modes=main')).body.job;
    expect(claimed).toMatchObject({ type: 'chat', id: mainMsg, mode: 'main', text: 'for the desktop chat' });
    // A running main reply doesn't block the bridge, and the bridge's doesn't block the relay.
    expect(await claimNext(t.deps)).toMatchObject({ id: mine, mode: 'assistant' });
    // Restarting the bridge doesn't fail the main reply.
    expect((await bridge.post('/api/assistant/bridge/reset')).status).toBe(200);
    expect(
      (await bridge.post(`/api/assistant/bridge/messages/${mainMsg}/progress`, { progress: 'Looking' })).body,
    ).toEqual({ stop: false });
    await finishMessage(t.deps, mainMsg, { ok: true, text: 'done' });
  });

  it('runs a voice note and a message in the order they were asked', async () => {
    const { b, bridge, user, thread } = await setup();
    const up = await b.post('/api/assistant/attachments', { kind: 'audio', mime: 'audio/mp4', data: 'AAAA' });
    expect(up.status).toBe(201);
    const audioId = up.body.attachment.id as string;
    // Asked for, but the bridge isn't polling yet: 202.
    const asked = await b.post('/api/assistant/transcribe', { attachmentId: audioId, waitSec: 0 });
    expect(asked.status).toBe(202);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const reply = await sendMessage(t.deps, user.id, thread.id, { text: 'later', attachmentIds: [] });

    const first = await bridge.get('/api/assistant/bridge/next');
    expect(first.body.job).toEqual({ type: 'transcribe', id: audioId, mime: 'audio/mp4' });
    const bytes = await t.app.request(`/api/assistant/bridge/attachments/${audioId}`, {
      headers: { authorization: `Bearer ${(await createToken(t.deps, user, { name: 'k', scope: 'assistant-bridge' })).token}` },
    });
    expect(bytes.status).toBe(200);
    expect((await bytes.arrayBuffer()).byteLength).toBe(3);

    expect((await bridge.post(`/api/assistant/bridge/transcriptions/${audioId}/done`, { text: ' Salut, lume ' })).status).toBe(200);
    const text = await b.post('/api/assistant/transcribe', { attachmentId: audioId, waitSec: 1 });
    expect(text.status).toBe(200);
    expect(text.body).toMatchObject({ status: 'done', text: 'Salut, lume' });

    const second = await bridge.get('/api/assistant/bridge/next');
    expect(second.body.job).toMatchObject({ type: 'chat', id: reply, text: 'later' });
  });
});

describe('assistant: a conversation', () => {
  it('sends, streams progress, finishes and keeps the Claude session', async () => {
    const { b, bridge, thread } = await setup();
    const photo = await b.post('/api/assistant/attachments', { kind: 'image', name: 'a.png', mime: 'image/png', data: PNG });
    expect(photo.status).toBe(201);
    const file = await b.post('/api/assistant/attachments', {
      kind: 'file',
      name: 'lista.txt',
      mime: 'text/plain',
      data: Buffer.from('lapte').toString('base64'),
    });
    expect(file.status).toBe(201);

    const sent = await b.post(`/api/assistant/threads/${thread.id}/messages`, {
      text: 'Ce vezi?',
      attachmentIds: [photo.body.attachment.id, file.body.attachment.id],
    });
    expect(sent.status).toBe(201);
    // One answer at a time.
    expect((await b.post(`/api/assistant/threads/${thread.id}/messages`, { text: 'and' })).status).toBe(409);

    const job = (await bridge.get('/api/assistant/bridge/next')).body.job;
    expect(job).toMatchObject({ type: 'chat', mode: 'assistant', sessionId: null, text: 'Ce vezi?' });
    expect(job.attachments).toEqual([
      expect.objectContaining({ kind: 'image', mime: 'image/png' }),
      expect.objectContaining({ kind: 'file', name: 'lista.txt' }),
    ]);

    const base = `/api/assistant/bridge/messages/${job.id}`;
    expect((await bridge.post(`${base}/progress`, { progress: 'Citesc: 1.jpg', text: 'Văd', textMode: 'replace' })).body).toEqual({ stop: false });
    await bridge.post(`${base}/progress`, { progress: 'Rulez: node x', text: 'Văd o poză.' });
    const mid = await b.get(`/api/assistant/threads/${thread.id}/messages`);
    const reply = mid.body.messages.find((m: { role: string }) => m.role === 'assistant');
    expect(reply).toMatchObject({ status: 'running', text: 'Văd o poză.', steps: ['Citesc: 1.jpg', 'Rulez: node x'] });
    expect(mid.body.messages[0].attachments).toHaveLength(2);

    expect((await bridge.post(`${base}/done`, { text: 'Văd o poză mică.', sessionId: 'sess-9' })).status).toBe(200);
    const after = await b.get(`/api/assistant/threads/${thread.id}/messages`);
    expect(after.body.messages[1]).toMatchObject({ status: 'done', text: 'Văd o poză mică.' });
    expect(after.body.thread.title).toBe('Ce vezi?');

    await b.post(`/api/assistant/threads/${thread.id}/messages`, { text: 'și acum?' });
    expect((await bridge.get('/api/assistant/bridge/next')).body.job.sessionId).toBe('sess-9');
  });

  it('stops a reply before and while it runs', async () => {
    const { user, b, bridge, thread } = await setup();
    const queued = await sendMessage(t.deps, user.id, thread.id, { text: 'a', attachmentIds: [] });
    expect((await b.post(`/api/assistant/messages/${queued}/stop`)).status).toBe(204);
    expect(await claimNext(t.deps)).toBeNull();
    const list = await b.get(`/api/assistant/threads/${thread.id}/messages`);
    expect(list.body.messages[1].status).toBe('stopped');

    const running = await sendMessage(t.deps, user.id, thread.id, { text: 'b', attachmentIds: [] });
    const job = (await bridge.get('/api/assistant/bridge/next')).body.job;
    expect(job.id).toBe(running);
    const base = `/api/assistant/bridge/messages/${running}`;
    expect((await bridge.get(`${base}/stop`)).body).toEqual({ stop: false });
    await stopMessage(t.deps, user.id, running);
    expect((await bridge.get(`${base}/stop`)).body).toEqual({ stop: true });
    expect((await bridge.post(`${base}/progress`, { text: 'part' })).body).toEqual({ stop: true });
    expect((await bridge.post(`${base}/done`, { text: 'part', stopped: true })).status).toBe(200);
    const after = await b.get(`/api/assistant/threads/${thread.id}/messages`);
    expect(after.body.messages.at(-1)).toMatchObject({ status: 'stopped', text: 'part' });
    // Finishing twice is refused.
    expect((await bridge.post(`${base}/done`, { text: 'again' })).status).toBe(409);
  });

  it('keeps other people out of a conversation', async () => {
    const { thread } = await setup();
    const { b: other } = await admin('second@example.com');
    expect((await other.get(`/api/assistant/threads/${thread.id}/messages`)).status).toBe(404);
  });
});
