import type { StageConfig, Task } from '@/types';
import { storage } from '@/lib/storage';
import { taskPayloadSchema } from '@/lib/validation';
import { z } from 'zod';

export const taskUpdateSchema = taskPayloadSchema.partial().extend({
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function prepareTaskUpdate(input: z.infer<typeof taskUpdateSchema>): Promise<Partial<Task>> {
  const { dueDate, ...data } = input;
  const body: Partial<Task> = dueDate === null
    ? { ...data, dueDate: undefined }
    : { ...data, ...(dueDate !== undefined ? { dueDate } : {}) };

  if (body.status !== undefined) {
    const matches = await storage.query<StageConfig>('stage-configs', { scope: 'tasks' });
    const stage = matches[0]?.stages.find(item => item.id === body.status);
    const terminal = stage ? Boolean(stage.isTerminal) : body.status === 'done';
    if (terminal && !body.completedAt) body.completedAt = new Date().toISOString();
    else if (!terminal) body.completedAt = undefined;
  }
  return body;
}
