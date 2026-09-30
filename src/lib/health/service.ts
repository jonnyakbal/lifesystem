import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { storage } from '@/lib/storage';
import type { Indicator, Pillar, StageConfig, Task } from '@/types';
import { DEFAULT_STAGES } from '@/lib/default-stages';
import { listGoogleCalendarEvents, type GoogleCalendarEvent } from '@/lib/google-calendar';
import { clockLabel, freeIntervals } from '@/lib/planning-availability';
import { healthContextSchema, healthObservationSchema, proposalInputSchema, type HealthActor, type HealthContext, type HealthContextData, type HealthLedger, type HealthObservation, type HealthObservationInput, type HealthProposal, type HealthProposalInput, type HealthReceipt } from './schemas';
import { readHealthLedger, transactHealthLedger } from './store';

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
  return value;
}
export function healthFingerprint(value: unknown) { return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }
function receipt(ledger: HealthLedger, actor: HealthActor, key: string, operation: string, payload: unknown): HealthReceipt | null {
  const found = ledger.receipts.find(item => item.actor === actor.id && item.key === key);
  if (!found) return null;
  if (found.operation !== operation || found.fingerprint !== healthFingerprint(payload)) throw new Error('Conflito de idempotência: chave usada com operação ou dados diferentes.');
  return found;
}
function remember(ledger: HealthLedger, actor: HealthActor, key: string, operation: string, payload: unknown, resultId: string) {
  ledger.receipts.push({ actor: actor.id, key, operation, fingerprint: healthFingerprint(payload), resultId, recordedAt: new Date().toISOString() });
}
function duration(data: HealthObservationInput): number | null {
  if (data.type !== 'sleep' || !data.startedAt || !data.endedAt) return null;
  const minutes = (Date.parse(data.endedAt) - Date.parse(data.startedAt)) / 60_000;
  if (minutes <= 0 || minutes > 36 * 60) throw new Error('Intervalo de sono inválido.');
  return minutes;
}
function validateTemporal(data: HealthObservationInput) {
  const latest = Date.now() + 5 * 60_000;
  if (Date.parse(data.observedAt) > latest) throw new Error('Observação futura não pode ser registrada como realizada.');
  if (data.type === 'sleep') {
    if (data.startedAt && Date.parse(data.startedAt) > latest) throw new Error('Início de sono futuro não é observação.');
    if (data.endedAt && Date.parse(data.endedAt) > latest) throw new Error('Fim de sono futuro não é observação.');
    duration(data);
  }
}
async function validateReferences(data: HealthObservationInput) {
  validateTemporal(data);
  if (data.pillarId && !await storage.getById<Pillar>('pillars', data.pillarId)) throw new Error('Pilar inexistente.');
  if (data.indicatorId) {
    const indicator = await storage.getById<Indicator>('indicators', data.indicatorId);
    if (!indicator || (data.pillarId && indicator.pillarId !== data.pillarId)) throw new Error('Indicador inexistente ou fora do pilar informado.');
  }
}
async function validateContextReferences(data: HealthContextData) {
  for (const id of data.healthPillarIds) if (!await storage.getById<Pillar>('pillars', id)) throw new Error('Pilar de saúde inexistente.');
}
function emptyContext(): HealthContext {
  return { id: 'health-context', revision: 0, data: { profile: null, objectives: [], preferences: [], routines: [], limitations: null, equipment: null, healthPillarIds: [] }, reviewedAt: null, actor: null };
}
function writeContext(ledger: HealthLedger, data: HealthContextData, expectedRevision: number, actor: HealthActor): HealthContext {
  const current = ledger.context || emptyContext();
  if (current.revision !== expectedRevision) throw new Error('Conflito de revisão: releia o contexto.');
  ledger.context = { id: 'health-context', revision: current.revision + 1, data, reviewedAt: new Date().toISOString(), actor: actor.id };
  return ledger.context;
}
export async function saveHealthContext(raw: unknown, expectedRevision: number, idempotencyKey: string, actor: HealthActor) {
  if (!actor.human) throw new Error('Aprovação humana autenticada necessária.');
  const data = healthContextSchema.parse(raw);
  if (idempotencyKey.length < 8 || idempotencyKey.length > 200) throw new Error('Chave de idempotência inválida.');
  await validateContextReferences(data);
  const payload = { data, expectedRevision };
  return transactHealthLedger(ledger => {
    const prior = receipt(ledger, actor, idempotencyKey, 'context', payload);
    if (prior) return ledger.context || emptyContext();
    const context = writeContext(ledger, data, expectedRevision, actor);
    remember(ledger, actor, idempotencyKey, 'context', payload, context.id);
    return context;
  });
}
function createObservation(ledger: HealthLedger, data: HealthObservationInput, actor: HealthActor, idempotencyKey: string): HealthObservation {
  const entry: HealthObservation = { id: randomUUID(), revision: 1, data, observedAt: data.observedAt, recordedAt: new Date().toISOString(), actor: actor.id, origin: 'self_report', idempotencyKey, durationMinutes: duration(data), versions: [] };
  ledger.observations.push(entry);
  return entry;
}
function reviseObservation(ledger: HealthLedger, id: string, expectedRevision: number, data: HealthObservationInput, reason: string, actor: HealthActor) {
  const entry = ledger.observations.find(item => item.id === id);
  if (!entry) throw new Error('Observação não encontrada.');
  if (entry.revision !== expectedRevision) throw new Error('Conflito de revisão: releia a observação.');
  if (entry.data.type !== data.type) throw new Error('Correção não pode trocar o tipo da observação.');
  entry.versions.push({ revision: entry.revision, data: entry.data, correctedAt: new Date().toISOString(), actor: actor.id, reason });
  entry.data = data; entry.observedAt = data.observedAt; entry.durationMinutes = duration(data); entry.revision++;
  return entry;
}
export async function recordHealthObservation(raw: unknown, idempotencyKey: string, actor: HealthActor) {
  if (!actor.human) throw new Error('Aprovação humana autenticada necessária.');
  const data = healthObservationSchema.parse(raw);
  if (idempotencyKey.length < 8 || idempotencyKey.length > 200) throw new Error('Chave de idempotência inválida.');
  await validateReferences(data);
  return transactHealthLedger(ledger => {
    const prior = receipt(ledger, actor, idempotencyKey, 'record', data);
    if (prior) return ledger.observations.find(item => item.id === prior.resultId)!;
    const entry = createObservation(ledger, data, actor, idempotencyKey);
    remember(ledger, actor, idempotencyKey, 'record', data, entry.id);
    return entry;
  });
}
export async function correctHealthObservation(id: string, expectedRevision: number, raw: unknown, reason: string, idempotencyKey: string, actor: HealthActor) {
  if (!actor.human) throw new Error('Aprovação humana autenticada necessária.');
  const data = healthObservationSchema.parse(raw);
  if (!reason || reason.trim().length < 3) throw new Error('Motivo da correção obrigatório.');
  if (idempotencyKey.length < 8 || idempotencyKey.length > 200) throw new Error('Chave de idempotência inválida.');
  await validateReferences(data);
  const payload = { id, expectedRevision, data, reason: reason.trim() };
  return transactHealthLedger(ledger => {
    const prior = receipt(ledger, actor, idempotencyKey, 'correct', payload);
    if (prior) return ledger.observations.find(item => item.id === prior.resultId)!;
    const entry = reviseObservation(ledger, id, expectedRevision, data, reason.trim(), actor);
    remember(ledger, actor, idempotencyKey, 'correct', payload, entry.id);
    return entry;
  });
}
export async function proposeHealthChange(raw: unknown, actor: HealthActor): Promise<HealthProposal> {
  const input: HealthProposalInput = proposalInputSchema.parse(raw);
  if (input.operation === 'context') await validateContextReferences(input.context);
  else await validateReferences(input.observation);
  const payload = { ...input, idempotencyKey: undefined };
  return transactHealthLedger(ledger => {
    const prior = receipt(ledger, actor, input.idempotencyKey, 'propose', payload);
    if (prior) return ledger.proposals.find(item => item.id === prior.resultId)!;
    if (input.operation === 'correct') {
      const target = ledger.observations.find(item => item.id === input.observationId);
      if (!target) throw new Error('Observação não encontrada.');
      if (target.revision !== input.expectedRevision) throw new Error('Conflito de revisão: releia a observação.');
      if (target.data.type !== input.observation.type) throw new Error('Correção não pode trocar o tipo da observação.');
    }
    if (input.operation === 'context' && (ledger.context?.revision || 0) !== input.expectedRevision) throw new Error('Conflito de revisão: releia o contexto.');
    const now = new Date();
    const proposal: HealthProposal = { id: randomUUID(), revision: 1, hash: healthFingerprint(payload), actor: actor.id, input, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() };
    ledger.proposals.push(proposal);
    remember(ledger, actor, input.idempotencyKey, 'propose', payload, proposal.id);
    return proposal;
  });
}
export async function approveHealthProposal(id: string, revision: number, hash: string, actor: HealthActor) {
  if (!actor.human) throw new Error('Identidade humana autenticada necessária.');
  return transactHealthLedger(ledger => {
    const proposal = ledger.proposals.find(item => item.id === id);
    if (!proposal) throw new Error('Proposta não encontrada.');
    if (proposal.appliedAt) throw new Error('Proposta já aplicada.');
    if (proposal.revision !== revision || proposal.hash !== hash) throw new Error('Hash ou revisão da proposta divergente.');
    if (Date.parse(proposal.expiresAt) <= Date.now()) throw new Error('Proposta expirada.');
    const input = proposal.input;
    if (input.operation === 'correct') {
      const target = ledger.observations.find(item => item.id === input.observationId);
      if (!target || target.revision !== input.expectedRevision) throw new Error('Conflito de revisão: proposta desatualizada.');
    }
    if (input.operation === 'context' && (ledger.context?.revision || 0) !== input.expectedRevision) throw new Error('Conflito de revisão: proposta desatualizada.');
    proposal.approvedAt = new Date().toISOString(); proposal.approvedBy = actor.id;
    return proposal;
  });
}
export async function applyHealthChange(id: string, idempotencyKey: string, actor: HealthActor) {
  if (idempotencyKey.length < 8 || idempotencyKey.length > 200) throw new Error('Chave de idempotência inválida.');
  return transactHealthLedger(ledger => {
    const prior = receipt(ledger, actor, idempotencyKey, 'apply', { id });
    if (prior) return prior.resultId === 'health-context' ? ledger.context! : ledger.observations.find(item => item.id === prior.resultId)!;
    const proposal = ledger.proposals.find(item => item.id === id);
    if (!proposal) throw new Error('Proposta não encontrada.');
    if (proposal.actor !== actor.id && !actor.human) throw new Error('Proposta pertence a outro ator.');
    if (!proposal.approvedAt || !proposal.approvedBy) throw new Error('Proposta sem aprovação humana.');
    if (Date.parse(proposal.expiresAt) <= Date.now()) throw new Error('Proposta expirada.');
    if (proposal.hash !== healthFingerprint({ ...proposal.input, idempotencyKey: undefined })) throw new Error('Payload da proposta alterado.');
    if (proposal.appliedAt) throw new Error('Proposta já aplicada; consulte o recibo original.');
    const input = proposal.input;
    const entry = input.operation === 'record'
      ? createObservation(ledger, input.observation, actor, input.idempotencyKey)
      : input.operation === 'correct'
        ? reviseObservation(ledger, input.observationId, input.expectedRevision, input.observation, input.reason, actor)
        : writeContext(ledger, input.context, input.expectedRevision, actor);
    proposal.appliedAt = new Date().toISOString(); proposal.resultId = entry.id;
    remember(ledger, actor, idempotencyKey, 'apply', { id }, entry.id);
    return entry;
  });
}
export async function getHealthReceipt(key: string, actor: HealthActor) {
  return (await readHealthLedger()).receipts.find(item => item.actor === actor.id && item.key === key) || null;
}
export async function listHealthProposals() { return (await readHealthLedger()).proposals.filter(item => !item.appliedAt && Date.parse(item.expiresAt) > Date.now()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
function localDate(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const pick = (type: string) => parts.find(part => part.type === type)?.value || '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}
export async function listHealthObservations(filters: { type?: string; indicatorId?: string; from?: string; to?: string; cursor?: string; limit?: number; id?: string } = {}) {
  const limit = Math.min(Math.max(filters.limit || 30, 1), 100);
  let items = (await readHealthLedger()).observations.filter(item => (!filters.id || item.id === filters.id) && (!filters.type || item.data.type === filters.type) && (!filters.indicatorId || item.data.indicatorId === filters.indicatorId) && (!filters.from || localDate(item.observedAt, item.data.timezone) >= filters.from) && (!filters.to || localDate(item.observedAt, item.data.timezone) <= filters.to));
  items = items.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || b.id.localeCompare(a.id));
  if (filters.cursor) {
    const position = items.findIndex(item => item.id === filters.cursor);
    if (position < 0) throw new Error('Cursor inválido ou fora dos filtros.');
    items = items.slice(position + 1);
  }
  return { items: items.slice(0, limit), nextCursor: items.length > limit ? items[limit - 1].id : null };
}
export async function getHealthSummary(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) throw new Error('Período inválido.');
  const observations = (await readHealthLedger()).observations.filter(item => localDate(item.observedAt, item.data.timezone) >= from && localDate(item.observedAt, item.data.timezone) <= to);
  const counts: Record<'sleep' | 'weight' | 'water' | 'meal' | 'movement' | 'energy' | 'stress', number> = { sleep: 0, weight: 0, water: 0, meal: 0, movement: 0, energy: 0, stress: 0 };
  let waterMl = 0; const energy: number[] = []; const stress: number[] = []; const weights: number[] = [];
  const intervals: [number, number][] = [];
  for (const item of observations) {
    const data = item.data; counts[data.type]++;
    if (data.type === 'water') waterMl += data.ml;
    if (data.type === 'energy') energy.push(data.score);
    if (data.type === 'stress') stress.push(data.score);
    if (data.type === 'weight') weights.push(data.kg);
    if (data.type === 'sleep' && data.startedAt && data.endedAt) intervals.push([Date.parse(data.startedAt), Date.parse(data.endedAt)]);
  }
  intervals.sort((a, b) => a[0] - b[0]);
  let sleepMinutes = 0, end = -Infinity;
  for (const [start, finish] of intervals) { sleepMinutes += Math.max(0, finish - Math.max(start, end)) / 60_000; end = Math.max(end, finish); }
  const average = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  return { from, to, counts, observations: observations.length, waterMl, sleepMinutes, averageEnergy: average(energy), averageStress: average(stress), averageWeightKg: average(weights), coverage: { observedDays: new Set(observations.map(item => localDate(item.observedAt, item.data.timezone))).size, missingMeansUnknown: true }, source: 'reported-observations' as const };
}
export async function getHealthContext() {
  const context = (await readHealthLedger()).context || emptyContext();
  const data = context.data;
  const unknown = ['profile', 'limitations', 'equipment'].filter(key => data[key as 'profile' | 'limitations' | 'equipment'] === null);
  if (data.objectives.length === 0) unknown.push('objectives');
  if (data.preferences.length === 0) unknown.push('preferences');
  if (data.routines.length === 0) unknown.push('routines');
  if (data.healthPillarIds.length === 0) unknown.push('healthPillarIds');
  return { ...context, unknown };
}

function localClock(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  const pick = (type: string) => Number(parts.find(part => part.type === type)?.value || 0);
  return pick('hour') * 60 + pick('minute');
}
export async function getHealthDailyBrief(date: string, timezone: string, dependencies: { calendar?: (from: string, to: string) => Promise<GoogleCalendarEvent[]> } = {}) {
  if (!z.iso.date().safeParse(date).success) throw new Error('Data inválida.');
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { throw new Error('Fuso inválido.'); }
  const context = await getHealthContext();
  const [observations, summary, allTasks, configs, indicators, pending] = await Promise.all([
    listHealthObservations({ from: date, to: date, limit: 100 }),
    getHealthSummary(date, date),
    storage.getAll<Task>('tasks'), storage.getAll<StageConfig>('stage-configs'),
    storage.getAll<Indicator>('indicators'), listHealthProposals(),
  ]);
  const terminal = new Set((configs.find(item => item.scope === 'tasks')?.stages || DEFAULT_STAGES.tasks).filter(stage => stage.isTerminal).map(stage => stage.id));
  const allowed = new Set(context.data.healthPillarIds);
  const tasks = allowed.size ? allTasks.filter(task => task.pillarId && allowed.has(task.pillarId) && !terminal.has(task.status) && (task.dueDate === date || task.planning?.date === date)).map(task => ({ id: task.id, title: task.title, dueDate: task.dueDate || null, plannedStartAt: task.planning?.startAt || null, status: task.status })) : [];
  const goals = indicators.filter(item => allowed.has(item.pillarId) && item.targetValue !== undefined).map(item => ({ id: item.id, pillarId: item.pillarId, name: item.name, targetValue: item.targetValue, unit: item.unit || null, frequency: item.frequency, source: 'configured-target' as const }));
  const pendingConfirmations = pending.map(item => ({ id: item.id, operation: item.input.operation, expiresAt: item.expiresAt, approved: Boolean(item.approvedAt) }));
  let calendar: { status: 'verified' | 'unavailable'; freeWindows: { start: string; end: string }[] | null; busyBlocks: number | null };
  try {
    const center = Date.parse(`${date}T00:00:00Z`);
    const events = await (dependencies.calendar || listGoogleCalendarEvents)(new Date(center - 86_400_000).toISOString(), new Date(center + 2 * 86_400_000).toISOString());
    const busy = events.filter(event => !event.allDay && event.busy !== false && localDate(event.start, timezone) <= date && localDate(event.end, timezone) >= date).map(event => ({ start: localDate(event.start, timezone) < date ? 0 : localClock(event.start, timezone), end: localDate(event.end, timezone) > date ? 1440 : localClock(event.end, timezone) })).filter(item => item.end > item.start);
    calendar = { status: 'verified', freeWindows: freeIntervals(busy, 8 * 60, 20 * 60).map(item => ({ start: clockLabel(item.start), end: clockLabel(item.end) })), busyBlocks: busy.length };
  } catch { calendar = { status: 'unavailable', freeWindows: null, busyBlocks: null }; }
  return { date, timezone, context: { objectives: context.data.objectives, preferences: context.data.preferences, routines: context.data.routines, reviewedAt: context.reviewedAt, unknown: context.unknown }, observations, summary, goals, pendingConfirmations, tasks: { status: allowed.size ? 'configured' : 'unconfigured', items: tasks }, calendar };
}
