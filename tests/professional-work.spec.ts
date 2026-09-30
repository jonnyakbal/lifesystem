import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { professionalCommand, approveProposal, professionalQuery, runProfessionalBatch } from '../src/lib/professional/service';
import { storage } from '../src/lib/storage';
import { readLedger } from '../src/lib/professional/store';
import { SimulatedHermesAdapter } from '../src/lib/professional/hermes';
import { POST as approvalRoute } from '../src/app/api/professional/approval/route';
import { createSessionToken, SESSION_COOKIE } from '../src/lib/auth';
import type { Proposal, ProfessionalRecord } from '../src/lib/professional/schemas';

test('escopo, adapter simulado, Review e revisão de entrega exigem aprovações distintas', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ls-professional-work-'));
  const prior = process.env.LIFESYSTEM_DATA_DIR; process.env.LIFESYSTEM_DATA_DIR = dir;
  const owner = { id: 'owner', human: true }, agent = { id: 'sirius', human: false };
  try {
    const project = await storage.create('projects', { name: 'Sintético', status: 'active' });
    const binding = { projectId: project.id, brandId: 'arco-labs' };
    await professionalCommand({ action: 'save', kind: 'context', data: binding, expectedRevision: 0, idempotencyKey: 'pilot-context' }, owner);
    const scope = await professionalCommand({ action: 'propose', kind: 'work', approvalType: 'work_scope', idempotencyKey: 'pilot-work-scope', data: { ...binding, title: 'Pesquisar prospects', workType: 'agent', responsible: 'sirius', brief: 'Pesquisar fontes públicas e declarar lacunas. Não enviar mensagens.', expectedResult: 'Lista e script para revisão', acceptanceCriteria: ['URLs verificáveis; não inventar contatos'], artifactKinds: ['prospect_list', 'script'] } }, agent) as Proposal;
    expect((await readLedger()).jobs).toHaveLength(0);
    await approveProposal(scope.id, scope.revision, scope.hash, owner);
    const work = await professionalCommand({ action: 'apply', id: scope.id, idempotencyKey: 'pilot-work-apply' }, agent) as ProfessionalRecord;
    const job = (await readLedger()).jobs[0];
    const adapter = new SimulatedHermesAdapter();
    const card = await adapter.submit({ job, brief: work.data, idempotencyKey: job.id });
    expect(await adapter.submit({ job, brief: work.data, idempotencyKey: job.id })).toEqual(card);
    await professionalCommand({ action: 'event', idempotencyKey: 'event-pilot-1', data: await adapter.observe(job) }, agent);
    const event = { contractVersion: '1.0', jobId: job.id, eventId: 'review-3', sequence: 3, execution: 'review' };
    await professionalCommand({ action: 'event', idempotencyKey: 'event-pilot-3', data: event }, agent);
    await professionalCommand({ action: 'event', idempotencyKey: 'event-pilot-2', data: { ...event, eventId: 'running-2', sequence: 2, execution: 'running' } }, agent);
    expect((await readLedger()).jobs[0].execution).toBe('review');
    expect((await readLedger()).records.find(item => item.id === work.id)?.data.status).toBe('open');
    const artifactData = { ...binding, title: 'Lista pesquisada', workId: work.id, type: 'prospect_list', body: 'Nenhum contato confirmado nesta pesquisa sintética.', sources: [] };
    const delivery = await professionalCommand({ action: 'artifact', kind: 'deliverable', idempotencyKey: 'artifact-pilot-v1', data: artifactData }, agent) as ProfessionalRecord;
    await expect(professionalCommand({ action: 'artifact', kind: 'deliverable', idempotencyKey: 'artifact-out-of-scope', data: { ...artifactData, type: 'proposal' } }, agent)).rejects.toThrow('escopo');
    const proposal = await professionalCommand({ action: 'propose', kind: 'deliverable', id: delivery.id, expectedRevision: delivery.revision, approvalType: 'deliverable', idempotencyKey: 'approve-delivery-v1', data: delivery.data }, agent) as Proposal;
    await approveProposal(proposal.id, proposal.revision, proposal.hash, owner);
    await professionalCommand({ action: 'artifact', kind: 'deliverable', id: delivery.id, expectedRevision: 1, idempotencyKey: 'artifact-pilot-v2', data: { ...artifactData, body: 'Versão revisada' } }, agent);
    await expect(professionalCommand({ action: 'apply', id: proposal.id, idempotencyKey: 'apply-old-delivery' }, agent)).rejects.toThrow('versão');
    const batch = await runProfessionalBatch([{ action: 'propose', kind: 'contact', idempotencyKey: 'partial-valid', data: { ...binding, name: 'Empresa desconhecida' } }, { action: 'propose', kind: 'contact', idempotencyKey: 'partial-invalid', data: { ...binding, brandId: 'arcopass', name: 'Marca errada' } }], agent);
    expect(batch).toMatchObject({ succeeded: 1, failed: 1 });
    const deliveries = await professionalQuery({ view: 'records', kind: 'deliverable' }) as { items: { approvedRevision: number | null }[] };
    expect(deliveries.items[0].approvedRevision).toBeNull();
    expect(await storage.getAll('financial')).toEqual([]);
  } finally { if (prior === undefined) delete process.env.LIFESYSTEM_DATA_DIR; else process.env.LIFESYSTEM_DATA_DIR = prior; await rm(dir, { recursive: true, force: true }); }
});

test('aprovação REST exige identidade humana e campos exatos, mesmo em desenvolvimento', async () => {
  const prior = { user: process.env.AUTH_USER, pass: process.env.AUTH_PASSWORD };
  process.env.AUTH_USER = 'qa-owner'; process.env.AUTH_PASSWORD = 'synthetic-approval-only';
  try {
    const request = (body: unknown, cookie?: string) => new NextRequest('http://localhost/api/professional/approval', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {}) }, body: JSON.stringify(body) });
    expect((await approvalRoute(request({ answer: 'sim' }))).status).toBe(403);
    expect((await approvalRoute(request({ answer: 'sim' }, await createSessionToken()))).status).toBe(403);
  } finally { process.env.AUTH_USER = prior.user || ''; process.env.AUTH_PASSWORD = prior.pass || ''; }
});
