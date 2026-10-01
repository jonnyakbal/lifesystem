import { test as base, expect } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { NextRequest } from 'next/server';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { authorizeMcpToken } from '../src/lib/mcp/auth';
import { createLifesystemMcpServer } from '../src/lib/mcp/server';
import { POST as login } from '../src/app/api/login/route';
import { POST as approveHealth } from '../src/app/api/health/approval/route';
import { POST as approveProfessional } from '../src/app/api/professional/approval/route';
import { POST as professionalUi } from '../src/app/api/professional/route';
import { SESSION_COOKIE } from '../src/lib/auth';
import { storage } from '../src/lib/storage';
import { readHealthLedger } from '../src/lib/health/store';
import { readLedger } from '../src/lib/professional/store';
import type { HealthObservation, HealthProposal } from '../src/lib/health/schemas';
import type { ProfessionalRecord, Proposal } from '../src/lib/professional/schemas';
import type { McpCallLog } from '../src/lib/mcp/log';

const origin = 'https://agent-pilot.invalid';
const owner = { user: 'synthetic-pilot-owner', password: 'synthetic-pilot-password-not-a-real-secret' };
const identities = [
  { id: 'synthetic-orion', key: 'synthetic-orion-credential-only-000001', scopes: ['health:only', 'health:read', 'health:propose', 'health:apply'] },
  { id: 'synthetic-other-orion', key: 'synthetic-orion-credential-only-000002', scopes: ['health:only', 'health:read', 'health:propose', 'health:apply'] },
  { id: 'synthetic-sirius', key: 'synthetic-sirius-credential-only-00001', scopes: ['professional:only', 'professional:read', 'professional:propose', 'professional:apply', 'professional:artifact', 'professional:execution'] },
  { id: 'synthetic-other-sirius', key: 'synthetic-sirius-credential-only-00002', scopes: ['professional:only', 'professional:read', 'professional:propose', 'professional:apply', 'professional:artifact', 'professional:execution'] },
];

type Peer = { client: Client; server: ReturnType<typeof createLifesystemMcpServer> };
type Sandbox = { connect: (id: string) => Promise<Peer>; networkAttempts: string[] };

// Every test owns its storage and auth. Even an accidental fetch is forbidden;
// route handlers are invoked directly and MCP uses only linked SDK transports.
const test = base.extend<{ sandbox: Sandbox }>({
  sandbox: async ({}, runFixture) => {
    const names = ['LIFESYSTEM_DATA_DIR', 'AUTH_USER', 'AUTH_PASSWORD', 'MCP_API_KEY', 'MCP_API_KEYS'] as const;
    const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
    const originalFetch = globalThis.fetch;
    const dir = await mkdtemp(join(tmpdir(), 'lifesystem-agent-pilot-'));
    const peers: Peer[] = [];
    const networkAttempts: string[] = [];
    process.env.LIFESYSTEM_DATA_DIR = dir;
    process.env.AUTH_USER = owner.user;
    process.env.AUTH_PASSWORD = owner.password;
    delete process.env.MCP_API_KEY;
    delete process.env.MCP_API_KEYS;
    globalThis.fetch = async () => {
      networkAttempts.push('forbidden-fetch');
      throw new Error('Agent pilot forbids all network fetches.');
    };
    try {
      expect(resolve(process.env.LIFESYSTEM_DATA_DIR!)).toBe(resolve(dir));
      await runFixture({
        networkAttempts,
        connect: async id => {
          const fixture = identities.find(identity => identity.id === id);
          if (!fixture) throw new Error('Unknown synthetic pilot identity.');
          // The explicit environment prevents reading a real MCP credential.
          const auth = authorizeMcpToken(fixture.key, { MCP_API_KEYS: JSON.stringify(identities) });
          expect(auth).toEqual({ keyId: fixture.id, scopes: fixture.scopes });
          expect(authorizeMcpToken('unknown-synthetic-token', { MCP_API_KEYS: JSON.stringify(identities) })).toBeNull();
          if (!auth) throw new Error('Synthetic authorization failed.');
          const server = createLifesystemMcpServer(auth.scopes, auth.keyId);
          const client = new Client({ name: fixture.id, version: 'synthetic-pilot-1.0' });
          peers.push({ client, server });
          const [ct, st] = InMemoryTransport.createLinkedPair();
          await server.connect(st);
          await client.connect(ct);
          return { client, server };
        },
      });
    } finally {
      try {
        await Promise.all(peers.map(async peer => {
          try { await peer.client.close(); } finally { await peer.server.close(); }
        }));
      } finally {
        globalThis.fetch = originalFetch;
        for (const name of names) {
          if (previous[name] === undefined) delete process.env[name];
          else process.env[name] = previous[name];
        }
        // Delete only the directory returned by mkdtemp, never restored storage.
        expect(dirname(resolve(dir))).toBe(resolve(tmpdir()));
        expect(basename(dir)).toMatch(/^lifesystem-agent-pilot-/);
        await rm(dir, { recursive: true, force: true });
        await expect(stat(dir)).rejects.toMatchObject({ code: 'ENOENT' });
        for (const name of names) expect(process.env[name]).toBe(previous[name]);
        expect(globalThis.fetch).toBe(originalFetch);
        expect(networkAttempts).toEqual([]);
      }
    }
  },
});

function request(route: string, body: unknown, cookie?: string) {
  return new NextRequest(`${origin}${route}`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

async function loginCookie() {
  const result = await login(request('/api/login', owner));
  expect(result.status).toBe(200);
  const token = result.cookies.get(SESSION_COOKIE)?.value;
  expect(token).toBeTruthy();
  return `${SESSION_COOKIE}=${token}`;
}

async function call<T>(client: Client, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const result = await client.callTool({ name, arguments: args });
  expect(result.isError, `${name}: ${JSON.stringify(result.content)}`).toBeFalsy();
  const content = result.content as { type: string; text?: string }[];
  const text = content.find(item => item.type === 'text')?.text;
  expect(text).toBeTruthy();
  return JSON.parse(text!) as T;
}

async function refused(client: Client, name: string, args: Record<string, unknown>, message: RegExp) {
  const result = await client.callTool({ name, arguments: args });
  expect(result.isError).toBe(true);
  expect(JSON.stringify(result.content)).toMatch(message);
}

test('Órion: synthetic credential, catalog, REST approval, water apply/replay and receipt isolation', async ({ sandbox }) => {
  const { client } = await sandbox.connect('synthetic-orion');
  const { client: other } = await sandbox.connect('synthetic-other-orion');
  const names = (await client.listTools()).tools.map(tool => tool.name);
  expect(names).toEqual(expect.arrayContaining(['get_health_schemas', 'get_health_capabilities', 'propose_health_change', 'apply_health_change', 'get_health_receipt']));
  expect(names).not.toEqual(expect.arrayContaining(['query_professional']));
  for (const absent of ['list_tasks', 'create_financial_entry', 'approve_health_proposal', 'create_calendar_event']) expect(names).not.toContain(absent);
  const capabilities = await call<{ contractVersion: string; humanApprovalTool: boolean }>(client, 'get_health_capabilities');
  expect(capabilities).toMatchObject({ contractVersion: '1.2', humanApprovalTool: false });
  const schema = await call<{ contractVersion: string; units: { water: string }; approvals: string }>(client, 'get_health_schemas');
  expect(schema).toMatchObject({ contractVersion: '1.2', units: { water: 'ml' }, approvals: 'Authenticated LifeSystem UI only' });

  const intent = { operation: 'record', observation: { type: 'water', ml: 350, observedAt: '2020-01-01T11:00:00-03:00', timezone: 'America/Sao_Paulo', sourceRef: 'synthetic-pilot-water' }, idempotencyKey: 'synthetic-water-propose-01' };
  const proposal = await call<HealthProposal>(client, 'propose_health_change', intent);
  expect(proposal.actor).toBe('synthetic-orion');
  expect((await call<HealthProposal>(client, 'propose_health_change', intent)).id).toBe(proposal.id);
  const apply = { proposalId: proposal.id, idempotencyKey: 'synthetic-water-apply-01' };
  await refused(client, 'apply_health_change', apply, /sem aprovação humana/);
  expect((await readHealthLedger()).observations).toEqual([]);
  const approval = { proposalId: proposal.id, revision: proposal.revision, hash: proposal.hash };
  expect((await approveHealth(request('/api/health/approval', approval))).status).toBe(403);
  expect((await approveHealth(request('/api/health/approval', approval, 'lifesystem_session=synthetic-invalid'))).status).toBe(403);
  const cookie = await loginCookie();
  expect((await approveHealth(request('/api/health/approval', { ...approval, hash: '0'.repeat(64) }, cookie))).status).toBe(403);
  expect((await approveHealth(request('/api/health/approval', approval, cookie))).status).toBe(200);
  await refused(other, 'apply_health_change', apply, /outro ator/);

  const saved = await call<HealthObservation>(client, 'apply_health_change', apply);
  const replay = await call<HealthObservation>(client, 'apply_health_change', apply);
  expect(replay).toEqual(saved);
  expect(saved).toMatchObject({ actor: 'synthetic-orion', origin: 'self_report', data: intent.observation });
  const receipt = await call<{ found: boolean; receipt: { actor: string; resultId: string; operation: string } }>(client, 'get_health_receipt', { idempotencyKey: apply.idempotencyKey });
  expect(receipt).toMatchObject({ found: true, receipt: { actor: 'synthetic-orion', resultId: saved.id, operation: 'apply' } });
  expect(await call(other, 'get_health_receipt', { idempotencyKey: apply.idempotencyKey })).toEqual({ found: false, receipt: null });
  const ledger = await readHealthLedger();
  expect(ledger.observations).toHaveLength(1);
  expect(ledger.proposals[0]).toMatchObject({ approvedBy: owner.user, resultId: saved.id });
  expect(ledger.receipts.filter(item => item.operation === 'apply')).toHaveLength(1);
  expect(await storage.getAll('tasks')).toEqual([]);
  expect(await storage.getAll('financial')).toEqual([]);
  expect((await readLedger()).records).toEqual([]);
  const logs = await storage.getAll<McpCallLog>('mcp-logs');
  expect(logs).toEqual(expect.arrayContaining([expect.objectContaining({ tool: 'apply_health_change', clientId: 'synthetic-orion', success: true }), expect.objectContaining({ tool: 'apply_health_change', clientId: 'synthetic-other-orion', success: false })]));
});

test('Sirius: freelance work scope via MCP, authenticated REST approval and isolated replay/receipt', async ({ sandbox }) => {
  const { client } = await sandbox.connect('synthetic-sirius');
  const { client: other } = await sandbox.connect('synthetic-other-sirius');
  const names = (await client.listTools()).tools.map(tool => tool.name);
  expect(names).toEqual(expect.arrayContaining(['query_professional', 'get_professional_schemas', 'get_professional_diagnostics', 'propose_professional_change', 'apply_professional_proposal', 'get_professional_receipt']));
  for (const absent of ['approve_professional_proposal', 'list_tasks', 'create_financial_entry', 'get_health_context', 'update_project']) expect(names).not.toContain(absent);
  expect(await call(client, 'get_professional_diagnostics')).toMatchObject({ clientId: 'synthetic-sirius', adapter: 'contract-only', scopedProfessionalOnly: true, humanApprovalTool: false });
  expect(await call(client, 'get_professional_schemas')).toMatchObject({ contractVersion: '1.0', schemas: { work: expect.any(Object) } });
  const cookie = await loginCookie();
  const project = await storage.create('projects', { name: 'Synthetic freelance pilot', description: 'Fixture only', status: 'active', tags: [], links: [], needs: '', tasksCount: 0, tasksDone: 0 });
  const excluded = await storage.create('projects', { name: 'Synthetic company excluded', workspaceDomain: 'company', status: 'active' });
  const binding = { projectId: project.id, brandId: 'freelance' };
  const context = await professionalUi(request('/api/professional', { action: 'save', kind: 'context', expectedRevision: 0, idempotencyKey: 'synthetic-context-01', data: { ...binding, objective: 'Evaluate synthetic freelance scope', unknowns: ['No external research performed'] } }, cookie));
  expect(context.status).toBe(200);
  const overview = await call<{ projects: { items: { id: string }[] } }>(client, 'query_professional', { view: 'overview' });
  expect(overview.projects.items.map(item => item.id)).toEqual([project.id]);
  await refused(client, 'query_professional', { view: 'project', projectId: excluded.id }, /fora do espaço/);

  const intent = { kind: 'work', approvalType: 'work_scope', idempotencyKey: 'synthetic-scope-propose-01', data: { ...binding, title: 'Synthetic freelance research brief', workType: 'agent', responsible: 'synthetic-sirius', brief: 'Create a synthetic research artifact for human review.', expectedResult: 'Fixture research outline', acceptanceCriteria: ['Explicitly label all content as synthetic'], artifactKinds: ['research'] } };
  const proposal = await call<Proposal>(client, 'propose_professional_change', intent);
  expect(proposal.author).toBe('synthetic-sirius');
  expect((await call<Proposal>(client, 'propose_professional_change', intent)).id).toBe(proposal.id);
  const apply = { id: proposal.id, idempotencyKey: 'synthetic-scope-apply-01' };
  await refused(client, 'apply_professional_proposal', apply, /aprovação humana/);
  expect((await readLedger()).jobs).toEqual([]);
  expect((await readLedger()).records.filter(item => item.kind === 'work')).toEqual([]);
  expect(await storage.getAll('tasks')).toEqual([]);
  const approval = { proposalId: proposal.id, revision: proposal.revision, hash: proposal.hash };
  expect((await approveProfessional(request('/api/professional/approval', approval))).status).toBe(403);
  expect((await approveProfessional(request('/api/professional/approval', { ...approval, revision: 2 }, cookie))).status).toBe(403);
  expect((await approveProfessional(request('/api/professional/approval', approval, cookie))).status).toBe(200);
  await refused(other, 'apply_professional_proposal', apply, /outro agente/);

  const work = await call<ProfessionalRecord>(client, 'apply_professional_proposal', apply);
  expect(await call(client, 'apply_professional_proposal', apply)).toEqual(work);
  const receipt = await call<{ found: boolean; actor: string; result: ProfessionalRecord }>(client, 'get_professional_receipt', { idempotencyKey: apply.idempotencyKey });
  expect(receipt).toMatchObject({ found: true, actor: 'synthetic-sirius', result: { id: work.id } });
  expect(await call(other, 'get_professional_receipt', { idempotencyKey: apply.idempotencyKey })).toEqual({ found: false, retrySameKey: true });
  const ledger = await readLedger();
  expect(ledger.records.filter(item => item.kind === 'work')).toHaveLength(1);
  expect(ledger.receipts.filter(item => item.key === apply.idempotencyKey)).toHaveLength(1);
  expect(ledger.jobs).toHaveLength(1);
  expect(ledger.jobs[0]).toMatchObject({ workId: work.id, agentId: 'synthetic-sirius', brandId: 'freelance', execution: 'queued', sequence: 0 });
  expect(ledger.approvals[0].author).toBe(owner.user);
  expect(await storage.getAll('tasks')).toHaveLength(1);
  expect(await storage.getAll('financial')).toEqual([]);
  expect((await readHealthLedger()).observations).toEqual([]);
  expect(sandbox.networkAttempts).toEqual([]);
});
