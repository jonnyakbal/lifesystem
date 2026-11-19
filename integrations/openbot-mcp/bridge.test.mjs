import { once } from 'node:events';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { createBridge } from './bridge.mjs';

const token = randomBytes(32).toString('base64url');

async function withBridge(fetchUpstream, run) {
  const server = createBridge({ token, fetchUpstream });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await run('http://127.0.0.1:' + server.address().port);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test('forward only MCP headers, with the bridge secret and fixed destination', async () => {
  let called = false;
  await withBridge(async (url, options) => {
    called = true;
    assert.equal(url, 'https://lifesystem.oj0nny.com/api/mcp');
    assert.equal(options.headers.get('authorization') === 'Bearer ' + token, true);
    assert.equal(options.headers.has('cookie'), false);
    assert.equal(options.headers.get('mcp-protocol-version'), '2025-06-18');
    assert.equal(options.redirect, 'manual');
    assert.equal(JSON.parse(options.body.toString()).method, 'tools/list');
    return Response.json({ result: { tools: [] } }, { headers: { 'set-cookie': 'synthetic=example' } });
  }, async origin => {
    const result = await fetch(origin + '/mcp', {
      method: 'POST',
      headers: { authorization: 'Bearer caller-ignored', cookie: 'ignored=1', 'mcp-protocol-version': '2025-06-18' },
      body: JSON.stringify({ method: 'tools/list' }),
    });
    assert.equal(result.status, 200);
    assert.equal(result.headers.has('set-cookie'), false);
    assert.deepEqual(await result.json(), { result: { tools: [] } });
  });
  assert.equal(called, true);
});

test('do not dispatch any request on other routes, methods or oversized bodies', async () => {
  let requests = 0;
  await withBridge(async () => { requests++; return Response.json({}); }, async origin => {
    assert.equal((await fetch(origin + '/mcp?other=1')).status, 404);
    assert.equal((await fetch(origin + '/mcp', { headers: { origin: 'https://example.invalid' } })).status, 403);
    assert.equal((await fetch(origin + '/mcp', { method: 'PUT' })).status, 405);
    assert.equal((await fetch(origin + '/mcp', { method: 'POST', body: 'x'.repeat(2 * 1024 * 1024 + 1) })).status, 413);
  });
  assert.equal(requests, 0);
});

test('refuse redirects and do not relay transport errors', async () => {
  await withBridge(async () => Response.redirect('https://example.invalid'), async origin => {
    const reply = await fetch(origin + '/mcp');
    assert.equal(reply.status, 502);
    assert.equal(reply.headers.has('location'), false);
  });
  await withBridge(async () => { throw new Error('synthetic internal detail'); }, async origin => {
    const reply = await fetch(origin + '/mcp');
    assert.equal(reply.status, 502);
    assert.equal((await reply.text()).includes('synthetic internal detail'), false);
  });
});
