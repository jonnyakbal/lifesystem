import { DEFAULT_STAGES } from '@/lib/default-stages';
import type { StageDef } from '@/types';

type TaskState = { status: string; completedAt?: string };
export type ResolvedTaskStage = StageDef & { historical?: boolean };

/** Keep historical stages visible without changing stored records. */
export function resolveTaskStages(configured: StageDef[], tasks: TaskState[]): ResolvedTaskStage[] {
  const stages: ResolvedTaskStage[] = [...(configured.length ? configured : DEFAULT_STAGES.tasks)];
  for (const task of tasks) {
    if (stages.some(stage => stage.id === task.status)) continue;
    stages.push({ id: task.status, label: `Etapa anterior: ${task.status}`, color: 'text-muted-foreground', dot: 'bg-muted-foreground', historical: true });
  }
  return stages;
}

export function isTaskCompleted(task: TaskState, stages: ResolvedTaskStage[]): boolean {
  const stage = stages.find(item => item.id === task.status);
  return stage && !stage.historical ? !!stage.isTerminal : task.status === 'done' || !!task.completedAt;
}

export function taskCompletionStatus(stages: ResolvedTaskStage[]): string {
  return stages.find(stage => !stage.historical && stage.isTerminal)?.id || 'done';
}

export function taskReopenStatus(stages: ResolvedTaskStage[]): string {
  return stages.find(stage => !stage.historical && !stage.isTerminal)?.id || 'todo';
}
