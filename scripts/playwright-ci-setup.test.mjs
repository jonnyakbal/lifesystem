import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import setup from './playwright-ci-setup.mjs';

async function fixture({ open = false, denyLogin = false } = {}, check) {
  const directory = await mkdtemp(join(tmpdir(), 'lifesystem-ci-setup-test-'));
  const server = createServer(async (request, response) => {
    if (request.url === '/api/login') {
      let body = '';
      for await (const chunk of request) body += chunk;
      assert.deepEqual(JSON.parse(body), { user: 'office-test', password: 'office-ui-test-only' });
      response.writeHead(denyLogin ? 401 : 200, { 'set-cookie': 'lifesystem_session=synthetic; Path=/; HttpOnly' });
    } else if (request.url === '/api/tasks') {
      response.writeHead(open || request.headers.cookie?.includes('lifesystem_session=synthetic') ? 200 : 401);
    } else {
      response.writeHead(404);
    }
    response.end('[]');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const config = { projects: [{ use: { baseURL: `http://127.0.0.1:${server.address().port}`, storageState: join(directory, 'session.json') } }] };
  const previous = { user: process.env.AUTH_USER, password: process.env.AUTH_PASSWORD };
  process.env.AUTH_USER = 'office-test';
  process.env.AUTH_PASSWORD = 'office-ui-test-only';
  try {
    await check(config);
  } finally {
    for (const [key, value] of Object.entries({ AUTH_USER: previous.user, AUTH_PASSWORD: previous.password })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
}

test('production setup rejects a server that exposes protected data without login', async () => {
  await fixture({ open: true }, config => assert.rejects(setup(config), /401/));
});

test('production setup logs in and saves a session accepted by protected API routes', async () => {
  await fixture({}, async config => {
    await setup(config);
    const state = JSON.parse(await readFile(config.projects[0].use.storageState, 'utf8'));
    assert.equal(state.cookies[0].name, 'lifesystem_session');
    assert.equal(state.cookies[0].value, 'synthetic');
  });
});

test('production setup reports failed login without copying response bodies or credentials', async () => {
  await fixture({ denyLogin: true }, config => assert.rejects(setup(config), /login.*401/i));
});
