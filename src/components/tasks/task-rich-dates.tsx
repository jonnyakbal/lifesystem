'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Circle, FileText, Plus, Wallet } from 'lucide-react';
import type { StageDef } from '@/types';
import { cn, todayStr } from '@/lib/utils';
import { isTaskCompleted } from '@/lib/task-stages';
import { Input } from '@/components/ui/input';
import { DeadlineCell, type TaskListRecord, type TaskCellPatch } from './task-workspace-table';

type ContentItem = { id: string; title: string; scheduledDate?: string };
type FinancialItem = { id: string; description?: string; category: string; dueDate?: string; status?: string; type: string };
export type CalendarMode = 'week' | 'month';
type Props = {
  month: Date; onMonth: (month: Date) => void;
  mode: CalendarMode; onMode: (mode: CalendarMode) => void;
  agenda: boolean; onAgenda: (value: boolean) => void;
  /** Agenda completa (Google + blocos), mostrada na semana só quando pedida. */
  agendaView?: ReactNode;
  tasks: TaskListRecord[]; stages: StageDef[]; projects: { id: string; name: string }[];
  content: ContentItem[]; financial: FinancialItem[]; busyIds: Set<string>;
  onOpen: (id: string) => void; onCreate: (date: string) => void; onComplete: (id: string) => void;
  onPatch: (id: string, patch: TaskCellPatch) => Promise<boolean>;
};
const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
function labelDate(date: string) { return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function addDays(date: string, days: number) { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + days); return todayStr(d); }
function weekStart(date: string) { const d = new Date(`${date}T12:00:00`); return addDays(date, -((d.getDay() + 6) % 7)); }

export function TaskRichDates(props: Props) {
  const { month, onMonth, mode, onMode, agenda, onAgenda, tasks, stages, projects, busyIds, onOpen, onCreate, onComplete, onPatch } = props;
  const [selected, setSelected] = useState<string | null>(null);
  const [weekAnchor, setWeekAnchor] = useState(() => weekStart(todayStr()));
  const [showContent, setShowContent] = useState(true);
  const [showFinancial, setShowFinancial] = useState(true);
  const [dropDate, setDropDate] = useState<string | null>(null);
  const today = todayStr();
  const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const monthDays = Array.from({ length: count }, (_, index) => `${prefix}-${String(index + 1).padStart(2, '0')}`);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekAnchor, index));
  const undated = tasks.filter(task => !task.dueDate);
  const first = (month.getDay() + 6) % 7;
  // Vínculos de outras áreas só aparecem quando a agenda é pedida.
  const content = agenda && showContent ? props.content : [];
  const financial = agenda && showFinancial ? props.financial.filter(entry => entry.status !== 'paid') : [];
  const byDate = (date: string) => tasks.filter(task => task.dueDate === date);

  function shift(direction: -1 | 1) {
    if (mode === 'week') setWeekAnchor(addDays(weekAnchor, 7 * direction));
    else onMonth(new Date(month.getFullYear(), month.getMonth() + direction, 1));
  }
  function goToday() {
    setWeekAnchor(weekStart(today));
    onMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  }
  function openWeekOf(date: string) { setWeekAnchor(weekStart(date)); onMode('week'); }

  // Arrastar muda o prazo; tarefas com bloco de horário mudam só em Planejar.
  function dropProps(date: string) {
    return {
      onDragOver: (event: React.DragEvent) => { if (event.dataTransfer.types.includes('text/task-id')) { event.preventDefault(); setDropDate(date); } },
      onDragLeave: () => setDropDate(current => current === date ? null : current),
      onDrop: (event: React.DragEvent) => {
        event.preventDefault(); setDropDate(null);
        const id = event.dataTransfer.getData('text/task-id');
        const task = tasks.find(item => item.id === id);
        if (task && task.dueDate !== date && !task.planning?.startAt) void onPatch(id, { dueDate: date });
      },
    };
  }

  function chip(task: TaskListRecord, size: 'sm' | 'md' = 'sm') {
    const completed = isTaskCompleted(task, stages);
    const overdue = Boolean(task.dueDate && task.dueDate < today && !completed);
    const project = task.projectId ? projects.find(item => item.id === task.projectId)?.name : undefined;
    return <div key={task.id} draggable={!busyIds.has(task.id) && !task.planning?.startAt}
      onDragStart={event => { event.dataTransfer.setData('text/task-id', task.id); event.dataTransfer.effectAllowed = 'move'; }}
      className={cn('task-cal-item', `task-cal-${size}`, `task-priority-${task.priority}`, overdue && 'is-overdue', completed && 'is-done')}>
      <button type="button" className="task-cal-check" disabled={busyIds.has(task.id)} aria-label={`${completed ? 'Reabrir' : 'Concluir'} ${task.title}`} onClick={() => onComplete(task.id)}>{completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}</button>
      <button type="button" className="task-cal-title" disabled={busyIds.has(task.id)} title={project ? `${task.title} · ${project}` : task.title} onClick={() => onOpen(task.id)}>{task.title}</button>
      {size === 'md' && project && <span className="task-cal-project">{project}</span>}
    </div>;
  }

  const rangeLabel = mode === 'week'
    ? `${new Date(`${weekDays[0]}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} – ${new Date(`${weekDays[6]}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const currentDay = selected?.startsWith(`${prefix}-`) ? selected : null;
  const dayTasks = currentDay ? byDate(currentDay) : [];
  const dayContent = currentDay ? content.filter(item => item.scheduledDate === currentDay) : [];
  const dayFinancial = currentDay ? financial.filter(item => item.dueDate === currentDay) : [];
  const undatedBlock = undated.length > 0 && <details className="task-undated"><summary>Sem prazo <span>{undated.length}</span></summary><div className="task-undated-items">{undated.map(task => chip(task, 'md'))}</div></details>;

  return <div className="task-cal">
    <div className="task-cal-bar">
      <div className="task-cal-nav">
        <button type="button" className="task-cal-icon" aria-label={mode === 'week' ? 'Semana anterior' : 'Mês anterior'} onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></button>
        <h2 className="task-cal-range">{rangeLabel}</h2>
        <button type="button" className="task-cal-icon" aria-label={mode === 'week' ? 'Próxima semana' : 'Próximo mês'} onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></button>
        <button type="button" className="task-cal-today" onClick={goToday}>Hoje</button>
        {mode === 'month' && <Input type="month" aria-label="Mês do calendário" value={prefix} className="task-cal-month-input" onChange={event => { if (!/^\d{4}-\d{2}$/.test(event.target.value)) return; const [year, number] = event.target.value.split('-').map(Number); if (year >= 1900 && year <= 9999 && number >= 1 && number <= 12) onMonth(new Date(year, number - 1, 1)); }} />}
      </div>
      <div className="task-cal-tools">
        <div className="task-segmented" role="group" aria-label="Período do calendário">
          <button type="button" aria-pressed={mode === 'week'} onClick={() => onMode('week')}>Semana</button>
          <button type="button" aria-pressed={mode === 'month'} onClick={() => onMode('month')}>Mês</button>
        </div>
        <button type="button" className="task-cal-agenda" aria-pressed={agenda} onClick={() => onAgenda(!agenda)} title="Mostrar Google Agenda, conteúdo e contas"><CalendarDays className="h-4 w-4" />Agenda</button>
      </div>
    </div>

    {agenda && mode === 'month' && <div className="task-cal-legend"><label><input type="checkbox" checked={showContent} onChange={event => setShowContent(event.target.checked)} />Conteúdo</label><label><input type="checkbox" checked={showFinancial} onChange={event => setShowFinancial(event.target.checked)} />Financeiro em aberto</label></div>}

    {mode === 'week' ? (agenda && props.agendaView ? props.agendaView : <>
      <div className="task-week" aria-label="Semana de prazos">
        {weekDays.map((date, index) => {
          const items = byDate(date);
          return <section key={date} aria-label={`Prazos de ${labelDate(date)}`} className={cn('task-week-day', date === today && 'is-today', date < today && 'is-past', dropDate === date && 'is-drop')} {...dropProps(date)}>
            <header><span>{WEEKDAYS[index]}</span><strong>{new Date(`${date}T12:00:00`).getDate()}</strong></header>
            <div className="task-week-items">{items.map(task => chip(task, 'md'))}</div>
            <button type="button" className="task-week-add" aria-label={`Nova tarefa em ${labelDate(date)}`} onClick={() => onCreate(date)}><Plus className="h-3.5 w-3.5" /></button>
          </section>;
        })}
      </div>
      {undatedBlock}
    </>) : <>
      <div className="task-calendar-scroll"><div className="task-month-grid">
        {WEEKDAYS.map(label => <div key={label} className="task-weekday">{label}</div>)}
        {Array.from({ length: first }, (_, index) => <div key={`empty-${index}`} className="task-month-placeholder" />)}
        {monthDays.map((date, index) => {
          const items = byDate(date);
          const linked = content.filter(item => item.scheduledDate === date).length + financial.filter(item => item.dueDate === date).length;
          return <div key={date} className={cn('task-month-day', date === currentDay && 'task-month-selected', date === today && 'task-month-today', date < today && 'is-past', dropDate === date && 'is-drop')} {...dropProps(date)}
            onClick={event => { if (event.target === event.currentTarget) onCreate(date); }}>
            <div className="task-month-head">
              <button type="button" className="task-month-day-label" aria-label={`Ver dia ${labelDate(date)}`} aria-pressed={date === currentDay} onClick={() => setSelected(date === currentDay ? null : date)}>{index + 1}</button>
              <button type="button" className="task-month-week" aria-label={`Abrir semana de ${labelDate(date)}`} onClick={() => openWeekOf(date)}>semana</button>
            </div>
            <div className="task-month-preview">
              {items.slice(0, 4).map(task => chip(task))}
              {items.length > 4 && <button type="button" className="task-date-more" onClick={() => setSelected(date)}>+{items.length - 4}</button>}
              {linked > 0 && <button type="button" className="task-date-more" onClick={() => setSelected(date)}>{linked} {linked === 1 ? 'vínculo' : 'vínculos'}</button>}
            </div>
          </div>;
        })}
      </div></div>
      {currentDay && <section className="task-day-panel" aria-label="Detalhes do dia">
        <div className="task-day-panel-heading"><h3>{new Date(`${currentDay}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3><button type="button" className="task-cal-icon" aria-label="Nova tarefa neste dia" onClick={() => onCreate(currentDay)}><Plus className="h-4 w-4" /></button></div>
        <div className="task-day-items">
          {dayTasks.map(task => <article key={task.id} className="task-day-row">{chip(task, 'md')}<DeadlineCell task={task} busy={busyIds.has(task.id)} completed={isTaskCompleted(task, stages)} onPatch={onPatch} /></article>)}
          {dayContent.map(item => <Link key={item.id} href="/conteudo" className="task-day-link"><FileText className="h-4 w-4" /><span>Conteúdo · {item.title}</span></Link>)}
          {dayFinancial.map(item => <Link key={item.id} href="/financeiro" className="task-day-link"><Wallet className="h-4 w-4" /><span>Em aberto · {item.description || item.category}</span></Link>)}
          {dayTasks.length + dayContent.length + dayFinancial.length === 0 && <p className="text-xs text-muted-foreground">Nada neste dia.</p>}
        </div>
      </section>}
      {undatedBlock}
    </>}
  </div>;
}
