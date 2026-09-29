import type { StageConfig, Task } from '@/types';
import { storage } from '@/lib/storage';
import { taskPayloadSchema } from '@/lib/validation';
import { z } from 'zod';

export const taskUpdateSchema = taskPayloadSchema.partial().extend({
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

/** Backfill tasks planned before planning day and deadline were unified. */
export async function reconcilePlannedTaskDeadlines(): Promise<Task[]> {
  const tasks = await storage.getAll<Task>('tasks');
  const mismatched = tasks.filter(task => task.planning?.date && task.dueDate !== task.planning.date);
  const updated = await Promise.all(mismatched.map(task =>
    storage.update<Task>('tasks', task.id, { dueDate: task.planning!.date! })
  ));
  const byId = new Map(updated.filter((task): task is Task => task !== null).map(task => [task.id, task]));
  return tasks.map(task => byId.get(task.id) || task);
}

export async function prepareTaskUpdate(input: z.infer<typeof taskUpdateSchema>, existing?: Task | null): Promise<Partial<Task>> {
  const { dueDate, ...data } = input;
  const body: Partial<Task> = dueDate === null
    ? { ...data, dueDate: undefined }
    : { ...data, ...(dueDate !== undefined ? { dueDate } : {}) };

  if (dueDate !== undefined && existing?.planning?.date && dueDate !== existing.planning.date) {
    if (existing.planning.startAt) {
      throw new Error('Esta tarefa tem um bloco de horário. Mova o dia em Planejar para atualizar o bloco e o Google Agenda.');
    }
    body.planning = { ...existing.planning, date: dueDate };
  }

  if (body.status !== undefined) {
    const matches = await storage.query<StageConfig>('stage-configs', { scope: 'tasks' });
    const stage = matches[0]?.stages.find(item => item.id === body.status);
    const terminal = stage ? Boolean(stage.isTerminal) : body.status === 'done';
    if (terminal && !body.completedAt) body.completedAt = new Date().toISOString();
    else if (!terminal) body.completedAt = undefined;
  }
  return body;
}
