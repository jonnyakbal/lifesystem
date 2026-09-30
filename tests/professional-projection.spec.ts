import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { storage } from '../src/lib/storage';
import { professionalCommand, approveProposal, professionalQuery } from '../src/lib/professional/service';
import { readLedger } from '../src/lib/professional/store';
import { POST as approveRoute } from '../src/app/api/professional/approval/route';
import { NextRequest } from 'next/server';
import { createSessionToken, SESSION_COOKIE } from '../src/lib/auth';
import type { Content, Task } from '../src/types';
import type { ProfessionalRecord, Proposal, ExternalJob } from '../src/lib/professional/schemas';

test('projeções preservam etapas, rejeitam colisões e recuperam timeout de ledger', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ls-professional-projection-'));
  const prior = process.env.LIFESYSTEM_DATA_DIR; process.env.LIFESYSTEM_DATA_DIR = dir;
  const human = { id: 'owner', human: true };
  try {
    const project = await storage.create('projects', { name: 'Projeto sintético', status: 'active' });
    const binding = { projectId: project.id, brandId: 'arco-labs' };
    await professionalCommand({ action: 'save', kind: 'context', expectedRevision: 0, data: binding, idempotencyKey: 'projection-context' }, human);
    await expect(professionalCommand({ action: 'save', kind: 'context', id: 'another-context', data: binding, expectedRevision: 0, idempotencyKey: 'duplicate-context' }, human)).rejects.toThrow('já possui');
    const existing = await storage.create<Task>('tasks', { title: 'Tarefa em progresso', status: 'prioritized', projectId: project.id, tags: [], priority: 'normal', sortOrder: 0, checklist: [] });
    const work = await professionalCommand({ action: 'save', kind: 'work', data: { ...binding, title: existing.title, linkedTaskId: existing.id }, expectedRevision: 0, idempotencyKey: 'projection-work' }, human) as ProfessionalRecord;
    expect((await storage.getById<Task>('tasks', existing.id))?.status).toBe('prioritized');
    expect(work.data.linkedTaskId).toBe(existing.id);
    const legacy = await storage.create<Content>('content', { title: 'Manuscrito existente', body: 'Texto que precisa permanecer', tags: ['existente'], stage: 'review', channel: 'blog', category: 'Geral', format: '', status: 'draft', pinned: false, linkedTaskIds: [], linkedProjectIds: [], checklist: [{ id: 'c', text: 'Já revisado', done: true }] });
    await expect(professionalCommand({ action: 'save', kind: 'content', id: legacy.id, expectedRevision: 0, data: { ...binding, title: 'Título novo' }, idempotencyKey: 'collision-content' }, human)).rejects.toThrow('existente');
    expect(await storage.getById('content', legacy.id)).toEqual(legacy);
    const command = { action: 'save', kind: 'content', expectedRevision: 0, data: { ...binding, title: 'Pauta autorizada', body: 'a'.repeat(900), audience: 'Público declarado', objective: 'Objetivo declarado', cta: 'CTA', responsible: 'editor', editorialLine: 'Produto', metrics: { views: 10 }, checklist: [{ id: 'i', text: 'Revisar', done: false }] }, idempotencyKey: 'recover-content-ledger' };
    const transaction = storage.transact;
    const failing = async (...args: Parameters<typeof transaction>) => {
      if (args[0] === 'professional-ledger') return transaction(args[0], async items => { await args[1](items); throw new Error('synthetic ledger timeout'); });
      return transaction(...args);
    };
    storage.transact = failing as typeof transaction;
    try { await expect(professionalCommand(command, human)).rejects.toThrow('timeout'); }
    finally { storage.transact = transaction; }
    const content = await professionalCommand(command, human) as ProfessionalRecord;
    expect((await storage.getAll<Content>('content')).filter(item => item.id === content.id)).toHaveLength(1);
    expect(await professionalCommand(command, human)).toEqual(content);
    expect(await storage.getById<Content>('content', content.id)).toMatchObject(command.data);
    const list = await professionalQuery({ view: 'records', kind: 'content' }) as { items: ProfessionalRecord[] };
    expect(String(list.items[0].data.body).length).toBe(600);
    const detail = await professionalQuery({ view: 'records', kind: 'content', id: content.id }) as { items: ProfessionalRecord[] };
    expect(String(detail.items[0].data.body).length).toBe(900);
    const update = { ...command, id: content.id, expectedRevision: 1, data: { ...command.data, body: 'Alpha' }, idempotencyKey: 'recover-revision-two' };
    storage.transact = failing as typeof transaction;
    try { await expect(professionalCommand(update, human)).rejects.toThrow('timeout'); }
    finally { storage.transact = transaction; }
    await expect(professionalCommand({ ...update, data: { ...update.data, body: 'Bravo' }, idempotencyKey: 'different-intention-two' }, human)).rejects.toThrow('outra intenção');
    const revised = await professionalCommand(update, human) as ProfessionalRecord;
    expect(revised.revision).toBe(2);
    expect((await storage.getById<Content>('content', revised.id))?.body).toBe('Alpha');

  } finally { if (prior === undefined) delete process.env.LIFESYSTEM_DATA_DIR; else process.env.LIFESYSTEM_DATA_DIR = prior; await rm(dir, { recursive: true, force: true }); }
});

test('cookie humano aprova escopo exato e expiração bloqueia eventos e artefatos', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ls-professional-approval-'));
  const prior = { dir: process.env.LIFESYSTEM_DATA_DIR, user: process.env.AUTH_USER, password: process.env.AUTH_PASSWORD };
  process.env.LIFESYSTEM_DATA_DIR = dir; process.env.AUTH_USER = 'qa-owner'; process.env.AUTH_PASSWORD = 'synthetic-only';
  const human = { id: 'qa-owner', human: true }, agent = { id: 'sirius-test', human: false };
  try {
    const project = await storage.create('projects', { name: 'Synthetic', status: 'active' });
    const binding = { projectId: project.id, brandId: 'arco-labs' };
    await professionalCommand({ action: 'save', kind: 'context', expectedRevision: 0, data: binding, idempotencyKey: 'cookie-context' }, human);
    const data = { ...binding, title: 'Pesquisa', workType: 'agent', responsible: agent.id, brief: 'Fontes públicas', expectedResult: 'Lista', acceptanceCriteria: ['Fontes verificáveis'], artifactKinds: ['research'] };
    const proposal = await professionalCommand({ action: 'propose', kind: 'work', data, approvalType: 'work_scope', idempotencyKey: 'cookie-scope' }, agent) as Proposal;
    const cookie = `${SESSION_COOKIE}=${await createSessionToken()}`;
    const response = await approveRoute(new NextRequest('http://localhost/api/professional/approval', { method: 'POST', headers: { cookie, origin: 'http://localhost', 'Content-Type': 'application/json' }, body: JSON.stringify({ proposalId: proposal.id, revision: proposal.revision, hash: proposal.hash }) }));
    expect(response.status).toBe(200);
    const work = await professionalCommand({ action: 'apply', id: proposal.id, idempotencyKey: 'cookie-apply' }, agent) as ProfessionalRecord;
    const artifact = { ...binding, workId: work.id, title: 'Pesquisa', type: 'research', body: 'Resultado sintético' };
    const delivery = await professionalCommand({ action: 'artifact', kind: 'deliverable', data: artifact, idempotencyKey: 'cookie-artifact' }, agent) as ProfessionalRecord;
    const other = await professionalCommand({ action: 'propose', kind: 'work', data: { ...data, title: 'Outro trabalho' }, approvalType: 'work_scope', idempotencyKey: 'second-scope' }, agent) as Proposal;
    await approveProposal(other.id, other.revision, other.hash, human);
    const otherWork = await professionalCommand({ action: 'apply', id: other.id, idempotencyKey: 'second-apply' }, agent) as ProfessionalRecord;
    await expect(professionalCommand({ action: 'artifact', kind: 'deliverable', id: delivery.id, expectedRevision: 1, data: { ...artifact, workId: otherWork.id }, idempotencyKey: 'transfer-artifact' }, agent)).rejects.toThrow('transferida');
    const ledger = await readLedger(); const job = ledger.jobs[0] as ExternalJob;
    ledger.jobs[0].authorizedUntil = '2000-01-01T00:00:00.000Z'; await storage.transact('professional-ledger', items => { items.splice(0, items.length, ledger); });
    await expect(professionalCommand({ action: 'event', data: { contractVersion: '1.0', jobId: job.id, eventId: 'expired-event', sequence: 1, execution: 'running' }, idempotencyKey: 'expired-event-key' }, agent)).rejects.toThrow('expirado');
    await expect(professionalCommand({ action: 'artifact', kind: 'deliverable', data: artifact, idempotencyKey: 'expired-artifact-key' }, agent)).rejects.toThrow('expirado');
  } finally { for (const [key, value] of Object.entries({ LIFESYSTEM_DATA_DIR: prior.dir, AUTH_USER: prior.user, AUTH_PASSWORD: prior.password })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } await rm(dir, { recursive: true, force: true }); }
});
