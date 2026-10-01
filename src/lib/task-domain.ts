import type { StageConfig, Task } from '@/types';
import { storage } from '@/lib/storage';
import { taskPayloadSchema } from '@/lib/validation';
import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import { nextDueDate } from '@/lib/recurring';
import { isTaskCompleted, resolveTaskStages, taskReopenStatus } from '@/lib/task-stages';

export const taskUpdateSchema = taskPayloadSchema.partial().extend({
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

/** Backfill tasks planned before planning day and deadline were unified. */
export async function reconcilePlannedTaskDeadlines(): Promise<Task[]> {
  const snapshot = await storage.getAll<Task>('tasks');
  if (!snapshot.some(task => task.planning?.date && task.dueDate !== task.planning.date)) return snapshot;
  return storage.transact<Task, Task[]>('tasks', tasks => {
    for (const task of tasks) {
      if (task.planning?.date && task.dueDate !== task.planning.date) Object.assign(task, { dueDate: task.planning.date, updatedAt: new Date().toISOString() });
    }
    return tasks;
  });
}

export async function prepareTaskUpdate(input: z.infer<typeof taskUpdateSchema>, existing?: Task | null): Promise<Partial<Task>> {
  const { dueDate, parentId, estimatedMinutes, ...data } = input;
  const body: Partial<Task> = {
    ...data,
    ...(dueDate !== undefined ? { dueDate: dueDate ?? undefined } : {}),
    ...(parentId !== undefined ? { parentId: parentId ?? undefined } : {}),
    ...(estimatedMinutes !== undefined ? { estimatedMinutes: estimatedMinutes ?? undefined } : {}),
  };

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
    if (terminal && !body.completedAt) {
      const stages = resolveTaskStages(matches[0]?.stages || [], existing ? [existing] : []);
      body.completedAt = existing && isTaskCompleted(existing, stages) && existing.completedAt ? existing.completedAt : new Date().toISOString();
    }
    else if (!terminal) body.completedAt = undefined;
  }
  return body;
}

function validateTaskLinks(task: Task, items: Task[], checkCompletion: boolean, stages: ReturnType<typeof resolveTaskStages>) {
  const byId = new Map(items.map(item => [item.id, item]));
  for (const id of [task.parentId, ...(task.dependsOnIds || [])].filter(Boolean) as string[]) {
    if (id === task.id) throw new Error('Uma tarefa não pode apontar para si própria.');
    if (!byId.has(id)) throw new Error('Tarefa vinculada não encontrada. Releia os vínculos.');
  }
  // Traverse only the edited node. Unrelated legacy records stay intact.
  for (const relation of ['parent', 'dependency', 'completion'] as const) {
    const visiting = new Set<string>(), visited = new Set<string>();
    function visit(id: string) {
      if (visiting.has(id)) throw new Error('Este vínculo criaria um ciclo entre tarefas.');
      if (visited.has(id)) return;
      visiting.add(id);
      const item = byId.get(id);
      const links = relation === 'parent' ? (item?.parentId ? [item.parentId] : []) : [
        ...(item?.dependsOnIds || []), ...(relation === 'completion' ? items.filter(child => child.parentId === id).map(child => child.id) : []),
      ];
      links.forEach(visit); visiting.delete(id); visited.add(id);
    }
    visit(task.id);
  }
  if (checkCompletion && isTaskCompleted(task, stages)) {
    if ((task.dependsOnIds || []).some(id => !isTaskCompleted(byId.get(id)!, stages))) throw new Error('Conclua as dependências antes de concluir esta tarefa.');
    if (items.some(item => item.parentId === task.id && !isTaskCompleted(item, stages))) throw new Error('Conclua ou desvincule as subtarefas antes de concluir a tarefa principal.');
  }
}

/** Creates a whole REST batch or a stable MCP identity in one collection commit. */
export async function createTaskRecords(inputs: z.infer<typeof taskPayloadSchema>[], ids?: string[]): Promise<Task[]> {
  const config = (await storage.query<StageConfig>('stage-configs', { scope: 'tasks' }))[0];
  return storage.transact<Task, Task[]>('tasks', async items => {
    const created: Task[] = [];
    const fresh: Task[] = [];
    for (let index = 0; index < inputs.length; index++) {
      const input = taskPayloadSchema.parse(inputs[index]);
      const id = ids?.[index] || randomUUID();
      const existing = items.find(task => task.id === id);
      if (existing) { created.push(existing); continue; }
      const payload = await prepareTaskUpdate(input);
      const now = new Date().toISOString();
      const task: Task = { ...payload, id, createdAt: now, updatedAt: now, title: input.title || 'Sem título', status: input.status || 'todo', priority: input.priority || 'normal', tags: input.tags || [], checklist: input.checklist || [], sortOrder: input.sortOrder || 0 };
      items.push(task); created.push(task); fresh.push(task);
    }
    const stages = resolveTaskStages(config?.stages || [], items);
    for (const task of fresh) validateTaskLinks(task, items, true, stages);
    return created;
  });
}

function nextOccurrence(items: Task[], source: Task, stages: ReturnType<typeof resolveTaskStages>): Task {
  const nextId = source.nextOccurrenceId || `recurrence-${createHash('sha256').update(source.id).digest('hex')}`;
  const existing = items.find(task => task.id === nextId);
  if (existing) return existing;
  if (source.nextOccurrenceId) throw new Error('A próxima ocorrência foi excluída; ela não será recriada automaticamente.');
  if (!source.recurring || !source.recurringFrequency) throw new Error('Esta tarefa não é recorrente.');
  if (!isTaskCompleted(source, stages)) throw new Error('Esta tarefa ainda não foi concluída.');
  const now = new Date().toISOString();
  const date = source.dueDate || new Intl.DateTimeFormat('en-CA', { timeZone: source.planning?.timeZone || 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(source.completedAt || now));
  const next: Task = {
    id: nextId, createdAt: now, updatedAt: now, title: source.title,
    description: source.description, priority: source.priority, status: taskReopenStatus(stages),
    projectId: source.projectId, pillarId: source.pillarId, tags: [...source.tags], checklist: [], sortOrder: 0,
    recurring: true, recurringFrequency: source.recurringFrequency,
    dueDate: nextDueDate(date, source.recurringFrequency), recurrenceSourceId: source.id,
    workType: source.workType, responsible: source.responsible, nextAction: source.nextAction,
    // Each next occurrence is independent: do not reopen a completed parent's tree.
    estimatedMinutes: source.estimatedMinutes,
  };
  source.nextOccurrenceId = nextId;
  items.push(next);
  return next;
}

/** One transaction commits the source pointer and its successor, surviving retries/restarts. */
export async function spawnNextTaskOccurrence(id: string): Promise<Task> {
  const config = (await storage.query<StageConfig>('stage-configs', { scope: 'tasks' }))[0];
  return storage.transact<Task, Task>('tasks', items => {
    const source = items.find(task => task.id === id);
    if (!source) throw new Error('Tarefa não encontrada.');
    return nextOccurrence(items, source, resolveTaskStages(config?.stages || [], items));
  });
}

/** REST and MCP completion use the same atomic recurrence operation. */
export async function updateTaskRecord(id: string, input: z.infer<typeof taskUpdateSchema>, expectedUpdatedAt?: string): Promise<Task | null> {
  const result = await updateTaskRecords([id], input, expectedUpdatedAt);
  return result[0] || null;
}

export async function updateTaskRecords(ids: string[], input: z.infer<typeof taskUpdateSchema>, expectedUpdatedAt?: string): Promise<Task[]> {
  return storage.transact<Task, Task[]>('tasks', async items => {
    const selected = items.filter(item => ids.includes(item.id));
    const config = (await storage.query<StageConfig>('stage-configs', { scope: 'tasks' }))[0];
    const stages = resolveTaskStages(config?.stages || [], items);
    for (const task of selected) {
      if (expectedUpdatedAt && task.updatedAt !== expectedUpdatedAt) throw new Error('Conflito de versão. Releia o registro antes de alterar.');
      const payload = await prepareTaskUpdate(input, task);
      Object.assign(task, payload, { updatedAt: new Date().toISOString() });
    }
    for (const task of selected) {
      if (input.parentId !== undefined || input.dependsOnIds !== undefined || input.status !== undefined) validateTaskLinks(task, items, input.status !== undefined, stages);
    }
    for (const task of selected) {
      if (input.status !== undefined && task.recurring && task.recurringFrequency && task.completedAt && !task.nextOccurrenceId && isTaskCompleted(task, stages)) nextOccurrence(items, task, stages);
    }
    return selected;
  });
}
