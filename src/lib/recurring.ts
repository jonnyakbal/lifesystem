import { apiFetch } from './api';

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly';

export const RECURRING_LABELS: Record<RecurringFrequency, string> = {
  daily: 'Diariamente',
  weekly: 'Semanalmente',
  monthly: 'Mensalmente',
};

interface RecurringTaskLike {
  title: string;
  description?: string;
  priority: string;
  projectId?: string;
  pillarId?: string;
  dueDate?: string;
  tags?: string[];
  recurring?: boolean;
  recurringFrequency?: RecurringFrequency;
}

function nextDueDate(current: string | undefined, freq: RecurringFrequency): string {
  const base = current ? new Date(current + 'T12:00:00') : new Date();
  if (freq === 'daily') base.setDate(base.getDate() + 1);
  else if (freq === 'weekly') base.setDate(base.getDate() + 7);
  else base.setMonth(base.getMonth() + 1);
  return base.toISOString().split('T')[0];
}

// Habits (treino, água, sono...) were only trackable as Metas that reset
// manually — nothing regenerated a Task once it was done. Calling this right
// after a recurring task is marked done closes that gap: it creates the next
// occurrence automatically, same title/project/pillar, due date advanced by
// the task's own frequency. A no-op for non-recurring tasks.
export async function spawnNextOccurrenceIfRecurring(task: RecurringTaskLike): Promise<void> {
  if (!task.recurring || !task.recurringFrequency) return;
  await apiFetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: 'todo',
      projectId: task.projectId,
      pillarId: task.pillarId,
      dueDate: nextDueDate(task.dueDate, task.recurringFrequency),
      tags: task.tags || [],
      checklist: [],
      recurring: true,
      recurringFrequency: task.recurringFrequency,
      sortOrder: 0,
    }),
  });
}
