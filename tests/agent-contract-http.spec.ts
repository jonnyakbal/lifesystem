import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// HTTP pilot (E4): the real production server, proxy, bearer auth, scopes,
// catalog, web approval and receipts, over the transport Hermes uses. Only
// synthetic identities and a private temporary data directory are involved.
const PORT = 3117;
const BASE = `http://localhost:${PORT}`;
const owner = { user: 'synthetic-http-owner', password: 'synthetic-http-password-not-real' };
const identities = [
  { id: 'synthetic-orion', key: 'synthetic-orion-http-credential-000001', scopes: ['health:only', 'health:read', 'health:propose', 'health:apply'] },
  { id: 'synthetic-other-orion', key: 'synthetic-orion-http-credential-000002', scopes: ['health:only', 'health:read', 'health:propose', 'health:apply'] },
  { id: 'synthetic-sirius', key: 'synthetic-sirius-http-credential-00001', scopes: ['professional:only', 'professional:read', 'professional:propose', 'professional:apply', 'professional:artifact', 'professional:execution'] },
  { id: 'synthetic-other-sirius', key: 'synthetic-sirius-http-credential-00002', scopes: ['professional:only', 'professional:read', 'professional:propose', 'professional:apply', 'professional:artifact', 'professional:execution'] },
];

let server: ChildProcess;
let dir: string;
let output = '';
const clients: Client[] = [];

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(120_000);
  dir = await mkdtemp(join(tmpdir(), 'lifesystem-http-pilot-'));
  server = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), 'start', '-p', String(PORT)], {
    cwd: resolve('.'),
    env: {
      ...process.env,
      LIFESYSTEM_DATA_DIR: join(dir, 'data'), LIFESYSTEM_UPLOAD_DIR: join(dir, 'uploads'), LIFESYSTEM_BACKUP_DIR: join(dir, 'backups'),
      LIFESYSTEM_STORAGE: 'file', AUTH_USER: owner.user, AUTH_PASSWORD: owner.password,
      MCP_API_KEY: '', MCP_API_KEYS: JSON.stringify(identities),
      GOOGLE_CALENDAR_CLIENT_ID: '', GOOGLE_CALENDAR_CLIENT_SECRET: '', GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY: '',
      AI_API_KEY: '', AI_CLOUDFLARE_API_KEY: '', CLOUDFLARE_D1_API_TOKEN: '', TZ: 'America/Sao_Paulo',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout!.on('data', (d) => { output += String(d); });
  server.stderr!.on('data', (d) => { output += String(d); });
  const deadline = Date.now() + 90_000;
  for (;;) {
    try { if ((await fetch(`${BASE}/login`)).ok) break; } catch { /* not up yet */ }
    if (Date.now() > deadline || server.exitCode !== null) throw new Error(`HTTP pilot server did not start: ${output.slice(-2000)}`);
    await new Promise((r) => setTimeout(r, 300));
  }
});

test.afterAll(async () => {
  await Promise.all(clients.map((c) => c.close().catch(() => undefined)));
  if (server && server.exitCode === null) {
    const exited = new Promise((r) => server.once('exit', r));
    server.kill();
    await exited;
  }
  await rm(dir, { recursive: true, force: true });
});

async function connect(id: string) {
  const identity = identities.find((i) => i.id === id)!;
  const client = new Client({ name: id, version: 'synthetic-http-pilot-1.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${BASE}/api/mcp`), { requestInit: { headers: { Authorization: `Bearer ${identity.key}` } } }));
  clients.push(client);
  return client;
}
async function call<T>(client: Client, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const result = await client.callTool({ name, arguments: args });
  expect(result.isError, `${name}: ${JSON.stringify(result.content)}`).toBeFalsy();
  return JSON.parse((result.content as { type: string; text?: string }[]).find((c) => c.type === 'text')!.text!) as T;
}
async function refused(client: Client, name: string, args: Record<string, unknown>, message: RegExp) {
  const result = await client.callTool({ name, arguments: args });
  expect(result.isError).toBe(true);
  expect(JSON.stringify(result.content)).toMatch(message);
}
async function ownerCookie() {
  const response = await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: JSON.stringify(owner) });
  expect(response.status).toBe(200);
  const cookie = response.headers.get('set-cookie')!.split(';')[0];
  expect(cookie).toMatch(/=.+/);
  return cookie;
}
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${BASE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('the MCP endpoint refuses missing, malformed and unknown credentials over HTTP', async () => {
  const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'x', version: '1' } } };
  const accept = { accept: 'application/json, text/event-stream' };
  expect((await post('/api/mcp', init, accept)).status).toBe(401);
  expect((await post('/api/mcp', init, { ...accept, authorization: `Bearer ${identities[0].key} extra` })).status).toBe(401);
  expect((await post('/api/mcp', init, { ...accept, authorization: 'Bearer synthetic-unknown-token-000000000000' })).status).toBe(401);
});

test('Órion over HTTP: dedicated catalog, web approval with session and origin, apply, replay and isolated receipt', async () => {
  const orion = await connect('synthetic-orion');
  const otherOrion = await connect('synthetic-other-orion');
  const names = (await orion.listTools()).tools.map((t) => t.name);
  expect(names).toEqual(expect.arrayContaining(['get_health_capabilities', 'get_health_schemas', 'propose_health_change', 'apply_health_change', 'get_health_receipt']));
  for (const absent of ['query_professional', 'list_tasks', 'create_financial_entry', 'approve_health_proposal']) expect(names).not.toContain(absent);
  expect(await call(orion, 'get_health_capabilities')).toMatchObject({ contractVersion: '1.2', humanApprovalTool: false });

  const intent = { operation: 'record', observation: { type: 'water', ml: 300, observedAt: '2020-01-01T10:00:00-03:00', timezone: 'America/Sao_Paulo', sourceRef: 'synthetic-http-water' }, idempotencyKey: 'synthetic-http-water-propose' };
  const proposal = await call<{ id: string; revision: number; hash: string; actor: string }>(orion, 'propose_health_change', intent);
  expect(proposal.actor).toBe('synthetic-orion');
  const apply = { proposalId: proposal.id, idempotencyKey: 'synthetic-http-water-apply' };
  await refused(orion, 'apply_health_change', apply, /sem aprovação humana/);

  const approval = { proposalId: proposal.id, revision: proposal.revision, hash: proposal.hash };
  expect((await post('/api/health/approval', approval, { origin: BASE })).status).toBeGreaterThanOrEqual(400);
  const cookie = await ownerCookie();
  // A forged origin is stopped by the proxy even with a valid session.
  expect((await post('/api/health/approval', approval, { origin: 'https://evil.invalid', cookie })).status).toBe(403);
  // A bearer credential is not a human approval.
  expect((await post('/api/health/approval', approval, { origin: BASE, authorization: `Bearer ${identities[0].key}` })).status).toBeGreaterThanOrEqual(400);
  expect((await post('/api/health/approval', { ...approval, hash: '0'.repeat(64) }, { origin: BASE, cookie })).status).toBe(403);
  expect((await post('/api/health/approval', approval, { origin: BASE, cookie })).status).toBe(200);

  await refused(otherOrion, 'apply_health_change', apply, /outro ator/);
  const saved = await call<{ id: string; actor: string }>(orion, 'apply_health_change', apply);
  expect(saved.actor).toBe('synthetic-orion');
  expect(await call(orion, 'apply_health_change', apply)).toEqual(saved);
  expect(await call(orion, 'get_health_receipt', { idempotencyKey: apply.idempotencyKey })).toMatchObject({ found: true, receipt: { actor: 'synthetic-orion', resultId: saved.id } });
  expect(await call(otherOrion, 'get_health_receipt', { idempotencyKey: apply.idempotencyKey })).toEqual({ found: false, receipt: null });
});

test('Sirius over HTTP: scoped catalog, explicit project, exact web approval, queued job without execution', async () => {
  const sirius = await connect('synthetic-sirius');
  const otherSirius = await connect('synthetic-other-sirius');
  const names = (await sirius.listTools()).tools.map((t) => t.name);
  expect(names).toEqual(expect.arrayContaining(['query_professional', 'get_professional_schemas', 'propose_professional_change', 'apply_professional_proposal', 'get_professional_receipt']));
  for (const absent of ['approve_professional_proposal', 'get_health_context', 'list_tasks']) expect(names).not.toContain(absent);
  expect(await call(sirius, 'get_professional_diagnostics')).toMatchObject({ clientId: 'synthetic-sirius', adapter: 'contract-only', humanApprovalTool: false });

  const cookie = await ownerCookie();
  const project = await (await post('/api/projects', { name: 'Synthetic HTTP freelance', status: 'active' }, { origin: BASE, cookie })).json();
  const binding = { projectId: project.id, brandId: 'freelance' };
  expect((await post('/api/professional', { action: 'save', kind: 'context', expectedRevision: 0, idempotencyKey: 'synthetic-http-context', data: { ...binding, objective: 'Synthetic HTTP scope' } }, { origin: BASE, cookie })).status).toBe(200);
  const overview = await call<{ projects: { items: { id: string }[] } }>(sirius, 'query_professional', { view: 'overview' });
  expect(overview.projects.items.map((p) => p.id)).toEqual([project.id]);

  const intent = { kind: 'work', approvalType: 'work_scope', idempotencyKey: 'synthetic-http-scope', data: { ...binding, title: 'Synthetic HTTP research brief', workType: 'agent', responsible: 'synthetic-sirius', brief: 'Synthetic only.', expectedResult: 'Outline for review', acceptanceCriteria: ['Synthetic outline exists'], artifactKinds: ['research'] } };
  const proposal = await call<{ id: string; revision: number; hash: string; author: string }>(sirius, 'propose_professional_change', intent);
  expect(proposal.author).toBe('synthetic-sirius');
  const apply = { id: proposal.id, idempotencyKey: 'synthetic-http-scope-apply' };
  await refused(sirius, 'apply_professional_proposal', apply, /aprovação humana/);
  const approval = { proposalId: proposal.id, revision: proposal.revision, hash: proposal.hash };
  expect((await post('/api/professional/approval', approval, { origin: 'https://evil.invalid', cookie })).status).toBe(403);
  expect((await post('/api/professional/approval', approval, { origin: BASE, cookie })).status).toBe(200);
  await refused(otherSirius, 'apply_professional_proposal', apply, /outro|ator|autor/i);
  const work = await call<{ id: string; author: string; data: { linkedTaskId?: string } }>(sirius, 'apply_professional_proposal', apply);
  expect(work.author).toBe('synthetic-sirius');
  expect(await call(sirius, 'apply_professional_proposal', apply)).toEqual(work);
  expect(await call(sirius, 'get_professional_receipt', { idempotencyKey: apply.idempotencyKey })).toMatchObject({ found: true, actor: 'synthetic-sirius', result: { id: work.id } });
  expect(await call(otherSirius, 'get_professional_receipt', { idempotencyKey: apply.idempotencyKey })).toEqual({ found: false, retrySameKey: true });
  // The approved scope queues a job; nothing is executed by the contract-only adapter.
  const jobs = await call<{ items: { workId: string; agentId: string; execution: string }[] }>(sirius, 'query_professional', { view: 'jobs' });
  expect(jobs.items).toEqual([expect.objectContaining({ workId: work.id, agentId: 'synthetic-sirius', execution: 'queued' })]);
});
