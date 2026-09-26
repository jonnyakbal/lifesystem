import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { storage } from './storage';
import type { Task, TaskPlanning } from '@/types';
import { deleteManagedTaskEvent, GoogleCalendarError, readManagedTaskEvent, syncManagedTaskEvent } from './google-calendar';

export const planningSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const date = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Dia inválido.'),
  startAt: z.string().datetime({ offset: true }).optional(),
  endAt: z.string().datetime({ offset: true }).optional(),
  timeZone: z.string().max(100).refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }, 'Fuso inválido.'),
  syncToGoogle: z.boolean(),
}).strict().superRefine((value, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (Boolean(value.startAt) !== Boolean(value.endAt)) issue('Informe início e fim do bloco.');
  if (value.syncToGoogle && !value.startAt) issue('Reserve um horário antes de espelhar no Google.');
  if (value.startAt && value.endAt) {
    const duration = Date.parse(value.endAt) - Date.parse(value.startAt);
    if (duration <= 0 || duration > 24 * 3600000) issue('O bloco deve durar entre 1 minuto e 24 horas.');
    if (duration < 60000) issue('O bloco deve durar pelo menos um minuto.');
    try {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: value.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value.startAt));
      const part = (type: string) => parts.find(p => p.type === type)?.value;
      if (`${part('year')}-${part('month')}-${part('day')}` !== value.date) issue('O horário deve começar no dia escolhido.');
    } catch { issue('Horário ou fuso inválido.'); }
  }
});

const locks = new Map<string, Promise<void>>();
export async function withTaskPlanningLock<T>(id: string, operation: () => Promise<T>): Promise<T> {
  const previous = locks.get(id) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>(resolve => { release = resolve; });
  const queued = previous.then(() => current); locks.set(id, queued);
  await previous;
  try { return await operation(); }
  finally { release(); if (locks.get(id) === queued) locks.delete(id); }
}

export async function saveTaskPlanning(id: string, raw: unknown): Promise<Task> {
  const input = planningSchema.parse(raw);
  return withTaskPlanningLock(id, async () => {
    const task = await storage.getById<Task>('tasks', id);
    if (!task) throw new Error('Tarefa não encontrada.');
    if (task.planning?.eventId && !input.syncToGoogle) throw new Error('Remova o bloco espelhado antes de desligar o Google.');
    const planning: TaskPlanning = {
      ...input, syncState: input.syncToGoogle ? 'pending' : 'local',
      ...(input.syncToGoogle ? {
        calendarId: 'primary', eventId: task.planning?.eventId || randomBytes(16).toString('hex'),
        etag: task.planning?.etag, eventUrl: task.planning?.eventUrl, lastSyncedAt: task.planning?.lastSyncedAt,
        lastAttempt: task.planning?.lastAttempt,
      } : {}),
    };
    // Persist the intention and stable event ID before crossing the network boundary.
    const saved = await storage.update<Task>('tasks', id, { planning });
    if (!saved) throw new Error('Tarefa não encontrada.');
    if (!input.syncToGoogle) return saved;
    try {
      const event = await syncManagedTaskEvent({ taskId: id, eventId: planning.eventId!, etag: planning.etag, title: task.title, startAt: input.startAt!, endAt: input.endAt!, timeZone: input.timeZone,
        lastAttempt: planning.lastAttempt,
        beforeWrite: async (description) => {
          planning.lastAttempt = { title: task.title, startAt: input.startAt!, endAt: input.endAt!, description };
          if (!await storage.update<Task>('tasks', id, { planning })) throw new Error('Tarefa removida.');
        },
      });
      planning.etag = event.etag;
      planning.eventUrl = event.htmlLink?.startsWith('https://') ? event.htmlLink : undefined;
      planning.syncState = 'synced'; planning.lastSyncedAt = new Date().toISOString();
    } catch (error) {
      planning.syncState = 'error';
      planning.syncError = error instanceof GoogleCalendarError ? error.message : 'Google indisponível. O planejamento foi salvo; tente sincronizar novamente.';
    }
    const updated = await storage.update<Task>('tasks', id, { planning });
    if (!updated) throw new Error('Tarefa removida durante a sincronização. Verifique o evento no Google.');
    return updated;
  });
}

export async function removeTaskPlanning(id: string, removeGoogleEvent: boolean): Promise<Task> {
  return withTaskPlanningLock(id, async () => {
    const task = await storage.getById<Task>('tasks', id);
    if (!task) throw new Error('Tarefa não encontrada.');
    if (task.planning?.eventId) {
      if (!removeGoogleEvent) throw new Error('Confirme a remoção do evento espelhado.');
      await deleteManagedTaskEvent(id, task.planning.eventId, task.planning.etag);
    }
    const updated = await storage.update<Task>('tasks', id, { planning: { date: null, timeZone: task.planning?.timeZone || 'America/Sao_Paulo', syncToGoogle: false, syncState: 'local' } });
    if (!updated) throw new Error('Tarefa não encontrada.');
    return updated;
  });
}

export async function adoptTaskGoogleEvent(id: string): Promise<Task> {
  return withTaskPlanningLock(id, async () => {
    const task = await storage.getById<Task>('tasks', id);
    if (!task?.planning?.eventId) throw new Error('Esta tarefa não tem evento espelhado.');
    const event = await readManagedTaskEvent(id, task.planning.eventId);
    const startAt = event.start?.dateTime; const endAt = event.end?.dateTime;
    if (!startAt || !endAt) throw new Error('O evento precisa ter início e fim com horário.');
    const timeZone = task.planning.timeZone;
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(startAt));
    const part = (type: string) => parts.find(p => p.type === type)?.value;
    const input = planningSchema.parse({ date: `${part('year')}-${part('month')}-${part('day')}`, startAt, endAt, timeZone, syncToGoogle: true });
    const title = event.summary?.trim().slice(0, 300) || task.title;
    const planning: TaskPlanning = { ...task.planning, ...input, etag: event.etag, syncState: 'synced', syncError: undefined, lastAttempt: undefined, lastSyncedAt: new Date().toISOString() };
    const updated = await storage.update<Task>('tasks', id, { title, planning });
    if (!updated) throw new Error('Tarefa não encontrada.');
    return updated;
  });
}
