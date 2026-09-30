import { test, expect } from '@playwright/test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  applyHealthChange, approveHealthProposal, correctHealthObservation,
  getHealthReceipt, getHealthSummary, listHealthObservations,
  proposeHealthChange, recordHealthObservation,
} from '../src/lib/health/service';

test('health ledger preserves explicit observations, idempotency, revisions and receipts', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ls-health-'));
  const prior = process.env.LIFESYSTEM_DATA_DIR;
  process.env.LIFESYSTEM_DATA_DIR = dir;
  const human = { id: 'owner', human: true };
  const agent = { id: 'orion', human: false };
  const water = { type: 'water' as const, ml: 500, observedAt: '2026-09-30T09:00:00-03:00', timezone: 'America/Sao_Paulo' };
  try {
    const first = await recordHealthObservation(water, 'water-intent-001', human);
    expect((await recordHealthObservation(water, 'water-intent-001', human)).id).toBe(first.id);
    await expect(recordHealthObservation({ ...water, ml: 600 }, 'water-intent-001', human)).rejects.toThrow(/idempot/i);
    const second = await recordHealthObservation(water, 'water-intent-002', human);
    expect(second.id).not.toBe(first.id);
    expect((await getHealthReceipt('water-intent-001', human))?.resultId).toBe(first.id);
    await expect(recordHealthObservation(water, 'agent-intent-001', agent)).rejects.toThrow(/humana|aprova/i);

    const proposal = await proposeHealthChange({ operation: 'record', observation: { type: 'energy', score: 7, observedAt: '2026-09-30T10:00:00-03:00', timezone: 'America/Sao_Paulo' }, idempotencyKey: 'proposal-energy-001' }, agent);
    await expect(approveHealthProposal(proposal.id, proposal.revision, proposal.hash, agent)).rejects.toThrow(/humana/i);
    await expect(applyHealthChange(proposal.id, 'apply-energy-001', agent)).rejects.toThrow(/aprova/i);
    await approveHealthProposal(proposal.id, proposal.revision, proposal.hash, human);
    const applied = await applyHealthChange(proposal.id, 'apply-energy-001', agent);
    expect((await applyHealthChange(proposal.id, 'apply-energy-001', agent)).id).toBe(applied.id);
    expect((await getHealthReceipt('apply-energy-001', agent))?.resultId).toBe(applied.id);
    await expect(approveHealthProposal(proposal.id, proposal.revision, '0'.repeat(64), human)).rejects.toThrow(/hash|aplicad/i);

    const corrected = await correctHealthObservation(first.id, 1, { ...water, ml: 400 }, 'valor informado incorretamente', 'correct-water-001', human);
    expect(corrected.revision).toBe(2);
    expect(corrected.versions).toHaveLength(1);
    expect(corrected.versions[0].data.type === 'water' ? corrected.versions[0].data.ml : null).toBe(500);
    await expect(correctHealthObservation(first.id, 1, { ...water, ml: 300 }, 'novo ajuste', 'correct-water-002', human)).rejects.toThrow(/revis/i);
    const list = await listHealthObservations({ type: 'water', limit: 1 });
    expect(list.items).toHaveLength(1);
    expect(list.nextCursor).toBeTruthy();
    expect((await listHealthObservations({ type: 'water', limit: 1, cursor: list.nextCursor! })).items).toHaveLength(1);
    const summary = await getHealthSummary('2026-09-30', '2026-09-30');
    expect(summary.counts.water).toBe(2);
    expect(summary.waterMl).toBe(900);
    expect(summary.averageEnergy).toBe(7);
  } finally {
    if (prior === undefined) delete process.env.LIFESYSTEM_DATA_DIR; else process.env.LIFESYSTEM_DATA_DIR = prior;
    await rm(dir, { recursive: true, force: true });
  }
});

test('health schema does not invent weighing date or sleep duration', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ls-health-'));
  const prior = process.env.LIFESYSTEM_DATA_DIR;
  process.env.LIFESYSTEM_DATA_DIR = dir;
  const human = { id: 'owner', human: true };
  try {
    await expect(recordHealthObservation({ type: 'weight', kg: 70, timezone: 'America/Sao_Paulo' } as never, 'undated-weight-001', human)).rejects.toThrow();
    await expect(recordHealthObservation({ type: 'movement', activity: 'Treino planejado', completed: true, observedAt: '2099-01-01T10:00:00-03:00', timezone: 'America/Sao_Paulo' }, 'future-movement-001', human)).rejects.toThrow(/futura/i);
    const partial = await recordHealthObservation({ type: 'sleep', startedAt: '2026-09-29T23:00:00-03:00', observedAt: '2026-09-29T23:00:00-03:00', timezone: 'America/Sao_Paulo' }, 'partial-sleep-001', human);
    expect(partial.durationMinutes).toBeNull();
    const complete = await recordHealthObservation({ type: 'sleep', startedAt: '2026-09-29T23:00:00-03:00', endedAt: '2026-09-30T07:00:00-03:00', observedAt: '2026-09-30T07:00:00-03:00', timezone: 'America/Sao_Paulo' }, 'complete-sleep-001', human);
    expect(complete.durationMinutes).toBe(480);
    await recordHealthObservation({ type: 'sleep', startedAt: '2026-09-30T06:00:00-03:00', endedAt: '2026-09-30T08:00:00-03:00', observedAt: '2026-09-30T08:00:00-03:00', timezone: 'America/Sao_Paulo' }, 'overlap-sleep-001', human);
    expect((await getHealthSummary('2026-09-30', '2026-09-30')).sleepMinutes).toBe(540);
    const local = await recordHealthObservation({ type: 'water', ml: 250, observedAt: '2026-09-30T01:30:00Z', timezone: 'America/Sao_Paulo' }, 'local-date-water-001', human);
    expect((await listHealthObservations({ from: '2026-09-29', to: '2026-09-29', type: 'water' })).items.map(item => item.id)).toContain(local.id);
    expect((await getHealthSummary('2026-09-29', '2026-09-29')).waterMl).toBe(250);
    const empty = await getHealthSummary('2026-10-01', '2026-10-07');
    expect(empty.counts.water).toBe(0);
    expect(empty.averageEnergy).toBeNull();
  } finally {
    if (prior === undefined) delete process.env.LIFESYSTEM_DATA_DIR; else process.env.LIFESYSTEM_DATA_DIR = prior;
    await rm(dir, { recursive: true, force: true });
  }
});

test('health write waits for a lock held outside this process', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ls-health-lock-'));
  const prior = process.env.LIFESYSTEM_DATA_DIR;
  process.env.LIFESYSTEM_DATA_DIR = dir;
  const lock = join(dir, '.health-ledger.lock');
  try {
    await mkdir(lock);
    let finished = false;
    const pending = recordHealthObservation({ type: 'water', ml: 200, observedAt: '2026-09-30T09:00:00-03:00', timezone: 'America/Sao_Paulo' }, 'locked-intent-001', { id: 'owner', human: true }).then(result => { finished = true; return result; });
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(finished).toBe(false);
    await rm(lock, { recursive: true });
    expect((await pending).data.type).toBe('water');
  } finally {
    await rm(lock, { recursive: true, force: true });
    if (prior === undefined) delete process.env.LIFESYSTEM_DATA_DIR; else process.env.LIFESYSTEM_DATA_DIR = prior;
    await rm(dir, { recursive: true, force: true });
  }
});
