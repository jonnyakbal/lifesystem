import { apiFetch } from './api';

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly';

export const RECURRING_LABELS: Record<RecurringFrequency, string> = {
  daily: 'Diariamente',
  weekly: 'Semanalmente',
  monthly: 'Mensalmente',
};

interface RecurringTaskLike {
  id: string;
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

export function nextDueDate(current: string | undefined, freq: RecurringFrequency): string {
  const base = current ? new Date(current + 'T12:00:00') : new Date();
  if (freq === 'daily') base.setDate(base.getDate() + 1);
  else if (freq === 'weekly') base.setDate(base.getDate() + 7);
  else {
    const originalDay = base.getDate();
    const targetMonth = base.getMonth() + 1;
    base.setDate(1);
    base.setMonth(targetMonth);
    const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    base.setDate(Math.min(originalDay, lastDay));
  }
  return [base.getFullYear(), String(base.getMonth() + 1).padStart(2, '0'), String(base.getDate()).padStart(2, '0')].join('-');
}

// Habits (treino, água, sono...) were only trackable as Metas that reset
// manually — nothing regenerated a Task once it was done. Calling this right
// after a recurring task is marked done closes that gap: it creates the next
// occurrence automatically, same title/project/pillar, due date advanced by
// the task's own frequency. A no-op for non-recurring tasks.
export async function spawnNextOccurrenceIfRecurring<T extends RecurringTaskLike>(task: T, initialStatus = 'todo'): Promise<T | undefined> {
  if (!task.recurring || !task.recurringFrequency) return;
  return apiFetch<T>(`/api/tasks/${task.id}/next-occurrence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initialStatus }),
  });
}
