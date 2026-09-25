import { test, expect } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createLifesystemMcpServer } from '../src/lib/mcp/server';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

let testDataDir: string;

test.beforeAll(async () => {
  testDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lifesystem-mcp-test-'));
  process.env.LIFESYSTEM_DATA_DIR = testDataDir;
});

test.afterAll(async () => {
  delete process.env.LIFESYSTEM_DATA_DIR;
  if (testDataDir) await fs.rm(testDataDir, { recursive: true, force: true });
});

test('MCP handshake only exposes tools authorized for the client', async () => {
  const server = createLifesystemMcpServer(['tasks:read', 'financial:read']);
  const client = new Client({ name: 'protocol-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const tools = (await client.listTools()).tools.map(tool => tool.name);
    expect(tools).toContain('list_tasks');
    expect(tools).toContain('list_financial_entries');
    expect(tools).toContain('get_financial_summary');
    expect(tools).not.toContain('create_task');
    expect(tools).not.toContain('create_financial_entry');
    expect(tools).not.toContain('create_calendar_event');
  } finally {
    await client.close();
    await server.close();
  }
});

test('MCP task completion follows the same domain rule as the web API', async () => {
  const server = createLifesystemMcpServer(['tasks:write']);
  const client = new Client({ name: 'task-domain-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  let taskId: string | undefined;
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const created = await client.callTool({ name: 'create_task', arguments: { title: 'MCP domain test' } });
    expect(created.isError).toBeFalsy();
    taskId = JSON.parse((created.content as { text: string }[])[0].text).id;
    const updated = await client.callTool({ name: 'update_task', arguments: { id: taskId, status: 'done' } });
    expect(updated.isError).toBeFalsy();
    const task = JSON.parse((updated.content as { text: string }[])[0].text);
    expect(task.completedAt).toBeTruthy();
    const returned = await client.callTool({ name: 'update_task', arguments: { id: taskId, status: 'todo' } });
    expect(returned.isError).toBeFalsy();
    expect(JSON.parse((returned.content as { text: string }[])[0].text).completedAt).toBeFalsy();
  } finally {
    if (taskId) await client.callTool({ name: 'delete_task', arguments: { id: taskId } });
    await client.close();
    await server.close();
  }
});

test('MCP financial mutations reject a date invalid in the web API', async () => {
  const server = createLifesystemMcpServer(['financial:write']);
  const client = new Client({ name: 'finance-domain-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const result = await client.callTool({ name: 'create_financial_entry', arguments: {
      type: 'income', category: 'Teste', amount: 1, date: 'amanhã',
    } });
    expect(result.isError).toBe(true);
  } finally {
    await client.close();
    await server.close();
  }
});
