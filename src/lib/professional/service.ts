import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { storage } from '@/lib/storage';
import type { Project, Task, Content, StageConfig } from '@/types';
import { prepareTaskUpdate, taskUpdateSchema } from '@/lib/task-domain';
import { schemas, commandSchema, type Actor, type Ledger, type Kind, type ProfessionalRecord, type Proposal, type ExternalJob } from './schemas';
import { readLedger, transactLedger } from './store';
import { DEFAULT_STAGES } from '@/lib/default-stages';
export { professionalQuery } from './queries';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
  return JSON.stringify(value);
}
export const fingerprint = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
const stableId = (actor: string, key: string) => `professional-${fingerprint([actor, key]).slice(0, 32)}`;
function required<T>(value: T | undefined | null, message: string): T { if (value === undefined || value === null) throw new Error(message); return value; }

async function validateBinding(ledger: Ledger, kind: Kind, data: Record<string, unknown>) {
  const project = await storage.getById<Project & { workspaceDomain?: string }>('projects', String(data.projectId));
  if (!project || project.workspaceDomain === 'company') throw new Error('Projeto não disponível no domínio profissional.');
  if (kind !== 'context') {
    const context = ledger.records.find(record => record.kind === 'context' && record.data.projectId === data.projectId);
    if (!context) throw new Error('Associe o projeto à área profissional antes de trabalhar.');
    if (context.data.brandId !== data.brandId) throw new Error('A marca não corresponde ao projeto.');
  }
  const assertReference = (id: string, expectedKind?: Kind) => {
    const record = ledger.records.find(item => item.id === id && (!expectedKind || item.kind === expectedKind));
    if (!record || record.data.brandId !== data.brandId || record.data.projectId !== data.projectId) throw new Error('Referência fora do projeto ou marca.');
    return record;
  };
  for (const [field, expectedKind] of [['contactId', 'contact'], ['companyId', 'contact'], ['workId', 'work']] as const) {
    if (data[field]) assertReference(String(data[field]), expectedKind);
  }
  for (const id of (data.dependencies || []) as string[]) assertReference(id, 'work');
  if (data.linkedTaskId) {
    const task = await storage.getById<{ id: string; projectId?: string }>('tasks', String(data.linkedTaskId));
    if (!task || task.projectId !== data.projectId) throw new Error('Tarefa fora do projeto.');
  }
  for (const id of (data.linkedTaskIds || []) as string[]) {
    const task = await storage.getById<{ id: string; projectId?: string }>('tasks', id);
    if (!task || task.projectId !== data.projectId) throw new Error('Tarefa fora do projeto.');
  }
  for (const id of (data.financialIds || []) as string[]) {
    const item = await storage.getById<{ id: string; projectId?: string }>('financial', id);
    if (!item || item.projectId !== data.projectId) throw new Error('Lançamento financeiro sem vínculo profissional verificável.');
  }
  if (kind === 'content') {
    for (const id of (data.linkedProjectIds || []) as string[]) {
      const context = ledger.records.find(item => item.kind === 'context' && item.data.projectId === id);
      if (!context || context.data.brandId !== data.brandId) throw new Error('Conteúdo com vínculos de marcas diferentes.');
    }
    if (data.stage === 'published' || data.status === 'published') throw new Error('Uma pauta aprovada não é publicação realizada. Use o fluxo humano de conteúdo após publicar.');
  }
  for (const id of (data.proposalIds || []) as string[]) {
    if (!ledger.proposals.some(item => item.id === id && item.data.projectId === data.projectId && item.data.brandId === data.brandId)) throw new Error('Proposta fora do projeto ou marca.');
  }
  for (const contact of (data.contactHistory || []) as { contactId: string }[]) assertReference(contact.contactId, 'contact');
  for (const prospect of (data.prospects || []) as { contactId: string }[]) assertReference(prospect.contactId, 'contact');
  for (const message of (data.messageDrafts || []) as { contactId: string }[]) {
    if (assertReference(message.contactId, 'contact').data.doNotContact) throw new Error('Contato registrou preferência de não contato.');
  }
}

function checkVersion(record: ProfessionalRecord | undefined, expected: number | undefined) {
  if (expected === undefined && record || (record?.revision || 0) !== (expected || 0)) throw new Error('Conflito de versão. Releia o registro antes de alterar.');
}
function normalizeChannel(type: string, value: string) {
  if (type === 'phone') return value.replace(/\D/g, '');
  return value.trim().toLowerCase().replace(/\/$/, '');
}
async function putRecord(ledger: Ledger, kind: Kind, data: Record<string, unknown>, actor: Actor, id: string, expectedRevision: number | undefined) {
  const previous = ledger.records.find(record => record.id === id);
  if (kind === 'context' && ledger.records.some(record => record.kind === 'context' && record.data.projectId === data.projectId && record.id !== id)) throw new Error('O projeto já possui um contexto profissional. Releia e altere a versão existente.');
  checkVersion(previous, expectedRevision);
  if (previous && (previous.kind !== kind || previous.data.projectId !== data.projectId || previous.data.brandId !== data.brandId)) throw new Error('Não é permitido mover registros entre projetos ou marcas.');
  if (kind === 'deliverable' && previous && previous.data.workId !== data.workId) throw new Error('Uma entrega não pode ser transferida entre trabalhos.');
  if (kind === 'context' && previous && previous.data.brandId !== data.brandId) throw new Error('A marca do contexto possui vínculos; não pode ser substituída.');
  if (kind === 'contact' && !previous) {
    const channels = data.channels as { type: string; value: string }[];
    const duplicate = ledger.records.find(item => item.kind === 'contact' && item.data.brandId === data.brandId && item.data.projectId === data.projectId && (item.data.channels as typeof channels).some(channel => channels.some(candidate => candidate.type === channel.type && normalizeChannel(candidate.type, candidate.value) === normalizeChannel(channel.type, channel.value))));
    if (duplicate) return duplicate; // A duplicate never overwrites prior facts silently.
  }
  if (kind === 'campaign') {
    const prospects = data.prospects as { contactId: string }[];
    data.prospects = prospects.filter((prospect, index) => prospects.findIndex(item => item.contactId === prospect.contactId) === index);
    if (!actor.human && (data.contactHistory as unknown[]).length) throw new Error('Histórico de contato efetivo exige registro humano nesta versão.');
    if (!actor.human && data.reviewState === 'approved') throw new Error('Aprovação de campanha exige ação humana.');
  }
  const now = new Date().toISOString();
  const record: ProfessionalRecord = { id, kind, data, revision: (previous?.revision || 0) + 1, author: actor.id, createdAt: previous?.createdAt || now, updatedAt: now };
  // Professional work has one visible business task. Its execution job is separate.
  // Stable IDs/projection versions recover a ledger-write timeout without duplicates.
  if (kind === 'work') {
    const work = schemas.work.parse(data);
    const taskId = work.linkedTaskId || `task-${id}`;
    const current = await storage.getById<Task>('tasks', taskId);
    const projectionFingerprint = fingerprint({ id, actor: actor.id, revision: record.revision, data });
    if (current?.professionalProjectionVersion === record.revision && current.professionalProjectionFingerprint !== projectionFingerprint) throw new Error('Existe uma projeção pendente de outra intenção. Recupere a intenção original antes de editar.');
    const stages = (await storage.query<StageConfig>('stage-configs', { scope: 'tasks' }))[0]?.stages || DEFAULT_STAGES.tasks;
    const status = work.status === 'done' ? stages.find(stage => stage.isTerminal)?.id : current?.status || stages.find(stage => !stage.isTerminal)?.id;
    if (!status) throw new Error('Configure uma etapa de tarefa compatível com esse trabalho.');
    const payload = { title: work.title, description: work.brief, projectId: work.projectId, priority: work.priority, dueDate: work.dueDate, status, workType: work.workType, responsible: work.responsible, nextAction: work.nextAction, professionalWorkId: id, professionalProjectionVersion: record.revision, professionalProjectionFingerprint: projectionFingerprint };
    if (current?.professionalProjectionVersion === record.revision && fingerprint(Object.fromEntries(Object.keys(payload).map(key => [key, (current as unknown as Record<string, unknown>)[key]]))) !== fingerprint(payload)) throw new Error('A projeção mudou depois do timeout. Revise a tarefa antes de recuperar.');
    if (!current) await storage.createOnce<Task>('tasks', taskId, { ...payload, ...(await prepareTaskUpdate(taskUpdateSchema.parse(payload))), tags: ['Profissional'], sortOrder: 0, checklist: [] });
    else if (current.professionalProjectionVersion !== record.revision) {
      const expectedAt = previous?.projectionUpdatedAt;
      if (previous && expectedAt && expectedAt !== current.updatedAt) throw new Error('A tarefa mudou em Tarefas; revise o registro antes de atualizar o trabalho.');
      const fields = await prepareTaskUpdate(taskUpdateSchema.parse(payload), current);
      await storage.updateChecked<Task>('tasks', taskId, { ...fields, professionalWorkId: id, professionalProjectionVersion: record.revision, professionalProjectionFingerprint: projectionFingerprint }, current.updatedAt);
    }
    record.data.linkedTaskId = taskId;
    record.projectionUpdatedAt = (await storage.getById<Task>('tasks', taskId))!.updatedAt;
  }
  if (kind === 'content') {
    const existing = await storage.getById<Content>('content', id);
    const projectionFingerprint = fingerprint({ id, actor: actor.id, revision: record.revision, data });
    if (existing?.professionalProjectionVersion === record.revision && existing.professionalProjectionFingerprint !== projectionFingerprint) throw new Error('Existe uma projeção pendente de outra intenção. Recupere a intenção original antes de editar.');
    if (existing && !previous?.projectionUpdatedAt && existing.professionalProjectionFingerprint !== projectionFingerprint) throw new Error('Conteúdo existente não pode ser sobrescrito por uma nova associação. Edite-o em Conteúdo.');
    const input = schemas.content.parse(data);
    const payload = { ...input, title: input.title, body: input.body || '', stage: (input.stage || 'idea') as Content['stage'], channel: input.channel || 'blog', category: input.category || 'Geral', format: input.format || '', tags: input.tags || [], status: input.status || 'draft', pinned: input.pinned || false, checklist: input.checklist || [], linkedTaskIds: input.linkedTaskIds || [], linkedProjectIds: Array.from(new Set([input.projectId, ...(input.linkedProjectIds || [])])), professionalProjectionVersion: record.revision, professionalProjectionFingerprint: projectionFingerprint };
    if (existing?.professionalProjectionVersion === record.revision && fingerprint(Object.fromEntries(Object.keys(payload).map(key => [key, (existing as unknown as Record<string, unknown>)[key]]))) !== fingerprint(payload)) throw new Error('A projeção mudou depois do timeout. Revise o conteúdo antes de recuperar.');
    if (!existing) await storage.createOnce<Content>('content', id, payload);
    else if (existing.professionalProjectionVersion !== record.revision) await storage.updateChecked<Content>('content', id, payload, previous?.projectionUpdatedAt);
    record.projectionUpdatedAt = (await storage.getById<Content>('content', id))!.updatedAt;
  }
  if (previous) ledger.records[ledger.records.indexOf(previous)] = record; else ledger.records.push(record);
  ledger.history.push({ at: now, actor: actor.id, action: `save:${kind}`, recordId: id, revision: record.revision });
  return record;
}

function approved(ledger: Ledger, proposal: Proposal) {
  return ledger.approvals.find(item => item.proposalId === proposal.id && item.revision === proposal.revision && item.hash === proposal.hash && Date.parse(item.expiresAt) > Date.now());
}
function assertJobAuthorization(ledger: Ledger, job: ExternalJob) {
  if (!job.authorizedUntil || Date.parse(job.authorizedUntil) <= Date.now() || !ledger.approvals.some(item => item.id === job.approvalId && Date.parse(item.expiresAt) > Date.now())) throw new Error('Escopo expirado: nova aprovação humana necessária.');
}
const eventSchema = z.object({ contractVersion: z.literal('1.0'), jobId: z.string(), eventId: z.string().min(1).max(200), sequence: z.number().int().positive(), execution: z.enum(['queued', 'running', 'blocked', 'failed', 'review']), boardId: z.string().max(200).optional(), cardId: z.string().max(200).optional(), verificationSummary: z.string().max(10000).optional() }).strict();

export async function professionalCommand(raw: unknown, actor: Actor): Promise<ProfessionalRecord | Proposal | ExternalJob> {
  const command = commandSchema.parse(raw);
  const digest = fingerprint(command);
  return transactLedger(async ledger => {
    const receipt = ledger.receipts.find(item => item.actor === actor.id && item.key === command.idempotencyKey);
    if (receipt) {
      if (receipt.fingerprint !== digest) throw new Error('Chave de idempotência usada com outros campos.');
      return receipt.result;
    }
    let result: ProfessionalRecord | Proposal | ExternalJob;
    if (command.action === 'apply') {
      const proposal = required(ledger.proposals.find(item => item.id === command.id), 'Proposta não encontrada.');
      if (proposal.author !== actor.id && !actor.human) throw new Error('Proposta pertence a outro agente.');
      if (proposal.resultId) {
        result = required(ledger.records.find(item => item.id === proposal.resultId), 'Resultado indisponível.');
      } else {
        if (!approved(ledger, proposal) || Date.parse(proposal.expiresAt) <= Date.now()) throw new Error('Esta operação exige aprovação humana vigente.');
        if (proposal.approvalType === 'external_action') throw new Error('Envio e publicação externos não são executados por este serviço.');
        await validateBinding(ledger, proposal.kind, proposal.data);
        if (proposal.approvalType === 'work_scope') {
          const work = schemas.work.parse(proposal.data);
          if (work.workType !== 'agent' || !work.responsible || !work.brief || !work.acceptanceCriteria.length || !work.expectedResult) throw new Error('Trabalho de agente precisa de responsável, briefing, resultado e critérios de aceite.');
        }
        const id = proposal.targetId || stableId(proposal.author, proposal.id);
        if (proposal.approvalType === 'deliverable') {
          const record = required(ledger.records.find(item => item.id === id && item.kind === 'deliverable'), 'Entrega não encontrada.');
          checkVersion(record, proposal.expectedRevision);
          if (fingerprint(record.data) !== fingerprint(proposal.data)) throw new Error('A entrega mudou; revise a versão atual.');
          result = record;
        } else result = await putRecord(ledger, proposal.kind, structuredClone(proposal.data), actor, id, proposal.expectedRevision);
        proposal.resultId = result.id;
        if (proposal.approvalType === 'work_scope') {
          const work = schemas.work.parse(result.data);
          if (work.workType !== 'agent' || !work.responsible || !work.brief || !work.acceptanceCriteria.length || !work.expectedResult) throw new Error('Trabalho de agente precisa de responsável, briefing, resultado e critérios de aceite.');
          ledger.jobs.push({ id: `job-${result.id}-v${result.revision}`, workId: result.id, projectId: work.projectId, brandId: work.brandId, agentId: work.responsible, scopeHash: fingerprint(result.data), scopeRevision: result.revision, approvalId: approved(ledger, proposal)!.id, authorizedUntil: proposal.expiresAt, execution: 'queued', sequence: 0, updatedAt: new Date().toISOString() });
        }
      }
    } else if (command.action === 'event') {
      const event = eventSchema.parse(command.data);
      const job = required(ledger.jobs.find(item => item.id === event.jobId), 'Trabalho externo não encontrado.');
      if (job.agentId !== actor.id && !actor.human) throw new Error('Este trabalho pertence a outro agente.');
      assertJobAuthorization(ledger, job);
      const work = required(ledger.records.find(item => item.id === job.workId), 'Escopo ausente.');
      if (work.revision !== job.scopeRevision || fingerprint(work.data) !== job.scopeHash) throw new Error('Escopo alterado: nova aprovação necessária.');
      if (event.sequence > job.sequence && job.lastEventId !== event.eventId && job.execution !== 'review') {
        Object.assign(job, { execution: event.execution, sequence: event.sequence, lastEventId: event.eventId, updatedAt: new Date().toISOString(), ...(event.boardId ? { boardId: event.boardId } : {}), ...(event.cardId ? { cardId: event.cardId } : {}), ...(event.verificationSummary ? { verifiedSummary: event.verificationSummary } : {}) });
        ledger.history.push({ at: job.updatedAt, actor: actor.id, action: `execution:${job.execution}`, recordId: job.id });
      }
      result = job;
    } else {
      const kind = required(command.kind, 'Informe o tipo do registro.');
      const data = schemas[kind].parse(command.data) as Record<string, unknown>;
      if (kind === 'context' && !actor.human) throw new Error('Associação de projetos e contexto exige aprovação humana pela interface.');
      await validateBinding(ledger, kind, data);
      if (command.action === 'propose') {
        const current = command.id ? ledger.records.find(item => item.id === command.id) : undefined;
        checkVersion(current, command.expectedRevision);
        const proposal: Proposal = { id: stableId(actor.id, command.idempotencyKey), revision: 1, kind, targetId: command.id, expectedRevision: command.expectedRevision || 0, data, approvalType: command.approvalType || 'record_change', author: actor.id, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), hash: '' };
        if (proposal.approvalType === 'work_scope' && kind !== 'work' || proposal.approvalType === 'deliverable' && kind !== 'deliverable') throw new Error('Tipo de aprovação não corresponde ao registro.');
        proposal.hash = fingerprint({ kind, targetId: proposal.targetId, expectedRevision: proposal.expectedRevision, data, approvalType: proposal.approvalType, author: actor.id, expiresAt: proposal.expiresAt });
        ledger.proposals.push(proposal); result = proposal;
        ledger.history.push({ at: proposal.createdAt, actor: actor.id, action: `propose:${kind}`, recordId: proposal.id });
      } else {
        if (!actor.human && command.action !== 'artifact') throw new Error('Alterações por agentes exigem proposta e aprovação humana.');
        if (command.action === 'artifact') {
          if (kind !== 'deliverable') throw new Error('Permissão de artefato não autoriza outros registros.');
          const job = required(ledger.jobs.find(item => item.workId === data.workId && item.scopeRevision === ledger.records.find(work => work.id === data.workId)?.revision), 'Trabalho sem escopo aprovado.');
          assertJobAuthorization(ledger, job);
          if (!actor.human && job.agentId !== actor.id) throw new Error('Artefato pertence a outro agente.');
          const work = required(ledger.records.find(item => item.id === job.workId), 'Trabalho ausente.');
          if (fingerprint(work.data) !== job.scopeHash || !(work.data.artifactKinds as string[]).includes(String(data.type))) throw new Error('Artefato fora do escopo aprovado.');
        }
        result = await putRecord(ledger, kind, data, actor, command.id || (kind === 'context' ? String(data.projectId) : stableId(actor.id, command.idempotencyKey)), command.expectedRevision);
      }
    }
    ledger.receipts.push({ key: command.idempotencyKey, actor: actor.id, fingerprint: digest, result: structuredClone(result) });
    return result;
  });
}

/** Only the cookie-authenticated approval route may supply a human actor. No MCP tool exposes this function. */
export async function approveProposal(id: string, revision: number, hash: string, actor: Actor) {
  if (!actor.human) throw new Error('Aprovação exige identidade humana autenticada.');
  return transactLedger(ledger => {
    const proposal = required(ledger.proposals.find(item => item.id === id), 'Proposta não encontrada.');
    if (proposal.revision !== revision || proposal.hash !== hash || Date.parse(proposal.expiresAt) <= Date.now()) throw new Error('Proposta ou versão expirada. Releia os campos.');
    const current = ledger.records.find(item => item.id === proposal.targetId);
    checkVersion(current, proposal.expectedRevision);
    if (proposal.approvalType === 'deliverable' && fingerprint(current?.data) !== fingerprint(proposal.data)) throw new Error('A entrega mudou; revise a versão atual.');
    const prior = approved(ledger, proposal); if (prior) return prior;
    const approval = { id: randomUUID(), proposalId: id, revision, hash, author: actor.id, expiresAt: proposal.expiresAt, approvedAt: new Date().toISOString() };
    ledger.approvals.push(approval); ledger.history.push({ at: approval.approvedAt, actor: actor.id, action: `approve:${proposal.approvalType}`, recordId: id, revision });
    return approval;
  });
}

export async function runProfessionalBatch(commands: unknown[], actor: Actor) {
  if (commands.length > 20) throw new Error('Máximo de 20 comandos por lote.');
  const results = [];
  for (let index = 0; index < commands.length; index++) {
    try { results.push({ index, ok: true, result: await professionalCommand(commands[index], actor) }); }
    catch (error) { results.push({ index, ok: false, error: error instanceof Error ? error.message : 'Falha no item.' }); }
  }
  return { results, succeeded: results.filter(item => item.ok).length, failed: results.filter(item => !item.ok).length };
}

export async function inspectProfessionalProposal(id: string) { const ledger = await readLedger(); return { proposal: ledger.proposals.find(item => item.id === id), approvals: ledger.approvals.filter(item => item.proposalId === id) }; }
