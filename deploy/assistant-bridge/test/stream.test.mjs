import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEvent, createState, describeTool, finalText, parseLine, redact } from '../stream.mjs';

const SAMPLE = [
  '{"type":"system","subtype":"init","session_id":"sess-123","cwd":"/home/shades/shades/lms","tools":["Read","Bash","mcp__lms__list_stock"],"model":"claude-sonnet"}',
  '{"type":"stream_event","session_id":"sess-123","event":{"type":"message_start","message":{"role":"assistant","content":[]}}}',
  '{"type":"stream_event","session_id":"sess-123","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Verific "}}}',
  '{"type":"stream_event","session_id":"sess-123","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"stocul."}}}',
  '{"type":"assistant","session_id":"sess-123","message":{"role":"assistant","content":[{"type":"text","text":"Verific stocul."},{"type":"tool_use","id":"t1","name":"mcp__lms__list_stock","input":{}},{"type":"tool_use","id":"t2","name":"Bash","input":{"command":"node /tmp/recipes/closet.mjs list --all --verbose --format=json --with-a-very-long-flag-to-force-truncation-of-the-line"}}]}}',
  'not json at all',
  '{"type":"user","session_id":"sess-123","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":"ok"}]}}',
  '{"type":"stream_event","session_id":"sess-123","event":{"type":"message_start","message":{"role":"assistant","content":[]}}}',
  '{"type":"stream_event","session_id":"sess-123","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Ai 3 oua."}}}',
  '{"type":"assistant","session_id":"sess-123","message":{"role":"assistant","content":[{"type":"text","text":"Ai 3 oua."}]}}',
  '{"type":"mystery","x":1}',
  '{"type":"result","subtype":"success","is_error":false,"result":"Ai 3 oua.","session_id":"sess-123"}',
];

function run(lines) {
  const state = createState();
  const progress = [];
  const texts = [];
  for (const line of lines) {
    const out = applyEvent(state, parseLine(line));
    progress.push(...out.progress);
    if (out.textChanged) texts.push(state.turnText);
  }
  return { state, progress, texts };
}

test('session id, cumulative text and final result', () => {
  const { state, texts } = run(SAMPLE);
  assert.equal(state.sessionId, 'sess-123');
  assert.ok(texts.includes('Verific stocul.'));
  assert.equal(state.turnText, 'Ai 3 oua.');
  assert.equal(state.done, true);
  assert.equal(state.isError, false);
  assert.equal(finalText(state), 'Ai 3 oua.');
});

test('tool_use blocks become short progress lines', () => {
  const { progress } = run(SAMPLE);
  assert.equal(progress.length, 2);
  assert.equal(progress[0], 'Unealta: list_stock');
  assert.ok(progress[1].startsWith('Rulez: node /tmp/recipes/closet.mjs list'));
  assert.ok(progress[1].length <= 80);
  assert.ok(progress[1].endsWith('…'));
});

test('describeTool covers the tool kinds', () => {
  assert.equal(describeTool('Read', { file_path: '/a/b.txt' }), 'Citesc: /a/b.txt');
  assert.equal(describeTool('Grep', { pattern: 'milk' }), 'Caut: milk');
  assert.equal(describeTool('Glob', { pattern: '*.mjs' }), 'Caut: *.mjs');
  assert.equal(describeTool('Write', { file_path: 'x.md' }), 'Editez: x.md');
  assert.equal(describeTool('WebSearch', { query: 'reteta' }), 'Web: reteta');
  assert.equal(describeTool('WebFetch', { url: 'https://a.b' }), 'Web: https://a.b');
});

test('error result is flagged', () => {
  const { state } = run(['{"type":"result","subtype":"error_during_execution","is_error":true,"result":"boom","session_id":"s9"}']);
  assert.equal(state.isError, true);
  assert.equal(finalText(state), 'boom');
  assert.equal(state.sessionId, 's9');
});

test('invalid and unknown lines are ignored', () => {
  for (const line of ['', '   ', '{bad', '[1,2]', 'null', '{"type":"x"}']) {
    const state = createState();
    assert.doesNotThrow(() => applyEvent(state, parseLine(line)));
    assert.equal(state.done, false);
  }
});

test('falls back to the last turn text without a result', () => {
  const { state } = run(SAMPLE.slice(0, 10));
  assert.equal(finalText(state), 'Ai 3 oua.');
});

test('redact hides keys and tokens', () => {
  const out = redact('Bearer lms_abcdef123456 and sk-ant-oat01-xyz and mysecretvalue', ['mysecretvalue']);
  assert.ok(!out.includes('abcdef123456'));
  assert.ok(!out.includes('oat01'));
  assert.ok(!out.includes('mysecretvalue'));
});
