'use client';

import type { StageDef } from '@/types';
import { isTaskCompleted } from '@/lib/task-stages';
import type { TaskListRecord } from './task-workspace-table';

export function TaskStructureSummary({ task, tasks, stages, onOpen }: {
  task: TaskListRecord; tasks: TaskListRecord[]; stages: StageDef[]; onOpen: (id: string) => void;
}) {
  const children = tasks.filter(item => item.parentId === task.id);
  const pending = (task.dependsOnIds || []).filter(id => { const dependency = tasks.find(item => item.id === id); return !dependency || !isTaskCompleted(dependency, stages); });
  if (!task.parentId && !children.length && !pending.length && !task.estimatedMinutes) return null;
  return <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground" aria-label={`Estrutura de ${task.title}`}>
    {task.parentId && <button type="button" className="text-primary underline underline-offset-2" onClick={() => onOpen(task.parentId!)}>↳ {tasks.find(item => item.id === task.parentId)?.title || 'Tarefa principal indisponível'}</button>}
    {children.length > 0 && <button type="button" className="text-primary" onClick={() => onOpen(task.id)}>{children.filter(item => isTaskCompleted(item, stages)).length}/{children.length} subtarefas</button>}
    {pending.length > 0 && <button type="button" className="text-amber-500" onClick={() => onOpen(task.id)}>{pending.length} dependências em aberto</button>}
    {task.estimatedMinutes && <span>{task.estimatedMinutes} min previstos</span>}
  </div>;
}
