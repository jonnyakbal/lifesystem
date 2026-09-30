import { test, expect } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createLifesystemMcpServer } from '../src/lib/mcp/server';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { storage } from '../src/lib/storage';
import type { Pillar, Task } from '../src/types';
import { approveHealthProposal, saveHealthContext } from '../src/lib/health/service';

async function connect(scopes: string[], clientId: string) {
  const server = createLifesystemMcpServer(scopes, clientId);
  const client = new Client({ name: 'orion-test', version: '1.0' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  return { client, server };
}

test('health-only MCP discovers schema without crossing domains or approving itself', async () => {
  const { client, server } = await connect(['health:only', 'health:read', 'health:propose', 'health:apply'], 'orion-test');
  try {
    const names = (await client.listTools()).tools.map(item => item.name);
    for (const name of ['get_health_capabilities', 'get_health_schemas', 'get_health_context', 'get_health_daily_brief', 'list_health_observations', 'get_health_summary', 'get_health_receipt', 'propose_health_change', 'apply_health_change', 'record_health_observation', 'correct_health_observation']) expect(names).toContain(name);
    for (const name of ['create_financial_entry', 'list_tasks', 'query_professional', 'approve_health_proposal']) expect(names).not.toContain(name);
    const capabilities = await client.callTool({ name: 'get_health_capabilities', arguments: {} });
    expect(capabilities.isError).toBeFalsy();
    expect(JSON.stringify(capabilities.content)).toContain('health:read');
    expect(JSON.stringify(capabilities.content)).toContain('approved-proposals');
    const schema = await client.callTool({ name: 'get_health_schemas', arguments: {} });
    expect(schema.isError).toBeFalsy();
    expect(JSON.stringify(schema.content)).toContain('observedAt');
    expect(JSON.stringify(schema.content)).toContain('healthPillarIds');
    expect(JSON.stringify(schema.content)).toContain('task_plan');
    const direct = await client.callTool({ name: 'record_health_observation', arguments: { proposalId: '00000000-0000-4000-8000-000000000000', idempotencyKey: 'unapproved-record-001' } });
    expect(direct.isError).toBeTruthy();
  } finally { await client.close(); await server.close(); }
});

test('legacy wildcard and unrelated scopes cannot see health tools', async () => {
  for (const [scopes, id] of [[['*'], 'legacy'], [['tasks:read', 'professional:read'], 'other']] as const) {
    const { client, server } = await connect([...scopes], id);
    try { expect((await client.listTools()).tools.map(item => item.name)).not.toContain('list_health_observations'); }
    finally { await client.close(); await server.close(); }
  }
});

test('scoped MCP proposes an exact task; only web human approval permits apply', async () => {
  const previous = process.env.LIFESYSTEM_DATA_DIR;
  const dir = await mkdtemp(join(tmpdir(), 'ls-health-mcp-action-'));
  process.env.LIFESYSTEM_DATA_DIR = dir;
  const { client, server } = await connect(['health:only', 'health:read', 'health:propose', 'health:apply'], 'orion-action-mcp');
  try {
    const pillar = await storage.create<Pillar>('pillars', { name: 'Corpo', description: '', currentStatus: '', target: '', color: '#123456', icon: 'heart', sortOrder: 0 });
    await saveHealthContext({ profile: null, objectives: [], preferences: [], routines: [], limitations: null, equipment: null, healthPillarIds: [pillar.id] }, 0, 'mcp-context-001', { id: 'owner', human: true });
    const proposed = await client.callTool({ name: 'propose_health_change', arguments: { operation: 'task_create', task: { title: 'Visitar academia', priority: 'normal', pillarId: pillar.id }, expectedContextRevision: 1, idempotencyKey: 'mcp-task-intent-001' } });
    expect(proposed.isError).toBeFalsy();
    const proposal = JSON.parse((proposed.content as { type: string; text: string }[])[0].text) as { id: string; revision: number; hash: string };
    const denied = await client.callTool({ name: 'apply_health_change', arguments: { proposalId: proposal.id, idempotencyKey: 'mcp-task-apply-001' } });
    expect(denied.isError).toBe(true);
    expect(await storage.getAll<Task>('tasks')).toHaveLength(0);
    await approveHealthProposal(proposal.id, proposal.revision, proposal.hash, { id: 'owner', human: true });
    const applied = await client.callTool({ name: 'apply_health_change', arguments: { proposalId: proposal.id, idempotencyKey: 'mcp-task-apply-001' } });
    expect(applied.isError).toBeFalsy();
    expect(await storage.getAll<Task>('tasks')).toHaveLength(1);
  } finally {
    await client.close(); await server.close();
    if (previous === undefined) delete process.env.LIFESYSTEM_DATA_DIR; else process.env.LIFESYSTEM_DATA_DIR = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
