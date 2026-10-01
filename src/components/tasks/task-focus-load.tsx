'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Crosshair, Layers, ListChecks, Plus } from 'lucide-react';
import type { StageDef } from '@/types';
import { cn, todayStr } from '@/lib/utils';
import { isTaskCompleted } from '@/lib/task-stages';
import { calculateWorkload, weekDates } from '@/lib/task-workload';
import { TaskCapacitySettings } from './task-capacity-settings';
import { DEFAULT_PLANNING_PREFERENCES, planningPreferencesSchema, type PlanningPreferences } from '@/lib/planning-preferences';
import { apiFetch, showError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DeadlineCell, type TaskListRecord, type TaskCellPatch } from './task-workspace-table';
import { TaskStructureSummary } from './task-structure-summary';

interface Props {
  allTasks?: TaskListRecord[];
  tasks: TaskListRecord[]; stages: StageDef[]; projects: { id: string; name: string }[]; pillars: { id: string; name: string }[];
  busyIds: Set<string>; onOpen: (id: string) => void; onComplete: (id: string) => void;
  onPatch: (id: string, patch: TaskCellPatch) => Promise<boolean>; onCreate: () => void;
}
const priorityLabels = { urgent: 'Urgente', important: 'Importante', normal: 'Normal' };
function formatDay(date: string) { return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR'); }

export function TaskFocus(props: Props) {
  const { stages, busyIds, onOpen, onComplete, onPatch } = props;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queue = props.tasks.filter(task => !isTaskCompleted(task, stages));
  const task = queue.find(item => item.id === selectedId) || queue[0];
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

export function TaskLoad(props: Props) {
  const [preferences, setPreferences] = useState<PlanningPreferences | null>(null);
  const [preferencesError, setPreferencesError] = useState('');
  const [preferencesRetry, setPreferencesRetry] = useState(0);
  useEffect(() => {
    let active = true;
    apiFetch<PlanningPreferences>('/api/planning-preferences').then(value => {
      const parsed = planningPreferencesSchema.parse(value);
      if (active) { setPreferences(parsed); setPreferencesError(''); }
    }).catch(error => { if (active) { setPreferences(null); setPreferencesError(showError(error)); } });
    return () => { active = false; };
  }, [preferencesRetry]);
  const [anchor, setAnchor] = useState(todayStr());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dimension, setDimension] = useState<'projectId' | 'pillarId'>('projectId');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const days = weekDates(anchor);
  const load = calculateWorkload(props.tasks, props.stages, days, preferences || undefined);
  const date = selectedDay && days.includes(selectedDay) ? selectedDay : days[0];
  const grouped = new Map<string, TaskListRecord[]>();
  load.inWeek.forEach(task => { const key = task[dimension] || ''; grouped.set(key, [...(grouped.get(key) || []), task]); });
  const names = dimension === 'projectId' ? props.projects : props.pillars;
  const groupLabel = (id: string) => names.find(item => item.id === id)?.name || (id ? 'Vínculo indisponível' : dimension === 'projectId' ? 'Sem projeto' : 'Sem pilar');
  const selected = selectedGroup === null ? load.inWeek.filter(task => task.dueDate === date) : grouped.get(selectedGroup) || [];
  const max = Math.max(...load.distribution.map(day => day.tasks.length), 1);
  function shift(offset: number) { const day = new Date(`${days[0]}T12:00:00`); day.setDate(day.getDate() + offset); setAnchor(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`); setSelectedGroup(null); }
  function row(task: TaskListRecord) { return <article className="task-load-item" key={task.id}><button type="button" className="task-row-title" disabled={props.busyIds.has(task.id)} onClick={() => props.onOpen(task.id)}>{task.title}</button><span className={`task-priority-${task.priority}`}>{priorityLabels[task.priority]}</span><DeadlineCell task={task} busy={props.busyIds.has(task.id)} completed={false} onPatch={props.onPatch} /></article>; }
  return <div className="task-load-view">
    <header className="task-date-heading"><div><p className="task-eyebrow">Distribuir para executar</p><h2>Carga de trabalho</h2><p>Tarefas em aberto com os filtros atuais. Volume e blocos, sem estimativas inventadas.</p></div><Link href="/planejar" className="task-load-planning">Planejar horários<ArrowRight className="h-4 w-4" /></Link></header>
    <div className="task-load-stats"><div><span>Prazos nesta semana</span><strong>{load.inWeek.length}</strong></div><div><span>Horas em blocos</span><strong>{load.hours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}<small>h</small></strong></div><div><span>Sem prazo</span><strong>{load.undated.length}</strong></div><div><span>Em outras semanas</span><strong>{load.outside.length}</strong></div></div>
    {preferences || preferencesError ? <TaskCapacitySettings preferences={preferences || DEFAULT_PLANNING_PREFERENCES} onSaved={setPreferences} loadError={preferencesError} onRetry={() => setPreferencesRetry(value => value + 1)} /> : <p className="text-xs text-muted-foreground" role="status">Carregando jornada…</p>}
    <div className="task-load-stats" aria-label="Esforço e jornada"><div><span>Esforço previsto</span><strong>{(load.estimatedMinutes / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}<small>h</small></strong></div><div><span>Jornada da semana</span><strong>{load.capacityMinutes === null ? '—' : (load.capacityMinutes / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}<small>{load.capacityMinutes === null ? '' : 'h'}</small></strong></div><div><span>Sem estimativa nesta semana</span><strong>{load.unestimated}</strong></div><div><span>Comparação da jornada</span><strong>{load.capacityMinutes === null ? '—' : load.estimatedMinutes > load.capacityMinutes ? 'Acima' : 'Dentro'}</strong></div></div>
    <p className="task-load-note">Esforço considera somente minutos informados em cada tarefa. A jornada é capacidade bruta, não disponibilidade livre: não desconta Google, pausas nem tarefas sem estimativa. Não soma esforço aos blocos.</p>
    <div className="task-calendar-nav mb-4"><Button variant="outline" size="icon" aria-label="Semana anterior da carga" onClick={() => shift(-7)}><ChevronLeft className="h-4 w-4" /></Button><h3>{formatDay(days[0])} — {formatDay(days[6])}</h3><Button variant="outline" size="icon" aria-label="Próxima semana da carga" onClick={() => shift(7)}><ChevronRight className="h-4 w-4" /></Button><Input type="date" aria-label="Semana da carga" value={days[0]} className="w-auto" onChange={event => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) { setAnchor(event.target.value); setSelectedGroup(null); } }} /><Button variant="ghost" onClick={() => { setAnchor(todayStr()); setSelectedGroup(null); }}>Semana atual</Button></div>
    <p className="task-load-note"><Clock3 className="h-4 w-4" />Soma das durações válidas dos blocos iniciados em cada dia, no fuso de cada bloco. Sobreposições entram na soma; isto não mede horas livres nem inclui eventos externos do Google.</p>
    {load.overlaps > 0 && <p className="task-load-warning" role="status">{load.overlaps} pares de blocos se sobrepõem. Revise os horários em Planejar.</p>}
    <section aria-label="Distribuição da carga" className="task-load-distribution">{load.distribution.map(day => <button type="button" key={day.date} className={cn('task-load-day', date === day.date && selectedGroup === null && 'is-current')} aria-label={`Ver carga de ${formatDay(day.date)}`} aria-pressed={date === day.date && selectedGroup === null} onClick={() => { setSelectedDay(day.date); setSelectedGroup(null); }}><span>{new Date(`${day.date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' })}</span><small>{formatDay(day.date).slice(0, 5)}</small><div className="task-load-bar" aria-hidden="true"><i style={{ height: `${day.tasks.length / max * 100}%` }} /></div><strong>{day.tasks.length}<small>tarefas</small></strong><small>{day.urgent} urgentes</small><small>{day.blocks} blocos · {day.hours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h</small></button>)}</section>
    {load.inWeek.length === 0 && <p className="task-date-empty">Nenhuma tarefa com prazo nesta semana.</p>}
    <div className="task-load-lower"><section className="task-load-groups" aria-label="Carga por vínculo"><header><h3><Layers className="h-4 w-4" />Por vínculo</h3><select aria-label="Agrupar carga por" value={dimension} onChange={event => { setDimension(event.target.value as typeof dimension); setSelectedGroup(null); }}><option value="projectId">Projeto</option><option value="pillarId">Pilar</option></select></header><p className="text-xs text-muted-foreground">Distribuição dos prazos desta semana.</p>{[...grouped].sort((a, b) => b[1].length - a[1].length).map(([id, items]) => <button type="button" key={id} aria-pressed={selectedGroup === id} className="task-load-group" onClick={() => setSelectedGroup(id)}><span>{groupLabel(id)}</span><strong>{items.length}</strong><i style={{ width: `${items.length / Math.max(load.inWeek.length, 1) * 100}%` }} /></button>)}{grouped.size === 0 && <p className="text-sm text-muted-foreground py-4">Sem prazos para distribuir.</p>}</section>
      <section className="task-load-details" aria-label="Tarefas da carga selecionada"><h3>{selectedGroup === null ? `Prazos de ${formatDay(date)}` : groupLabel(selectedGroup)}<span>{selected.length}</span></h3>{selected.map(row)}{selected.length === 0 && <p className="text-sm text-muted-foreground py-4">Nenhuma tarefa nesta seleção.</p>}</section></div>
    <section className="task-undated" aria-label="Carga sem prazo"><div className="task-undated-heading"><h3>Falta distribuir</h3><span>{load.undated.length}</span></div><p className="text-xs text-muted-foreground mb-3">Tarefas sem prazo não entram nas barras. Defina uma data ou reserve um bloco em Planejar.</p><div className="task-undated-grid">{load.undated.map(row)}</div></section>
  </div>;
}
