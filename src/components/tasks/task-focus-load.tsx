'use client';

import { useState } from 'react';
import { ArrowRight, CheckCircle2, Crosshair, ListChecks, Plus } from 'lucide-react';
import type { StageDef } from '@/types';
import { cn } from '@/lib/utils';
import { isTaskCompleted } from '@/lib/task-stages';
import { Button } from '@/components/ui/button';
import { DeadlineCell, type TaskListRecord, type TaskCellPatch } from './task-workspace-table';
import { TaskStructureSummary } from './task-structure-summary';

interface Props {
  allTasks?: TaskListRecord[];
  tasks: TaskListRecord[]; stages: StageDef[]; projects: { id: string; name: string }[]; pillars: { id: string; name: string }[];
  busyIds: Set<string>; onOpen: (id: string) => void; onComplete: (id: string) => void;
  onPatch: (id: string, patch: TaskCellPatch) => Promise<boolean>; onCreate: () => void;
  focusId?: string | null;
}
const priorityLabels = { urgent: 'Urgente', important: 'Importante', normal: 'Normal' };
function formatDay(date: string) { return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR'); }

export function TaskFocus(props: Props) {
  const { stages, busyIds, onOpen, onComplete, onPatch } = props;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queue = props.tasks.filter(task => !isTaskCompleted(task, stages));
  const task = queue.find(item => item.id === (selectedId ?? props.focusId)) || queue[0];
  const index = task ? queue.findIndex(item => item.id === task.id) : -1;
  const busy = task && busyIds.has(task.id);
  const checks = task?.checklist || [];
  const checked = checks.filter(item => item.done).length;
  return <div className="task-focus-view">
    <header className="task-date-heading"><div><p className="task-eyebrow">Uma coisa de cada vez</p><h2>Foco de execução</h2><p>A fila respeita os filtros e a ordenação atuais. Só tarefas em aberto.</p></div><span className="task-focus-count">{queue.length}<small>na fila</small></span></header>
    {!task ? <section className="task-date-empty"><Crosshair className="h-7 w-7" /><p>Nenhuma tarefa em aberto nesta seleção.</p><Button variant="outline" onClick={props.onCreate}><Plus className="h-4 w-4" />Criar tarefa</Button></section> : <div className="task-focus-layout">
      <section className="task-focus-stage" aria-label="Tarefa em foco">
        <div className="task-focus-topline"><span><Crosshair className="h-4 w-4" />Em foco · {index + 1} de {queue.length}</span><span className={`task-priority-${task.priority}`}>{priorityLabels[task.priority]}</span></div>
        <button type="button" className="task-focus-title" disabled={busy} onClick={() => onOpen(task.id)}>{task.title}</button>
        <p className="task-focus-hint">O título abre os detalhes. A conclusão fica no botão abaixo.</p>
        <TaskStructureSummary task={task} tasks={props.allTasks || props.tasks} stages={stages} onOpen={onOpen} />
        <div className="task-focus-context"><span>{stages.find(stage => stage.id === task.status)?.label || task.status}</span>{task.projectId && <span>{props.projects.find(project => project.id === task.projectId)?.name || 'Projeto indisponível'}</span>}{task.pillarId && <span>{props.pillars.find(pillar => pillar.id === task.pillarId)?.name || 'Pilar indisponível'}</span>}<DeadlineCell task={task} busy={Boolean(busy)} completed={false} onPatch={onPatch} /></div>
        {task.nextAction && <div className="task-focus-next"><ArrowRight className="h-4 w-4" /><div><small>Próxima ação</small><p>{task.nextAction}</p></div></div>}
        {task.description && <p className="task-focus-description">{task.description}</p>}
        {task.responsible && <p className="text-xs text-muted-foreground">Responsável: {task.responsible}</p>}
        <div className="task-focus-checks"><div><h3><ListChecks className="h-4 w-4" />Passos da tarefa</h3><span>{checked}/{checks.length}</span></div><progress aria-label="Progresso do checklist" max={Math.max(checks.length, 1)} value={checked} />{checks.length ? checks.map(item => <label key={item.id} className={cn('task-focus-check', item.done && 'task-date-completed')}><input type="checkbox" checked={item.done} disabled={busy} onChange={() => void onPatch(task.id, { checklist: checks.map(check => check.id === item.id ? { ...check, done: !check.done } : check) })} /><span>{item.text}</span></label>) : <p className="text-sm text-muted-foreground">Divida a tarefa em passos pelo editor.</p>}</div>
        <footer className="task-focus-actions"><Button disabled={busy} onClick={() => onComplete(task.id)} aria-label="Concluir tarefa em foco"><CheckCircle2 className="h-4 w-4" />Concluir tarefa</Button><Button variant="outline" disabled={busy} onClick={() => onOpen(task.id)}>Editar detalhes</Button><Button variant="ghost" disabled={Boolean(busy) || queue.length < 2} onClick={() => setSelectedId(queue[(index + 1) % queue.length].id)}>Outra da fila<ArrowRight className="h-4 w-4" /></Button></footer>
      </section>
      <aside className="task-focus-queue" aria-label="Fila de foco"><h3>Na sequência<span>{queue.length}</span></h3><p>Escolher uma tarefa mantém seu status.</p><div>{queue.map((item, position) => <button type="button" key={item.id} disabled={busyIds.has(item.id)} className={cn('task-focus-queue-item', item.id === task.id && 'is-current')} aria-label={`Focar ${item.title}`} aria-pressed={item.id === task.id} onClick={() => setSelectedId(item.id)}><span className="task-focus-order">{String(position + 1).padStart(2, '0')}</span><span><strong>{item.title}</strong><small>{priorityLabels[item.priority]} · {item.dueDate ? formatDay(item.dueDate) : 'Sem prazo'}</small></span></button>)}</div></aside>
    </div>}
  </div>;
}
