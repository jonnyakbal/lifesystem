'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Circle, FileText, Flag, Plus, Wallet } from 'lucide-react';
import type { StageDef } from '@/types';
import { cn, todayStr } from '@/lib/utils';
import { isTaskCompleted } from '@/lib/task-stages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DeadlineCell, type TaskListRecord, type TaskCellPatch } from './task-workspace-table';

type ContentItem = { id: string; title: string; scheduledDate?: string };
type FinancialItem = { id: string; description?: string; category: string; dueDate?: string; status?: string; type: string };
type Props = {
  mode: 'calendar' | 'timeline'; month: Date; onMonth: (month: Date) => void;
  tasks: TaskListRecord[]; stages: StageDef[]; projects: { id: string; name: string }[];
  content: ContentItem[]; financial: FinancialItem[]; busyIds: Set<string>;
  onOpen: (id: string) => void; onCreate: (date: string) => void; onComplete: (id: string) => void;
  onPatch: (id: string, patch: TaskCellPatch) => Promise<boolean>;
};
function labelDate(date: string) { return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }

export function TaskRichDates(props: Props) {
  const { mode, month, onMonth, tasks, stages, projects, busyIds, onOpen, onCreate, onComplete, onPatch } = props;
  const [selected, setSelected] = useState<string | null>(null);
  const [showContent, setShowContent] = useState(true);
  const [showFinancial, setShowFinancial] = useState(true);
  const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: count }, (_, index) => `${prefix}-${String(index + 1).padStart(2, '0')}`);
  const monthTasks = tasks.filter(task => task.dueDate?.startsWith(`${prefix}-`));
  const undated = tasks.filter(task => !task.dueDate);
  const done = monthTasks.filter(task => isTaskCompleted(task, stages)).length;
  const first = (month.getDay() + 6) % 7;
  const currentDay = selected?.startsWith(`${prefix}-`) ? selected : todayStr().startsWith(`${prefix}-`) ? todayStr() : days[0];
  const dayTasks = tasks.filter(task => task.dueDate === currentDay);
  const content = showContent ? props.content : [];
  const financial = showFinancial ? props.financial.filter(entry => entry.status !== 'paid') : [];
  const dayContent = content.filter(item => item.scheduledDate === currentDay);
  const dayFinancial = financial.filter(item => item.dueDate === currentDay);
  function row(task: TaskListRecord) {
    const completed = isTaskCompleted(task, stages);
    return <article key={task.id} className={cn('task-day-item', completed && 'task-date-completed')}>
      <div className="task-day-item-title"><button type="button" className="task-row-title" disabled={busyIds.has(task.id)} onClick={() => onOpen(task.id)}>{task.title}</button><button type="button" className="task-completion-action" disabled={busyIds.has(task.id)} aria-label={`${completed ? 'Reabrir' : 'Concluir'} ${task.title}`} onClick={() => onComplete(task.id)}>{completed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}<span>{completed ? 'Reabrir' : 'Concluir'}</span></button></div>
      <div className="task-day-item-meta"><span>{stages.find(stage => stage.id === task.status)?.label || task.status}</span><span className={`task-priority-${task.priority}`}>{task.priority === 'urgent' ? 'Urgente' : task.priority === 'important' ? 'Importante' : 'Normal'}</span>{task.projectId && <span>{projects.find(project => project.id === task.projectId)?.name || 'Projeto indisponível'}</span>}</div>
      <DeadlineCell task={task} busy={busyIds.has(task.id)} completed={completed} onPatch={onPatch} />
    </article>;
  }
  return <div className="task-rich-dates">
    <header className="task-date-heading"><div><p className="task-eyebrow">{mode === 'calendar' ? 'O mês em perspectiva' : 'Horizonte de entregas'}</p><h2>{mode === 'calendar' ? 'Calendário de prazos' : 'Linha do tempo'}</h2><p>{mode === 'calendar' ? 'Escolha um dia para ver tudo ou criar uma tarefa.' : 'Cada ponto é um prazo. Blocos de horário continuam na Semana.'}</p></div><div className="task-date-stats"><span><strong>{monthTasks.length}</strong> no mês</span><span><strong>{done}</strong> concluídas</span><span><strong>{undated.length}</strong> sem prazo</span></div></header>
    <div className="task-calendar-nav mb-5"><Button variant="outline" size="icon" aria-label="Mês anterior" onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button><h3 className="capitalize text-sm font-semibold">{month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} · Prazos</h3><Button variant="outline" size="icon" aria-label="Próximo mês" onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button><Input type="month" aria-label={mode === 'calendar' ? 'Mês do calendário' : 'Mês da linha do tempo'} value={prefix} className="w-auto" onChange={event => { if (!/^\d{4}-\d{2}$/.test(event.target.value)) return; const [year, number] = event.target.value.split('-').map(Number); if (year >= 1900 && year <= 9999 && number >= 1 && number <= 12) onMonth(new Date(year, number - 1, 1)); }} /><Button variant="ghost" onClick={() => onMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Mês atual</Button></div>
    {mode === 'calendar' ? <>
      <div className="task-date-legend"><span><Circle className="h-3 w-3" />Tarefas com os filtros atuais</span><label><input type="checkbox" checked={showContent} onChange={event => setShowContent(event.target.checked)} />Conteúdo</label><label><input type="checkbox" checked={showFinancial} onChange={event => setShowFinancial(event.target.checked)} />Financeiro em aberto</label><span>Vínculos exibidos independentemente dos filtros de tarefas</span></div>
      <div className="task-calendar-layout"><div className="task-calendar-scroll"><div className="task-month-grid">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(label => <div key={label} className="task-weekday">{label}</div>)}
        {Array.from({ length: first }, (_, index) => <div key={`empty-${index}`} className="task-month-placeholder" />)}
        {days.map((date, index) => {
          const items = tasks.filter(task => task.dueDate === date);
          const linked = content.filter(item => item.scheduledDate === date).length + financial.filter(item => item.dueDate === date).length;
          return <div key={date} className={cn('task-month-day', date === currentDay && 'task-month-selected', date === todayStr() && 'task-month-today')}><button type="button" className="task-month-day-label" aria-label={`Ver dia ${labelDate(date)}`} aria-pressed={date === currentDay} onClick={() => setSelected(date)}><span>{index + 1}</span>{items.length + linked > 0 && <span className="task-day-count">{items.length + linked}</span>}</button><div className="task-month-preview">{items.slice(0, 2).map(task => <button type="button" key={task.id} disabled={busyIds.has(task.id)} onClick={() => onOpen(task.id)} className={cn('task-month-task', `task-priority-${task.priority}`, isTaskCompleted(task, stages) && 'task-date-completed')}><span className="task-date-dot" />{task.title}</button>)}{items.length > 2 && <button type="button" className="task-date-more" onClick={() => setSelected(date)}>+{items.length - 2} tarefas</button>}{linked > 0 && <button type="button" className="task-date-more" onClick={() => setSelected(date)}>{linked} vínculos</button>}</div></div>;
        })}
      </div></div><section className="task-day-panel" aria-label="Detalhes do dia"><div className="task-day-panel-heading"><div><p className="task-eyebrow">Dia em foco</p><h3>{new Date(`${currentDay}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3></div><Button size="icon" variant="outline" aria-label="Nova tarefa neste dia" onClick={() => onCreate(currentDay)}><Plus className="h-4 w-4" /></Button></div><p className="text-xs text-muted-foreground mb-4">{dayTasks.length} tarefas · {dayContent.length + dayFinancial.length} vínculos</p><div className="task-day-items">{dayTasks.map(row)}{dayContent.map(item => <Link key={item.id} href="/conteudo" className="task-day-link"><FileText className="h-4 w-4" /><span>Conteúdo · {item.title}</span></Link>)}{dayFinancial.map(item => <Link key={item.id} href="/financeiro" className="task-day-link"><Wallet className="h-4 w-4" /><span>Em aberto · {item.description || item.category}</span></Link>)}{dayTasks.length + dayContent.length + dayFinancial.length === 0 && <div className="task-date-empty"><CalendarDays className="h-6 w-6" /><p>Um dia sem itens nesta visão.</p><Button variant="ghost" onClick={() => onCreate(currentDay)}>Criar tarefa com este prazo</Button></div>}</div></section></div>
    </> : <section aria-label="Linha do tempo de prazos" className="task-timeline-scroll"><div className="task-timeline-grid" style={{ gridTemplateColumns: `250px repeat(${count}, minmax(30px, 1fr))` }}><div className="task-timeline-heading">Tarefa / prazo</div>{days.map((date, index) => <div key={date} className={cn('task-timeline-day', date === todayStr() && 'task-timeline-today')}><span>{new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 1)}</span><strong>{index + 1}</strong></div>)}{monthTasks.map(task => <div key={task.id} className="task-timeline-row" style={{ gridColumn: '1 / -1', gridTemplateColumns: 'subgrid' }}><div className="task-timeline-title"><button type="button" disabled={busyIds.has(task.id)} onClick={() => onOpen(task.id)}>{task.title}</button><div><span>{projects.find(project => project.id === task.projectId)?.name || stages.find(stage => stage.id === task.status)?.label || task.status}</span><DeadlineCell task={task} busy={busyIds.has(task.id)} completed={isTaskCompleted(task, stages)} onPatch={onPatch} /></div></div>{days.map(date => <div key={date} className={cn('task-timeline-cell', date === todayStr() && 'task-timeline-today')}>{task.dueDate === date && <button type="button" aria-label={`Abrir marco ${task.title}`} disabled={busyIds.has(task.id)} onClick={() => onOpen(task.id)} className={cn('task-timeline-marker', `task-priority-${task.priority}`, isTaskCompleted(task, stages) && 'task-date-completed')}><Flag className="h-4 w-4" /></button>}</div>)}</div>)}</div>{monthTasks.length === 0 && <div className="task-date-empty"><Flag className="h-6 w-6" /><p>Nenhum prazo neste mês com os filtros atuais.</p><Button variant="outline" onClick={() => onCreate(days[0])}>Criar tarefa neste mês</Button></div>}</section>}
    <section className="task-undated" aria-label="Tarefas sem prazo"><div className="task-undated-heading"><CalendarDays className="h-4 w-4" /><h3>Sem prazo definido</h3><span>{undated.length}</span></div><p className="text-xs text-muted-foreground mb-3">Estas tarefas continuam visíveis aqui. Defina um prazo ou distribua na Semana.</p><div className="task-undated-grid">{undated.map(row)}</div>{undated.length === 0 && <p className="text-xs text-muted-foreground">Todas as tarefas desta visão têm prazo.</p>}</section>
  </div>;
}
