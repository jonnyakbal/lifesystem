import { test, expect } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { storage } from '../src/lib/storage';
import type { Pillar, Task } from '../src/types';
import { approveHealthProposal, applyHealthChange, proposeHealthChange, saveHealthContext } from '../src/lib/health/service';
import { exchangeGoogleCode } from '../src/lib/google-calendar';
import { readHealthLedger } from '../src/lib/health/store';

const agent = { id: 'orion-action-test', human: false };
const human = { id: 'owner', human: true };

test('approved health task is created once, bound to declared pillar, and duplicate intent is rejected', async () => {
  const original = process.env.LIFESYSTEM_DATA_DIR;
  const dir = await mkdtemp(join(tmpdir(), 'ls-health-actions-'));
  process.env.LIFESYSTEM_DATA_DIR = dir;
  try {
    const pillar = await storage.create<Pillar>('pillars', { name: 'Corpo', description: '', currentStatus: '', target: '', color: '#123456', icon: 'heart', sortOrder: 0 });
    const context = { profile: null, objectives: [], preferences: [], routines: [], limitations: null, equipment: null, healthPillarIds: [pillar.id] };
    await saveHealthContext(context, 0, 'context-actions-001', human);
    const input = { operation: 'task_create' as const, task: { title: 'Caminhar', priority: 'normal' as const, pillarId: pillar.id, dueDate: '2026-10-02' }, expectedContextRevision: 1, idempotencyKey: 'task-create-001' };
    const proposal = await proposeHealthChange(input, agent);
    await expect(applyHealthChange(proposal.id, 'task-apply-001', agent)).rejects.toThrow('aprovação');
    expect(await storage.getAll<Task>('tasks')).toHaveLength(0);
    await approveHealthProposal(proposal.id, proposal.revision, proposal.hash, human);
    const created = await applyHealthChange(proposal.id, 'task-apply-001', agent) as Task;
    expect(created.pillarId).toBe(pillar.id);
    expect(created.dueDate).toBe('2026-10-02');
    expect((await applyHealthChange(proposal.id, 'task-apply-001', agent) as Task).id).toBe(created.id);
    expect(await storage.getAll<Task>('tasks')).toHaveLength(1);
    expect((await proposeHealthChange(input, agent)).id).toBe(proposal.id);
    const ledger = await readHealthLedger();
    ledger.receipts = ledger.receipts.filter(item => item.key !== 'task-apply-001');
    const savedProposal = ledger.proposals.find(item => item.id === proposal.id)!;
    delete savedProposal.appliedAt; delete savedProposal.resultId;
    await writeFile(join(dir, 'health-ledger.json'), JSON.stringify(ledger));
    expect((await applyHealthChange(proposal.id, 'task-apply-001', agent) as Task).id).toBe(created.id);
    expect(await storage.getAll<Task>('tasks')).toHaveLength(1);
    await expect(proposeHealthChange({ ...input, idempotencyKey: 'task-create-002' }, agent)).rejects.toThrow('duplicad');
    await expect(proposeHealthChange({ ...input, task: { ...input.task, pillarId: crypto.randomUUID() }, idempotencyKey: 'task-create-003' }, agent)).rejects.toThrow('Pilar');
  } finally {
    if (original === undefined) delete process.env.LIFESYSTEM_DATA_DIR; else process.env.LIFESYSTEM_DATA_DIR = original;
    await rm(dir, { recursive: true, force: true });
  }
});

test('approved block retries failed Google sync with one stable event and refuses stale task', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  const dir = await mkdtemp(join(tmpdir(), 'ls-health-block-'));
  process.env.LIFESYSTEM_DATA_DIR = dir;
  process.env.GOOGLE_CALENDAR_CLIENT_ID = 'test';
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'test';
  process.env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
  let fail = true; let calendarConflict = false; let inserts = 0; let remote: Record<string, unknown> | null = null;
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith('/token')) return Response.json({ access_token: 'test', refresh_token: 'test', expires_in: 3600 });
    if (String(url).includes('/events?')) return Response.json({ items: calendarConflict ? [{ id: 'busy-other', summary: 'Ocupado', start: { dateTime: '2026-10-03T13:30:00Z' }, end: { dateTime: '2026-10-03T14:30:00Z' } }] : [] });
    if (fail) throw new Error('offline');
    if (!options?.method || options.method === 'GET') return remote ? Response.json(remote) : Response.json({}, { status: 404 });
    if (options.method === 'POST') { inserts++; remote = { ...JSON.parse(String(options.body)), etag: 'v1', htmlLink: 'https://calendar.google.com/event?eid=test' }; }
    return Response.json(remote);
  };
  try {
    await exchangeGoogleCode('test', 'https://example.com/callback');
    const pillar = await storage.create<Pillar>('pillars', { name: 'Corpo', description: '', currentStatus: '', target: '', color: '#123456', icon: 'heart', sortOrder: 0 });
    await saveHealthContext({ profile: null, objectives: [], preferences: [], routines: [], limitations: null, equipment: null, healthPillarIds: [pillar.id] }, 0, 'context-block-001', human);
    const task = await storage.create<Task>('tasks', { title: 'Treino', pillarId: pillar.id, status: 'todo', priority: 'normal', sortOrder: 0, tags: [], checklist: [] });
    const planning = { date: '2026-10-03', startAt: '2026-10-03T13:00:00Z', endAt: '2026-10-03T14:00:00Z', timeZone: 'America/Sao_Paulo', syncToGoogle: true };
    const proposal = await proposeHealthChange({ operation: 'task_plan', taskId: task.id, expectedTitle: task.title, expectedUpdatedAt: task.updatedAt, expectedContextRevision: 1, planning, idempotencyKey: 'block-propose-001' }, agent);
    await approveHealthProposal(proposal.id, proposal.revision, proposal.hash, human);
    const other = await storage.create<Task>('tasks', { title: 'Outro bloco', status: 'todo', priority: 'normal', sortOrder: 0, tags: [], checklist: [], planning: { ...planning, syncToGoogle: false, syncState: 'local' } });
    await expect(applyHealthChange(proposal.id, 'block-apply-001', agent)).rejects.toThrow('outra tarefa');
    await storage.delete<Task>('tasks', other.id);
    calendarConflict = true;
    await expect(applyHealthChange(proposal.id, 'block-apply-001', agent)).rejects.toThrow('evento ocupado');
    calendarConflict = false;
    await expect(applyHealthChange(proposal.id, 'block-apply-001', agent)).rejects.toThrow('Google');
    expect((await readHealthLedger()).receipts.some(item => item.key === 'block-apply-001')).toBe(false);
    const pending = await storage.getById<Task>('tasks', task.id);
    expect(pending?.planning?.eventId).toBeTruthy();
    expect(pending?.planning?.syncState).toBe('error');
    fail = false;
    const result = await applyHealthChange(proposal.id, 'block-apply-001', agent) as Task;
    expect(result.planning?.syncState).toBe('synced');
    expect(result.planning?.eventId).toBe(pending?.planning?.eventId);
    expect((await applyHealthChange(proposal.id, 'block-apply-001', agent) as Task).id).toBe(task.id);
    expect(inserts).toBe(1);
    const ledger = await readHealthLedger();
    ledger.receipts = ledger.receipts.filter(item => item.key !== 'block-apply-001');
    const savedProposal = ledger.proposals.find(item => item.id === proposal.id)!;
    delete savedProposal.appliedAt; delete savedProposal.resultId;
    await writeFile(join(dir, 'health-ledger.json'), JSON.stringify(ledger));
    expect((await applyHealthChange(proposal.id, 'block-apply-001', agent) as Task).id).toBe(task.id);
    expect(inserts).toBe(1);
    const stale = await proposeHealthChange({ operation: 'task_plan', taskId: task.id, expectedTitle: task.title, expectedUpdatedAt: result.updatedAt, expectedContextRevision: 1, planning: { ...planning, date: '2026-10-04', startAt: '2026-10-04T13:00:00Z', endAt: '2026-10-04T14:00:00Z' }, idempotencyKey: 'block-propose-002' }, agent);
    await storage.update<Task>('tasks', task.id, { title: 'Mudança humana' });
    await expect(approveHealthProposal(stale.id, stale.revision, stale.hash, human)).rejects.toThrow('revisão');
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of ['LIFESYSTEM_DATA_DIR', 'GOOGLE_CALENDAR_CLIENT_ID', 'GOOGLE_CALENDAR_CLIENT_SECRET', 'GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY']) {
      if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key];
    }
    await rm(dir, { recursive: true, force: true });
  }
});
