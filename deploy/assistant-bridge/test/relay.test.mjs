import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileNameFor, windowsPath } from '../relay.mjs';
import { buildSystemPrompt, loadMemory } from '../prompt.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const relay = path.join(here, '..', 'relay.mjs');

test('windowsPath turns WSL mount paths into Windows paths', () => {
  assert.equal(windowsPath('/mnt/c/Users/crist/a/inbox/m1/photo1.jpg'), 'C:\\Users\\crist\\a\\inbox\\m1\\photo1.jpg');
  assert.equal(windowsPath('/home/shades/x'), '/home/shades/x');
});

test('fileNameFor keeps image extensions and cleans names', () => {
  assert.equal(fileNameFor({ kind: 'image', mime: 'image/png' }, 1), 'photo1.png');
  assert.equal(fileNameFor({ kind: 'image', mime: 'image/weird' }, 2), 'photo2.jpg');
  assert.equal(fileNameFor({ kind: 'file', mime: 'application/pdf', name: '../my doc.pdf' }, 3), '3-my_doc.pdf');
});

test('the prompt tells it to act, and loads lms- memory (not the relay note), capped', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mem-'));
  writeFileSync(path.join(dir, 'lms-a.md'), '---\nname: a\n---\nAlpha fact');
  writeFileSync(path.join(dir, 'lms-app-main-chat-relay.md'), 'RELAYNOTE');
  writeFileSync(path.join(dir, 'save-tokens.md'), 'Save tokens');
  writeFileSync(path.join(dir, 'other.md'), 'NOPE');
  const memory = loadMemory(dir, 12 * 1024);
  assert.match(memory, /Alpha fact/);
  assert.match(memory, /Save tokens/);
  assert.doesNotMatch(memory, /RELAYNOTE|NOPE|name: a/);
  assert.ok(loadMemory(dir, 20).length <= 40);
  const prompt = buildSystemPrompt(dir);
  assert.match(prompt, /DO IT RIGHT AWAY/);
  assert.match(prompt, /use\.mjs/);
});

test('relay wait claims only main messages, downloads attachments, then reply sends the file', async () => {
  const calls = [];
  const server = createServer((req, res) => {
    calls.push(`${req.method} ${req.url}`);
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      if (body) calls.push(body);
      if (req.url.startsWith('/api/assistant/bridge/next')) {
        res.setHeader('content-type', 'application/json');
        return res.end(JSON.stringify({ job: { type: 'chat', id: 'm9', threadId: 't9', mode: 'main', sessionId: null, text: 'salut', attachments: [{ id: 'a1', mime: 'image/jpeg', kind: 'image', name: 'x' }] } }));
      }
      if (req.url.startsWith('/api/assistant/bridge/attachments/')) return res.end('JPEG');
      res.setHeader('content-type', 'application/json');
      res.end('{"ok":true}');
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const home = mkdtempSync(path.join(tmpdir(), 'relay-home-'));
  const inbox = path.join(home, 'inbox');
  const env = { ...process.env, HOME: home, LMS_URL: `http://127.0.0.1:${server.address().port}`, LMS_BRIDGE_KEY: 'k', INBOX_DIR: inbox };
  delete env.NODE_TEST_CONTEXT;
  const wait = await new Promise((resolve) => {
    import('node:child_process').then(({ execFile }) => execFile('node', [relay, 'wait'], { env, timeout: 20000 }, (err, stdout, stderr) => resolve({ err: err && Object.assign(err, { stderr }), stdout })));
  });
  assert.equal(wait.err, null, String(wait.err && wait.err.stderr));
  const line = JSON.parse(wait.stdout.trim());
  assert.equal(line.messageId, 'm9');
  assert.equal(line.text, 'salut');
  assert.equal(line.attachments.length, 1);
  assert.ok(existsSync(path.join(inbox, 'm9', 'photo1.jpg')));
  assert.ok(calls.some((c) => c.includes('/next?modes=main')));

  const file = path.join(home, 'r.md');
  writeFileSync(file, 'Gata.');
  const reply = spawnSync('node', [relay, 'reply', 'm9', file], { env, encoding: 'utf8' });
  assert.equal(reply.status, 0, reply.stderr);
  assert.ok(calls.some((c) => c.includes('/messages/m9/done')));
  assert.ok(calls.some((c) => c.includes('"text":"Gata."')));
  server.closeAllConnections();
  server.close();
  assert.equal(readFileSync(file, 'utf8'), 'Gata.');
});
