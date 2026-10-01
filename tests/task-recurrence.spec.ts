import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { storage } from '../src/lib/storage';
import * as domain from '../src/lib/task-domain';
import type { Task, StageConfig } from '../src/types';

const spawn = () => {
  const implementation = (domain as unknown as { spawnNextTaskOccurrence?: (id: string) => Promise<Task> }).spawnNextTaskOccurrence;
  expect(implementation, 'geração persistente no servidor').toBeDefined();
  return implementation!;
};
let dir: string;
let previous: string | undefined;
test.beforeEach(async () => { previous = process.env.LIFESYSTEM_DATA_DIR; dir = await mkdtemp(join(tmpdir(), 'ls-recurrence-')); process.env.LIFESYSTEM_DATA_DIR = dir; });
test.afterEach(async () => { if (previous === undefined) delete process.env.LIFESYSTEM_DATA_DIR; else process.env.LIFESYSTEM_DATA_DIR = previous; await rm(dir, { recursive: true, force: true }); });
async function source(overrides: Partial<Task> = {}) {
  return storage.create<Task>('tasks', { title: 'Rotina sintética', status: 'done', completedAt: '2026-10-01T12:00:00Z', priority: 'important', tags: ['qa'], checklist: [{ id: 'ck', text: 'Passo', done: true }], sortOrder: 0, recurring: true, recurringFrequency: 'monthly', dueDate: '2027-01-31', ...overrides });
}
test('reabrir e reconcluir depois de uma nova sessão recupera a mesma ocorrência', async () => {
  const task = await source(); const generate = spawn(); const first = await generate(task.id);
  expect(first.dueDate).toBe('2027-02-28'); expect(first.status).toBe('todo'); expect(first.checklist).toEqual([]);
  await storage.update<Task>('tasks', task.id, { status: 'todo', completedAt: undefined });
  await storage.update<Task>('tasks', task.id, { status: 'done', completedAt: '2026-10-02T12:00:00Z' });
  const replay = await generate(task.id); expect(replay.id).toBe(first.id); expect(await storage.getAll<Task>('tasks')).toHaveLength(2);
});
test('requisições concorrentes criam uma única próxima ocorrência e cada ocorrência segue sua cadeia', async () => {
  const task = await source({ recurringFrequency: 'weekly', dueDate: '2026-12-29' }); const generate = spawn();
  const results = await Promise.all(Array.from({ length: 12 }, () => generate(task.id)));
  expect(new Set(results.map(result => result.id)).size).toBe(1); expect(results[0].dueDate).toBe('2027-01-05');
  await storage.update<Task>('tasks', results[0].id, { status: 'done', completedAt: '2027-01-05T12:00:00Z' });
  const next = await generate(results[0].id); expect(next.id).not.toBe(results[0].id); expect(next.dueDate).toBe('2027-01-12'); expect(await storage.getAll<Task>('tasks')).toHaveLength(3);
});
test('uma ocorrência excluída não reaparece ao reconcluir sua origem', async () => {
  const task = await source(); const generate = spawn(); const next = await generate(task.id); await storage.delete('tasks', next.id);
  await expect(generate(task.id)).rejects.toThrow(/excluída/); expect(await storage.getAll<Task>('tasks')).toHaveLength(1);
});
test('uma tarefa aberta ou não recorrente não gera ocorrências', async () => {
  const generate = spawn(); const open = await source({ status: 'todo', completedAt: undefined });
  await expect(generate(open.id)).rejects.toThrow(/concluída/);
  const ordinary = await source({ recurring: false }); await expect(generate(ordinary.id)).rejects.toThrow(/recorrente/);
  expect(await storage.getAll<Task>('tasks')).toHaveLength(2);
});
test('etapa terminal configurada e etapa inicial são respeitadas; planejamento não é clonado', async () => {
  await storage.create<StageConfig>('stage-configs', { scope: 'tasks', stages: [{ id: 'waiting', label: 'Aguardando', color: '', dot: '' }, { id: 'closed', label: 'Fechada', color: '', dot: '', isTerminal: true }] });
  const task = await source({ status: 'closed', planning: { date: '2027-01-31', timeZone: 'America/Sao_Paulo', syncToGoogle: true, syncState: 'synced', eventId: 'do-not-copy' } });
  const next = await spawn()(task.id); expect(next.status).toBe('waiting'); expect(next.planning).toBeUndefined(); expect(next.completedAt).toBeUndefined();
});
test('concluir pelo domínio já gera a ocorrência atomicamente; recuperação funciona mesmo após reabrir', async () => {
  const task = await source({ status: 'doing', completedAt: undefined });
  const completed = await domain.updateTaskRecord(task.id, { status: 'done' });
  expect(completed?.nextOccurrenceId).toBeTruthy(); expect(await storage.getAll<Task>('tasks')).toHaveLength(2);
  await domain.updateTaskRecord(task.id, { status: 'doing' });
  expect((await spawn()(task.id)).id).toBe(completed?.nextOccurrenceId);
  await domain.updateTaskRecord(task.id, { status: 'done' }); expect(await storage.getAll<Task>('tasks')).toHaveLength(2);
});
test('editar uma tarefa já concluída preserva a data original de conclusão', async () => {
  const task = await source({ recurring: false, completedAt: '2026-09-01T12:00:00Z' });
  const updated = await domain.updateTaskRecord(task.id, { title: 'Título ajustado', status: 'done' });
  expect(updated?.completedAt).toBe('2026-09-01T12:00:00Z');
});
test('sucessora de subtarefa é independente e não reabre trabalho já concluído do pai', async () => {
  const parent = await source({ status: 'todo', recurring: false, completedAt: undefined });
  const child = await source({ status: 'todo', completedAt: undefined, parentId: parent.id });
  await domain.updateTaskRecords([parent.id, child.id], { status: 'done' });
  const completed = await storage.getById<Task>('tasks', child.id);
  const next = await storage.getById<Task>('tasks', completed!.nextOccurrenceId!);
  expect(next?.parentId).toBeUndefined(); expect((await storage.getById<Task>('tasks', parent.id))?.status).toBe('done');
});
