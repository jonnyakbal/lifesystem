import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { storage } from '../src/lib/storage';
import { professionalCommand, approveProposal, professionalQuery } from '../src/lib/professional/service';
import type { ProfessionalRecord, Proposal } from '../src/lib/professional/schemas';
import type { Project } from '../src/types';

test('piloto profissional preserva aprovação, versões, idempotência e isolamento', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ls-professional-'));
  const previous = process.env.LIFESYSTEM_DATA_DIR;
  process.env.LIFESYSTEM_DATA_DIR = dir;
  try {
    const project = await storage.create<Project>('projects', { name: 'Projeto sintético', description: '', status: 'active', tags: [], links: [], needs: '', tasksCount: 0, tasksDone: 0 });
    const company = await storage.create<Project>('projects', { name: 'Empresa excluída', description: '', status: 'active', tags: [], links: [], needs: '', tasksCount: 0, tasksDone: 0 });
    const human = { id: 'owner', human: true };
    const agent = { id: 'sirius-test', human: false };
    const context = await professionalCommand({ action: 'save', kind: 'context', id: project.id, expectedRevision: 0, idempotencyKey: 'context-01', data: { projectId: project.id, brandId: 'arco-labs', objective: 'Pesquisa comercial', facts: [], hypotheses: [], unknowns: ['Público ainda desconhecido'] } }, human) as ProfessionalRecord;
    expect(context.revision).toBe(1);
    const overview = await professionalQuery({ view: 'overview' });
    expect(JSON.stringify(overview)).not.toContain(company.id);
    expect(JSON.stringify(await professionalQuery({ view: 'project', projectId: project.id }))).toContain('Público ainda desconhecido');
    await expect(professionalCommand({ action: 'save', kind: 'contact', idempotencyKey: 'contact-denied', data: { projectId: project.id, brandId: 'arco-labs', name: 'Não autorizado' } }, agent)).rejects.toThrow('aprovação');
    const data = { projectId: project.id, brandId: 'arco-labs', name: 'Empresa teste', channels: [{ type: 'website', value: 'https://example.test' }], verification: 'unknown' };
    const proposal = await professionalCommand({ action: 'propose', kind: 'contact', idempotencyKey: 'proposal-contact', data, approvalType: 'record_change' }, agent) as Proposal;
    await expect(approveProposal(proposal.id, proposal.revision, proposal.hash, agent)).rejects.toThrow('humana');
    await expect(professionalCommand({ action: 'apply', id: proposal.id, idempotencyKey: 'apply-contact' }, agent)).rejects.toThrow('aprovação');
    await approveProposal(proposal.id, proposal.revision, proposal.hash, human);
    const result = await professionalCommand({ action: 'apply', id: proposal.id, idempotencyKey: 'apply-contact' }, agent);
    const retry = await professionalCommand({ action: 'apply', id: proposal.id, idempotencyKey: 'apply-contact' }, agent);
    expect(retry.id).toBe(result.id);
    const second = await professionalCommand({ action: 'save', kind: 'contact', idempotencyKey: 'contact-02', data }, human);
    expect(second.id).toBe(result.id);
    await expect(professionalCommand({ action: 'save', kind: 'contact', id: result.id, expectedRevision: 0, idempotencyKey: 'stale-contact', data }, human)).rejects.toThrow('versão');
    await expect(professionalCommand({ action: 'save', kind: 'contact', idempotencyKey: 'wrong-brand', data: { ...data, brandId: 'arcopass' } }, human)).rejects.toThrow('marca');
    expect(await storage.getAll('financial')).toEqual([]);
  } finally { if (previous === undefined) delete process.env.LIFESYSTEM_DATA_DIR; else process.env.LIFESYSTEM_DATA_DIR = previous; await rm(dir, { recursive: true, force: true }); }
});
