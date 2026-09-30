import { test, expect } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createLifesystemMcpServer } from '../src/lib/mcp/server';

test('Sirius recebe ferramentas profissionais mínimas sem autoaprovação nem acesso global', async () => {
  const server = createLifesystemMcpServer(['professional:only', 'professional:read', 'professional:propose', 'professional:apply', 'professional:artifact', 'professional:execution', 'projects:*', 'financial:*'], 'sirius');
  const client = new Client({ name: 'sirius-test', version: '1.0' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(st); await client.connect(ct);
    const names = (await client.listTools()).tools.map(tool => tool.name);
    expect(names).toContain('query_professional'); expect(names).toContain('submit_professional_artifact');
    expect(names).not.toContain('create_financial_entry'); expect(names).not.toContain('update_project'); expect(names).not.toContain('approve_professional_proposal');
    const schema = await client.callTool({ name: 'get_professional_schemas', arguments: {} });
    expect(schema.isError).toBeFalsy();
    const apply = await client.callTool({ name: 'apply_professional_proposal', arguments: { id: 'no-proposal', idempotencyKey: 'generic-yes-only' } });
    expect(apply.isError).toBeTruthy();
  } finally { await client.close(); await server.close(); }
});
