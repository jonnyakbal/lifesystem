import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { storage } from '../src/lib/storage';
import type { Indicator, Pillar, Task } from '../src/types';
import { applyHealthChange, approveHealthProposal, getHealthContext, getHealthDailyBrief, proposeHealthChange, saveHealthContext } from '../src/lib/health/service';

test('explicit health context is versioned, approved and filters daily tasks by real pillar ID', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ls-health-context-'));
  const prior = process.env.LIFESYSTEM_DATA_DIR;
  process.env.LIFESYSTEM_DATA_DIR = dir;
  const human = { id: 'owner', human: true }, agent = { id: 'orion', human: false };
  try {
    expect((await getHealthContext()).unknown).toContain('limitations');
    const body = { profile: null, objectives: ['Criar uma rotina de movimento'], preferences: [], routines: [], limitations: null, equipment: null, healthPillarIds: [] as string[] };
    const pillar = await storage.create<Pillar>('pillars', { name: 'Corpo sintético', description: '', icon: 'heart', color: '#000000', sortOrder: 1, currentStatus: '', target: '' });
    const other = await storage.create<Pillar>('pillars', { name: 'Trabalho sintético', description: '', icon: 'briefcase', color: '#000000', sortOrder: 2, currentStatus: '', target: '' });
    body.healthPillarIds.push(pillar.id);
    const saved = await saveHealthContext(body, 0, 'context-human-001', human);
    expect(saved.revision).toBe(1);
    expect((await saveHealthContext(body, 0, 'context-human-001', human)).revision).toBe(1);
    await expect(saveHealthContext({ ...body, objectives: ['Outro objetivo'] }, 0, 'context-human-001', human)).rejects.toThrow(/idempot/i);
    await expect(saveHealthContext(body, 0, 'context-human-002', human)).rejects.toThrow(/revis/i);
    await expect(saveHealthContext({ ...body, healthPillarIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'] }, 1, 'context-bad-id', human)).rejects.toThrow(/pilar/i);

    await storage.create<Task>('tasks', { title: 'Escolher academia', priority: 'important', status: 'todo', pillarId: pillar.id, dueDate: '2026-09-30', sortOrder: 0, tags: [], checklist: [] });
    await storage.create<Task>('tasks', { title: 'Projeto sigiloso de outro pilar', priority: 'normal', status: 'todo', pillarId: other.id, dueDate: '2026-09-30', sortOrder: 0, tags: [], checklist: [] });
    await storage.create<Indicator>('indicators', { pillarId: pillar.id, name: 'Água planejada', type: 'count', frequency: 'daily', targetValue: 2, unit: 'L' });
    await storage.create<Indicator>('indicators', { pillarId: other.id, name: 'Meta de outro pilar', type: 'count', frequency: 'daily', targetValue: 3 });
    const offline = await getHealthDailyBrief('2026-09-30', 'America/Sao_Paulo', { calendar: async () => { throw new Error('offline'); } });
    expect(offline.tasks.items.map(item => item.title)).toEqual(['Escolher academia']);
    expect(offline.goals.map(item => item.name)).toEqual(['Água planejada']);
    expect(offline.goals[0].source).toBe('configured-target');
    expect(offline.calendar.status).toBe('unavailable');
    expect(offline.calendar.freeWindows).toBeNull();
    const online = await getHealthDailyBrief('2026-09-30', 'America/Sao_Paulo', { calendar: async () => [] });
    expect(online.calendar.status).toBe('verified');
    expect(online.calendar.freeWindows).toEqual([{ start: '08:00', end: '20:00' }]);
    const occupied = await getHealthDailyBrief('2026-09-30', 'America/Sao_Paulo', { calendar: async () => [
      { id: 'previous-day', title: 'Private', start: '2026-09-29T09:00:00-03:00', end: '2026-09-29T10:00:00-03:00', allDay: false },
      { id: 'busy', title: 'Private', start: '2026-09-30T12:00:00-03:00', end: '2026-09-30T13:00:00-03:00', allDay: false },
    ] });
    expect(occupied.calendar.freeWindows).toEqual([{ start: '08:00', end: '12:00' }, { start: '13:00', end: '20:00' }]);
    expect(JSON.stringify(occupied)).not.toContain('Private');

    const change = await proposeHealthChange({ operation: 'context', context: { ...body, preferences: ['Treinar de manhã quando possível'] }, expectedRevision: 1, idempotencyKey: 'context-proposal-001' }, agent);
    const pending = await getHealthDailyBrief('2026-09-30', 'America/Sao_Paulo', { calendar: async () => [] });
    expect(pending.pendingConfirmations).toEqual([{ id: change.id, operation: 'context', expiresAt: change.expiresAt, approved: false }]);
    await expect(getHealthDailyBrief('2026-02-30', 'America/Sao_Paulo', { calendar: async () => [] })).rejects.toThrow(/data/i);
    await expect(applyHealthChange(change.id, 'context-apply-001', agent)).rejects.toThrow(/aprova/i);
    await approveHealthProposal(change.id, change.revision, change.hash, human);
    expect((await applyHealthChange(change.id, 'context-apply-001', agent)).revision).toBe(2);
    expect((await getHealthContext()).data.preferences).toContain('Treinar de manhã quando possível');
  } finally {
    if (prior === undefined) delete process.env.LIFESYSTEM_DATA_DIR; else process.env.LIFESYSTEM_DATA_DIR = prior;
    await rm(dir, { recursive: true, force: true });
  }
});
