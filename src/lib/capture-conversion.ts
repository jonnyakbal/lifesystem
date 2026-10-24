import { z } from 'zod';
import { storage } from '@/lib/storage';
import { financialEntrySchema } from '@/lib/financial-validation';
import { createManagedMcpEventId, syncManagedMcpCalendarEvent } from '@/lib/google-calendar';
import { createHash } from 'node:crypto';
import type { Capture, StageConfig } from '@/types';
import { resolveTaskStages, taskCompletionStatus } from '@/lib/task-stages';

export const captureConversionSchema = z.object({
  targetType: z.enum(['note', 'task', 'content', 'financial', 'event', 'project', 'edital']),
  financial: financialEntrySchema.optional(),
  event: z.object({ start: z.string().datetime({ offset: true }), end: z.string().datetime({ offset: true }), timeZone: z.string().optional() }).optional(),
  // Esclarecer (GTD): detalhes opcionais da tarefa decididos na própria caixa de entrada.
  task: z.object({
    title: z.string().trim().min(1).max(300).optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    priority: z.enum(['urgent', 'important', 'normal']).optional(),
    projectId: z.string().max(100).optional(),
    tags: z.array(z.string().max(100)).max(50).optional(),
    waitingFor: z.string().trim().min(1).max(200).optional(),
    doneNow: z.boolean().optional(),
  }).optional(),
});


async function taskFromCapture(title: string, description: string, details: z.infer<typeof captureConversionSchema>['task']) {
  const data: Record<string, unknown> = { title: details?.title || title, description, priority: details?.priority || 'normal', status: 'todo', sortOrder: 0, tags: details?.tags || [], checklist: [] };
  if (details?.dueDate) data.dueDate = details.dueDate;
  if (details?.projectId) data.projectId = details.projectId;
  if (details?.waitingFor) data.waitingFor = details.waitingFor;
  if (details?.doneNow) {
    // Regra dos 2 minutos: feita na hora, nasce concluída na etapa terminal configurada.
    const config = (await storage.query<StageConfig>('stage-configs', { scope: 'tasks' }))[0];
    data.status = taskCompletionStatus(resolveTaskStages(config?.stages || [], []));
    data.completedAt = new Date().toISOString();
  }
  return data;
}

export async function convertCapture(id: string, input: z.infer<typeof captureConversionSchema>) {
  const capture = await storage.getById<Capture>('captures', id);
  if (!capture) throw new Error('Captura não encontrada');
  const { targetType, financial } = input;
  if (capture.targetId && capture.targetType !== 'note') {
    if (capture.targetType !== targetType) throw new Error('Esta captura já foi convertida para outro destino');
    return { id: capture.targetId, targetType };
  }
  if (targetType === 'financial' && !financial) throw new Error('Informe valor, categoria, tipo e data.');
  if (targetType === 'event' && !input.event) throw new Error('Informe início e fim do evento.');
  const title = capture.title?.trim() || capture.content.replace(/<[^>]*>/g, ' ').trim().split('\n')[0].slice(0, 300) || 'Sem título';
  const description = capture.content;
  if (targetType === 'event') {
    const eventId = createManagedMcpEventId('capture-conversion', id);
    const payload = { title, description, ...input.event!, timeZone: input.event!.timeZone || 'America/Sao_Paulo' };
    const fingerprint = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const intent = await storage.createOnce<{ id: string; fingerprint: string }>('capture-calendar-intents', `capture-${id}`, { fingerprint });
    if (intent.fingerprint !== fingerprint) throw new Error('A conversão pendente usa outros horários ou conteúdo. Recupere a intenção original antes de alterar.');
    const event = await syncManagedMcpCalendarEvent({ eventId, clientId: 'capture-conversion', ...payload });
    return storage.convertCapture(id, 'event', 'google-events', { eventId: event.id, url: event.htmlLink, title, start: input.event!.start, end: input.event!.end }, event.id);
  }
  const destinations: Record<Exclude<typeof targetType, 'event'>, { collection: string; data: Record<string, unknown> }> = {
    note: { collection: 'captures', data: {} },
    task: { collection: 'tasks', data: await taskFromCapture(title, description, input.task) },
    project: { collection: 'projects', data: { name: title, description, status: 'idea', tags: [], needs: '', links: [], tasksCount: 0, tasksDone: 0 } },
    content: { collection: 'content', data: { title, body: description, channel: 'blog', stage: 'idea', category: 'Geral', format: '', tags: [], status: 'draft', pinned: false, checklist: [], linkedTaskIds: [], linkedProjectIds: [] } },
    edital: { collection: 'editais', data: { title, description, stage: 'radar' } },
    financial: { collection: 'financial', data: { ...financial, description: financial?.description || title, tags: financial?.tags || [], status: financial?.status || 'pending' } },
  };
  const destination = destinations[targetType];
  return storage.convertCapture(id, targetType, destination.collection, destination.data);
}
