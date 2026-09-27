import { z } from 'zod';
import { convertCapture, captureConversionSchema } from '@/lib/capture-conversion';
import { adoptTaskGoogleEvent, planningSchema, removeTaskPlanning, saveTaskPlanning } from '@/lib/task-planning';

export const convertCaptureActionSchema = captureConversionSchema.extend({
  captureId: z.string().min(1),
}).strict();

export const taskPlanningActionSchema = planningSchema.extend({
  taskId: z.string().min(1),
}).strict();

export async function convertCaptureAction(raw: unknown) {
  const { captureId, ...input } = convertCaptureActionSchema.parse(raw);
  return convertCapture(captureId, input);
}

export async function planTaskBlockAction(raw: unknown) {
  const { taskId, ...input } = taskPlanningActionSchema.parse(raw);
  return saveTaskPlanning(taskId, input);
}

export async function removeTaskBlockAction(taskId: string) {
  return removeTaskPlanning(taskId, true);
}

export async function adoptTaskCalendarEventAction(taskId: string) {
  return adoptTaskGoogleEvent(taskId);
}
