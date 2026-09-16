import { z } from 'zod';
import { storage } from '@/lib/storage';
import { financialEntrySchema } from '@/lib/financial-validation';
import { createGoogleCalendarEvent } from '@/lib/google-calendar';
import type { Capture } from '@/types';

export const captureConversionSchema = z.object({
  targetType: z.enum(['note', 'task', 'content', 'financial', 'event', 'project', 'edital']),
  financial: financialEntrySchema.optional(),
  event: z.object({ start: z.string().datetime(), end: z.string().datetime(), timeZone: z.string().optional() }).optional(),
});


export async function convertCapture(id: string, input: z.infer<typeof captureConversionSchema>) {
  const capture = await storage.getById<Capture>('captures', id);
  if (!capture) throw new Error('Captura não encontrada');
  const { targetType, financial } = input;
  if (targetType === 'financial' && !financial) throw new Error('Informe valor, categoria, tipo e data.');
  if (targetType === 'event' && !input.event) throw new Error('Informe início e fim do evento.');
  const title = capture.title?.trim() || capture.content.replace(/<[^>]*>/g, ' ').trim().split('\n')[0].slice(0, 300) || 'Sem título';
  const description = capture.content;
  if (targetType === 'event') {
    const event = await createGoogleCalendarEvent({ title, description, ...input.event! });
    return storage.convertCapture(id, 'event', 'google-events', { eventId: event.id, url: event.url, title, start: input.event!.start, end: input.event!.end }, event.id);
  }
  const destinations: Record<Exclude<typeof targetType, 'event'>, { collection: string; data: Record<string, unknown> }> = {
    note: { collection: 'captures', data: {} },
    task: { collection: 'tasks', data: { title, description, priority: 'normal', status: 'todo', sortOrder: 0, tags: [], checklist: [] } },
    project: { collection: 'projects', data: { name: title, description, status: 'idea', tags: [], needs: '', links: [], tasksCount: 0, tasksDone: 0 } },
    content: { collection: 'content', data: { title, body: description, channel: 'blog', stage: 'idea', category: 'Geral', format: '', tags: [], status: 'draft', pinned: false, checklist: [], linkedTaskIds: [], linkedProjectIds: [] } },
    edital: { collection: 'editais', data: { title, description, stage: 'radar' } },
    financial: { collection: 'financial', data: { ...financial, description: financial?.description || title, tags: financial?.tags || [], status: financial?.status || 'pending' } },
  };
  const destination = destinations[targetType];
  return storage.convertCapture(id, targetType, destination.collection, destination.data);
}
