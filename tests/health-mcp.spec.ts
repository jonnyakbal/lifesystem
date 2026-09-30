import { test, expect } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createLifesystemMcpServer } from '../src/lib/mcp/server';

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
    for (const name of ['get_health_capabilities', 'get_health_schemas', 'get_health_context', 'list_health_observations', 'get_health_summary', 'get_health_receipt', 'propose_health_change', 'apply_health_change', 'record_health_observation', 'correct_health_observation']) expect(names).toContain(name);
    for (const name of ['create_financial_entry', 'list_tasks', 'query_professional', 'approve_health_proposal']) expect(names).not.toContain(name);
    const capabilities = await client.callTool({ name: 'get_health_capabilities', arguments: {} });
    expect(capabilities.isError).toBeFalsy();
    expect(JSON.stringify(capabilities.content)).toContain('health:read');
    const schema = await client.callTool({ name: 'get_health_schemas', arguments: {} });
    expect(schema.isError).toBeFalsy();
    expect(JSON.stringify(schema.content)).toContain('observedAt');
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
