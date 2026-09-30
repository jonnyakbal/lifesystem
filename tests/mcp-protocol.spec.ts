import { test, expect } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createLifesystemMcpServer } from '../src/lib/mcp/server';
import { storage } from '../src/lib/storage';
import type { McpCallLog } from '../src/lib/mcp/log';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

let testDataDir: string;

test('MCP mantém centavos exatos e permite remover vencimento pela mesma regra da interface', async () => {
  const server = createLifesystemMcpServer(['financial:read', 'financial:write']);
  const client = new Client({ name: 'financial-redesign-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    for (const amount of [0.1, 0.2]) {
      const result = await client.callTool({ name: 'create_financial_entry', arguments: { type: 'income', category: 'Teste centavos', amount, date: '2035-01-01', paidDate: '2035-02-01', status: 'paid', idempotencyKey: `cents-${amount}` } });
      expect(result.isError).toBeFalsy();
    }
    const response = await client.callTool({ name: 'get_financial_summary', arguments: { month: '2035-02' } });
    expect(JSON.parse((response.content as { text: string }[])[0].text)).toMatchObject({ realized: { income: 0.3, balance: 0.3 } });
    const created = await client.callTool({ name: 'create_financial_entry', arguments: { type: 'expense_fixed', category: 'Teste vencimento', amount: 50, date: '2035-01-01', dueDate: '2035-02-02', status: 'pending', idempotencyKey: 'due-date-test-2035' } });
    const id = JSON.parse((created.content as { text: string }[])[0].text).id;
    const updated = await client.callTool({ name: 'update_financial_entry', arguments: { id, dueDate: null } });
    expect(updated.isError).toBeFalsy();
    const january = await client.callTool({ name: 'get_financial_summary', arguments: { month: '2035-01' } });
    expect(JSON.parse((january.content as { text: string }[])[0].text)).toMatchObject({ projected: { expenses: 50 }, realized: { expenses: 0 } });
  } finally { await client.close(); await server.close(); }
});

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

test('MCP audit identifies the scoped client', async () => {
  const server = createLifesystemMcpServer(['tasks:read'], 'hermes-test');
  const client = new Client({ name: 'audit-client-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    await client.callTool({ name: 'list_tasks', arguments: {} });
    const logs = await storage.getAll<McpCallLog>('mcp-logs');
    expect(logs.some(log => log.tool === 'list_tasks' && log.clientId === 'hermes-test')).toBe(true);
  } finally {
    await client.close();
    await server.close();
  }
});

test('MCP task completion follows the same domain rule as the web API', async () => {
  const server = createLifesystemMcpServer(['tasks:write', 'tasks:delete']);
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
  const server = createLifesystemMcpServer(['financial:write', 'financial:delete']);
  const client = new Client({ name: 'finance-domain-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const result = await client.callTool({ name: 'create_financial_entry', arguments: {
      type: 'income', category: 'Teste', amount: 1, date: 'amanhã', idempotencyKey: 'invalid-date-test-001',
    } });
    expect(result.isError).toBe(true);
  } finally {
    await client.close();
    await server.close();
  }
});

test('MCP financial tools share card validation and preserve bill installments', async () => {
  const server = createLifesystemMcpServer(['financial:write']);
  const client = new Client({ name: 'finance-contract-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  let billId: string | undefined;
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const invalidCard = await client.callTool({ name: 'create_card', arguments: {
      name: 'Cartão teste', type: 'credit', lastDigits: '12', brand: 'Teste',
    } });
    expect(invalidCard.isError).toBe(true);

    const created = await client.callTool({ name: 'create_bill', arguments: {
      cardId: 'test-card', month: '2026-09', amount: 20,
      dueDate: '2026-09-25', closeDate: '2026-09-15',
      items: [{ id: 'test-item', description: 'Parcela teste', amount: 20, date: '2026-09-01', installments: { current: 1, total: 2 } }],
    } });
    expect(created.isError).toBeFalsy();
    const bill = JSON.parse((created.content as { text: string }[])[0].text);
    billId = bill.id;
    expect(bill.items[0].installments).toEqual({ current: 1, total: 2 });
  } finally {
    if (billId) await client.callTool({ name: 'delete_bill', arguments: { id: billId } });
    await client.close();
    await server.close();
  }
});

test('MCP exposes bounded reads and delegates capture conversion and task planning to product engines', async () => {
  const server = createLifesystemMcpServer(['tasks:read', 'tasks:plan', 'captures:convert']);
  const client = new Client({ name: 'planning-actions-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    const capture = await storage.create<{ id: string; content: string; type: 'text'; status: 'inbox'; title: string }> ('captures', {
      content: 'Preparar roteiro', type: 'text', status: 'inbox', title: 'Roteiro',
    });
    const task = await storage.create<{ id: string; title: string; status: string; priority: 'normal'; sortOrder: number; tags: string[]; checklist: unknown[] }> ('tasks', {
      title: 'Reservar foco', status: 'todo', priority: 'normal', sortOrder: 0, tags: [], checklist: [],
    });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const tools = (await client.listTools()).tools.map(tool => tool.name);
    expect(tools).toContain('convert_capture');
    expect(tools).toContain('plan_task_block');
    expect(tools).not.toContain('delete_task');

    const converted = await client.callTool({ name: 'convert_capture', arguments: { captureId: capture.id, targetType: 'task' } });
    expect(converted.isError).toBeFalsy();
    expect(JSON.parse((converted.content as { text: string }[])[0].text)).toMatchObject({ targetType: 'task' });

    const planned = await client.callTool({ name: 'plan_task_block', arguments: {
      taskId: task.id, date: '2026-10-01', timeZone: 'America/Sao_Paulo', syncToGoogle: false,
    } });
    expect(planned.isError).toBeFalsy();
    expect(JSON.parse((planned.content as { text: string }[])[0].text).planning).toMatchObject({ date: '2026-10-01', syncState: 'local' });

    const listed = await client.callTool({ name: 'list_tasks', arguments: { limit: 1 } });
    const page = JSON.parse((listed.content as { text: string }[])[0].text);
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toEqual(expect.any(String));
  } finally {
    await client.close();
    await server.close();
  }
});

test('calendar scopes expose only the intended read and managed lifecycle tools', async () => {
  const server = createLifesystemMcpServer(['calendar:read']);
  const client = new Client({ name: 'calendar-scope-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const tools = (await client.listTools()).tools.map(tool => tool.name);
    expect(tools).toEqual(['list_calendar_events']);
  } finally {
    await client.close();
    await server.close();
  }
});

test('financial idempotency key replays one created entry', async () => {
  const server = createLifesystemMcpServer(['financial:write'], 'hermes-finance');
  const client = new Client({ name: 'financial-idempotency-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const args = { type: 'expense_variable', category: 'Teste', amount: 25, date: '2026-10-01', idempotencyKey: 'finance-2026-10-01-001' };
    const [first, second] = await Promise.all([
      client.callTool({ name: 'create_financial_entry', arguments: args }),
      client.callTool({ name: 'create_financial_entry', arguments: args }),
    ]);
    const one = JSON.parse((first.content as { text: string }[])[0].text);
    const replay = JSON.parse((second.content as { text: string }[])[0].text);
    expect(replay.id).toBe(one.id);
    expect(replay.replayed).toBe(true);
  } finally {
    await client.close();
    await server.close();
  }
});

test('finance retry recovers a saved entry after receipt persistence fails', async () => {
  const server = createLifesystemMcpServer(['financial:write']);
  const client = new Client({ name: 'receipt-recovery-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const originalCreate = storage.create;
  const key = 'receipt-failure-recovery-2044';
  const args = { type: 'expense_variable', category: 'Synthetic receipt recovery', amount: 17, date: '2044-01-01', idempotencyKey: key };
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    storage.create = async (collection, data) => {
      if (collection === 'mcp-receipts') throw new Error('synthetic receipt disk failure');
      return originalCreate(collection, data);
    };
    const first = await client.callTool({ name: 'create_financial_entry', arguments: args });
    expect(first.isError).toBe(true);
    storage.create = originalCreate;
    const recovered = await client.callTool({ name: 'create_financial_entry', arguments: args });
    expect(recovered.isError).toBeFalsy();
    const records = (await storage.getAll<{ id: string; category: string }>('financial')).filter(item => item.category === args.category);
    expect(records).toHaveLength(1);
    expect(JSON.parse((recovered.content as { text: string }[])[0].text).id).toBe(records[0].id);
  } finally {
    storage.create = originalCreate;
    await client.close();
    await server.close();
  }
});

test('financial entry creation requires a stable idempotency key', async () => {
  const server = createLifesystemMcpServer(['financial:write'], 'hermes-finance-required-key');
  const client = new Client({ name: 'financial-required-key-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const listed = await client.listTools();
    const createTool = listed.tools.find(tool => tool.name === 'create_financial_entry');
    expect(createTool).toBeTruthy();
    expect((createTool?.inputSchema as { required?: string[] }).required).toContain('idempotencyKey');

    const result = await client.callTool({ name: 'create_financial_entry', arguments: {
      type: 'expense_variable', category: 'Teste sem chave', amount: 19.9, date: '2045-01-01',
    } });
    expect(result.isError).toBe(true);
    expect(await storage.query('financial', { category: 'Teste sem chave' })).toHaveLength(0);
  } finally {
    await client.close();
    await server.close();
  }
});

test('MCP resume previsões pelo vencimento e pagamentos pelo dia pago', async () => {
  const server = createLifesystemMcpServer(['financial:read', 'financial:write'], 'finance-period-test');
  const client = new Client({ name: 'financial-period-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    for (const entry of [
      { type: 'expense_fixed', category: 'Teste previsto', amount: 200, date: '2041-12-28', dueDate: '2042-01-10', status: 'pending', idempotencyKey: 'period-pending-2042-01' },
      { type: 'expense_variable', category: 'Teste pago', amount: 75, date: '2041-12-28', dueDate: '2042-01-12', paidDate: '2042-02-03', status: 'paid', idempotencyKey: 'period-paid-2042-02' },
      { type: 'income', category: 'Teste legado', amount: 50, date: '2042-01-15', status: 'paid', idempotencyKey: 'period-legacy-2042-01' },
    ]) {
      expect((await client.callTool({ name: 'create_financial_entry', arguments: entry })).isError).toBeFalsy();
    }
    const read = async (month: string) => {
      const result = await client.callTool({ name: 'get_financial_summary', arguments: { month } });
      expect(result.isError).toBeFalsy();
      return JSON.parse((result.content as { text: string }[])[0].text);
    };
    expect(await read('2041-12')).toMatchObject({ entries: 0 });
    expect(await read('2042-01')).toMatchObject({ entries: 2, realized: { income: 50, expenses: 0 }, projected: { expenses: 200 } });
    expect(await read('2042-02')).toMatchObject({ entries: 1, realized: { expenses: 75 }, projected: { expenses: 0 } });
  } finally {
    await client.close();
    await server.close();
  }
});
