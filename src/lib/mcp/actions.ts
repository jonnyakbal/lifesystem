import { z } from 'zod';
import { convertCapture, captureConversionSchema } from '@/lib/capture-conversion';
import { adoptTaskGoogleEvent, planningSchema, removeTaskPlanning, saveTaskPlanning } from '@/lib/task-planning';
import { canUseMcpTool } from './auth';

export const convertCaptureActionSchema = captureConversionSchema.extend({
  captureId: z.string().min(1),
}).strict();

export const taskPlanningActionSchema = planningSchema.extend({
  taskId: z.string().min(1),
}).strict();

export async function convertCaptureAction(raw: unknown, scopes: string[] = ['*']) {
  const { captureId, ...input } = convertCaptureActionSchema.parse(raw);
  const destination = { note: 'update_capture', task: 'create_task', content: 'create_content', financial: 'create_financial_entry', event: 'create_managed_calendar_event', project: 'create_project', edital: 'create_edital' }[input.targetType];
  if (!canUseMcpTool('convert_capture', scopes) || !canUseMcpTool(destination, scopes)) throw new Error('Permissão de escrita no domínio de destino necessária para converter a captura.');
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
