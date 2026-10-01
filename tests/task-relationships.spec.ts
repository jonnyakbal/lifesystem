import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { storage } from '../src/lib/storage';
import * as domain from '../src/lib/task-domain';
import { taskPayloadSchema } from '../src/lib/validation';
import type { Task } from '../src/types';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createLifesystemMcpServer } from '../src/lib/mcp/server';

let dir: string, previous: string | undefined;
test.beforeEach(async () => { previous = process.env.LIFESYSTEM_DATA_DIR; dir = await mkdtemp(join(tmpdir(), 'ls-task-links-')); process.env.LIFESYSTEM_DATA_DIR = dir; });
test.afterEach(async () => { if (previous === undefined) delete process.env.LIFESYSTEM_DATA_DIR; else process.env.LIFESYSTEM_DATA_DIR = previous; await rm(dir, { recursive: true, force: true }); });
const task = (title: string) => storage.create<Task>('tasks', { title, status: 'todo', priority: 'normal', tags: [], checklist: [], sortOrder: 0 });
const patch = (input: unknown) => domain.taskUpdateSchema.parse(input);

test('campos de vínculos e esforço preservam semântica e permitem remoção explícita', () => {
  expect(taskPayloadSchema.parse({ parentId: 'one', dependsOnIds: ['two'], estimatedMinutes: 90 })).toMatchObject({ parentId: 'one', dependsOnIds: ['two'], estimatedMinutes: 90 });
  expect(patch({ parentId: null, dependsOnIds: [], estimatedMinutes: null })).toMatchObject({ parentId: null, dependsOnIds: [], estimatedMinutes: null });
  expect(taskPayloadSchema.safeParse({ estimatedMinutes: -1 }).success).toBe(false);
});
test('hierarquia rejeita pai inexistente, autorreferência e ciclos sem alterar registros', async () => {
  const a = await task('A'), b = await task('B');
  await expect(domain.updateTaskRecord(a.id, patch({ parentId: 'missing' }))).rejects.toThrow(/não encontrada/);
  await expect(domain.updateTaskRecord(a.id, patch({ parentId: a.id }))).rejects.toThrow(/própria/);
  await domain.updateTaskRecord(b.id, patch({ parentId: a.id }));
  await expect(domain.updateTaskRecord(a.id, patch({ parentId: b.id }))).rejects.toThrow(/ciclo/);
  expect((await storage.getById<Task>('tasks', a.id))?.parentId).toBeUndefined();
});
test('dependências rejeitam ciclos e bloqueiam conclusão até resolver; reabrir não conclui outros', async () => {
  const a = await task('A'), b = await task('B');
  await domain.updateTaskRecord(b.id, patch({ dependsOnIds: [a.id] }));
  await expect(domain.updateTaskRecord(a.id, patch({ dependsOnIds: [b.id] }))).rejects.toThrow(/ciclo/);
  await expect(domain.updateTaskRecord(b.id, patch({ status: 'done' }))).rejects.toThrow(/dependências/);
  await domain.updateTaskRecord(a.id, patch({ status: 'done' }));
  await domain.updateTaskRecord(b.id, patch({ status: 'done' }));
  await domain.updateTaskRecord(a.id, patch({ status: 'todo' }));
  expect((await storage.getById<Task>('tasks', b.id))?.status).toBe('done');
});
test('subtarefas não são checklist e pai não conclui enquanto filhas abertas', async () => {
  const parent = await task('Pai'), child = await task('Filha');
  await domain.updateTaskRecord(child.id, patch({ parentId: parent.id }));
  await expect(domain.updateTaskRecord(parent.id, patch({ status: 'done' }))).rejects.toThrow(/subtarefas/);
  await domain.updateTaskRecord(child.id, patch({ status: 'done' }));
  expect((await storage.getById<Task>('tasks', parent.id))?.status).toBe('todo');
  await domain.updateTaskRecord(parent.id, patch({ status: 'done' }));
});
test('exclusão protege vínculos sobreviventes e permite excluir conjunto completo', async () => {
  const a = await task('A'), b = await task('B');
  await domain.updateTaskRecord(b.id, patch({ parentId: a.id }));
  await expect(storage.delete<Task>('tasks', a.id)).rejects.toThrow(/vínculos/);
  expect(await storage.deleteMany<Task>('tasks', [a.id, b.id])).toHaveLength(2);
});
test('criação atômica e repetição MCP preservam o mesmo ID', async () => {
  const create = (domain as unknown as { createTaskRecords?: (inputs: unknown[], ids?: string[]) => Promise<Task[]> }).createTaskRecords;
  expect(create).toBeDefined();
  const a = await task('Pai');
  const input = { title: 'Filha', parentId: a.id, estimatedMinutes: 45 };
  const first = await create!([input], ['stable-child']);
  expect(first[0].parentId).toBe(a.id); expect(first[0].estimatedMinutes).toBe(45);
  expect((await create!([input], ['stable-child']))[0].id).toBe(first[0].id);
  await expect(create!([{ title: 'Sem pai', parentId: 'missing' }])).rejects.toThrow(/não encontrada/);
  expect(await storage.getAll<Task>('tasks')).toHaveLength(2);
});
test('ciclo misto entre hierarquia e dependência também é rejeitado', async () => {
  const a = await task('Pai'), b = await task('Filha');
  await domain.updateTaskRecord(b.id, patch({ parentId: a.id }));
  await expect(domain.updateTaskRecord(b.id, patch({ dependsOnIds: [a.id] }))).rejects.toThrow(/ciclo/);
});
test('lote de conclusão é atômico e gera recorrência uma vez, inclusive no retry', async () => {
  const a = await task('Base'), b = await task('Recorrente');
  await domain.updateTaskRecord(b.id, patch({ dependsOnIds: [a.id], recurring: true, recurringFrequency: 'daily', dueDate: '2026-12-31' }));
  await expect(domain.updateTaskRecords([b.id], patch({ status: 'done' }))).rejects.toThrow(/dependências/);
  expect((await storage.getById<Task>('tasks', b.id))?.status).toBe('todo');
  await domain.updateTaskRecords([b.id, a.id], patch({ status: 'done' }));
  const nextId = (await storage.getById<Task>('tasks', b.id))?.nextOccurrenceId;
  expect(nextId).toBeTruthy(); expect((await storage.getById<Task>('tasks', nextId!))?.dueDate).toBe('2027-01-01');
  await domain.updateTaskRecords([b.id, a.id], patch({ status: 'done' }));
  expect(await storage.getAll<Task>('tasks')).toHaveLength(3);
});
test('MCP expõe os campos e usa o mesmo domínio para vínculos, bloqueios e recorrência', async () => {
  const server = createLifesystemMcpServer(['tasks:read', 'tasks:write'], 'qa-relationships');
  const client = new Client({ name: 'qa-task-links', version: '1' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const data = (result: unknown) => JSON.parse((result as { content: { text: string }[] }).content[0].text);
  try {
    await server.connect(serverTransport); await client.connect(clientTransport);
    const tools = await client.listTools();
    expect(tools.tools.find(tool => tool.name === 'create_task')?.inputSchema.properties).toHaveProperty('dependsOnIds');
    const base = data(await client.callTool({ name: 'create_task', arguments: { title: 'Base sintética', idempotencyKey: 'base-task' } }));
    const input = { title: 'Etapa sintética', dependsOnIds: [base.id], estimatedMinutes: 90, recurring: true, recurringFrequency: 'daily', dueDate: '2026-12-31', idempotencyKey: 'dependent-task' };
    const created = data(await client.callTool({ name: 'create_task', arguments: input }));
    expect(created).toMatchObject({ dependsOnIds: [base.id], estimatedMinutes: 90 });
    expect(data(await client.callTool({ name: 'create_task', arguments: input })).id).toBe(created.id);
    expect((await client.callTool({ name: 'update_task', arguments: { id: created.id, status: 'done' } })).isError).toBe(true);
    expect((await client.callTool({ name: 'update_task', arguments: { id: base.id, status: 'done' } })).isError).toBeFalsy();
    const completed = data(await client.callTool({ name: 'update_task', arguments: { id: created.id, status: 'done' } }));
    expect(completed.nextOccurrenceId).toBeTruthy();
    await client.callTool({ name: 'update_task', arguments: { id: created.id, status: 'todo' } });
    await client.callTool({ name: 'update_task', arguments: { id: created.id, status: 'done' } });
    expect(await storage.getAll<Task>('tasks')).toHaveLength(3);
  } finally { await client.close(); await server.close(); }
});
