// Manual smoke test: a fake LMS server plus a stub claude. Run: node test/bridge.fake.mjs
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = mkdtempSync(path.join(tmpdir(), 'bridge-fake-'));
const stub = path.join(tmp, 'claude');
writeFileSync(stub, `#!/usr/bin/env bash
cat >/dev/null
echo '{"type":"system","subtype":"init","session_id":"S1"}'
echo '{"type":"stream_event","session_id":"S1","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"Salut"}}}'
echo '{"type":"assistant","session_id":"S1","message":{"content":[{"type":"text","text":"Salut"},{"type":"tool_use","name":"Read","input":{"file_path":"/x"}}]}}'
sleep 1
echo '{"type":"result","subtype":"success","is_error":false,"result":"Salut final","session_id":"S1"}'
`);
chmodSync(stub, 0o755);

const calls = [];
let served = false;
const server = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const route = req.url.replace('/api/assistant/bridge', '');
    calls.push(`${req.method} ${route} ${body}`);
    res.setHeader('content-type', 'application/json');
    if (route.startsWith('/next')) {
      if (served) return setTimeout(() => res.end('{"job":null}'), 500);
      served = true;
      return res.end(JSON.stringify({ job: { type: 'chat', id: 'm1', threadId: 't', mode: 'assistant', sessionId: null, text: 'hi', attachments: [{ id: 'a1', mime: 'application/pdf', kind: 'file', name: 'my doc.pdf' }] } }));
    }
    if (route.startsWith('/attachments/')) return res.end('%PDF-fake');
    if (route.endsWith('/progress')) return res.end('{"stop":false}');
    if (route.endsWith('/stop')) return res.end('{"stop":false}');
    res.end('{"ok":true}');
  });
});
server.listen(0, '127.0.0.1', () => {
  const child = spawn('node', [path.join(here, '..', 'bridge.mjs')], {
    env: { ...process.env, HOME: tmp, LMS_URL: `http://127.0.0.1:${server.address().port}`, LMS_BRIDGE_KEY: 'lms_testbridgekey', LMS_MCP_KEY: 'lms_testmcpkey', CLAUDE_BIN: stub, REPO_DIR: tmp },
    stdio: 'inherit',
  });
  setTimeout(() => {
    child.kill();
    server.close();
    console.log(calls.map((c) => c.slice(0, 160)).join('\n'));
    const ok = calls.some((c) => c.includes('/messages/m1/done') && c.includes('Salut final') && c.includes('S1'));
    console.log(ok ? 'FAKE SMOKE OK' : 'FAKE SMOKE FAILED');
    process.exit(ok ? 0 : 1);
  }, 4000);
});
