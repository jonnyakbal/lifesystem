'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, CircleAlert, FileText, Inbox, Plus, Sparkles, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import type { Content, FinancialEntry, StageConfig, Task } from '@/types';
import type { GoogleCalendarEvent } from '@/lib/google-calendar';
import { apiFetch, showError } from '@/lib/api';
import { addDays, cn, todayStr } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PlanningWizard } from '@/components/planning-wizard';

type Connection = { configured: boolean; connected: boolean };

function weekStartAt(offset: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7) + offset * 7);
  return date;
}

function occursOn(event: GoogleCalendarEvent, day: string) {
  if (event.allDay) return event.start <= day && day < event.end;
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return new Date(event.start) < end && new Date(event.end) > start;
}

export function PlanningWorkspace() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [content, setContent] = useState<Content[]>([]);
  const [financial, setFinancial] = useState<FinancialEntry[]>([]);
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [terminal, setTerminal] = useState<string[]>(['done']);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [calendarError, setCalendarError] = useState('');
  const [selected, setSelected] = useState<Task | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [showRitual, setShowRitual] = useState(false);
  const [showAllBacklog, setShowAllBacklog] = useState(false);

  const weekStart = useMemo(() => weekStartAt(weekOffset), [weekOffset]);
  const weekEnd = addDays(weekStart, 7);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart); date.setDate(date.getDate() + index);
    return { date, key: todayStr(date) };
  }), [weekStart]);

  async function load() {
    setLoading(true);
    const [t, c, f, g, s] = await Promise.allSettled([
      apiFetch<Task[]>('/api/tasks'), apiFetch<Content[]>('/api/content'),
      apiFetch<FinancialEntry[]>('/api/financial'), apiFetch<Connection>('/api/google-calendar/status'),
      apiFetch<{ stages: StageConfig['stages'] }>('/api/stage-configs/tasks'),
    ]);
    if (t.status === 'fulfilled') { setTasks(t.value); setLoadError(''); }
    else setLoadError(showError(t.reason));
    if (c.status === 'fulfilled') setContent(c.value);
    if (f.status === 'fulfilled') setFinancial(f.value);
    if (g.status === 'fulfilled') setConnection(g.value);
    if (s.status === 'fulfilled') {
      const ids = s.value.stages.filter(stage => stage.isTerminal).map(stage => stage.id);
      setTerminal(ids.length ? ids : ['done']);
    }
    setLoading(false);
  }

  useEffect(() => { queueMicrotask(() => { void load(); }); }, []);
  useEffect(() => {
    if (!connection?.connected) return;
    let active = true;
    const from = weekStart.toISOString();
    const to = new Date(`${weekEnd}T00:00:00`).toISOString();
    queueMicrotask(() => {
      if (!active) return;
      apiFetch<GoogleCalendarEvent[]>(`/api/google-calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
        .then(items => { if (active) { setEvents(items); setCalendarError(''); } })
        .catch(error => { if (active) { setEvents([]); setCalendarError(showError(error)); } });
    });
    return () => { active = false; };
  }, [connection?.connected, weekStart, weekEnd]);

  const openTasks = tasks.filter(task => !terminal.includes(task.status));
  const backlog = openTasks.filter(task => !task.dueDate).sort((a, b) => {
    const order = { urgent: 0, important: 1, normal: 2 };
    return order[a.priority] - order[b.priority] || a.createdAt.localeCompare(b.createdAt);
  });
  const overdue = openTasks.filter(task => task.dueDate && task.dueDate < days[0].key);
  const weekTasks = openTasks.filter(task => task.dueDate && task.dueDate >= days[0].key && task.dueDate < weekEnd);
  const period = `${days[0].date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} – ${days[6].date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  async function schedule(task: Task, date: string | null) {
    setSaving(true);
    try {
      const updated = await apiFetch<Task>(`/api/tasks/${task.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dueDate: date }),
      });
      setTasks(items => items.map(item => item.id === task.id ? updated : item));
      setSelected(null);
      toast.success(date ? 'Tarefa planejada.' : 'Tarefa devolvida ao planejamento.');
    } catch (error) { toast.error(showError(error)); }
    finally { setSaving(false); }
  }

  async function createTask() {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const task = await apiFetch<Task>('/api/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), status: 'todo', priority: 'normal' }),
      });
      setTasks(items => [task, ...items]); setNewTitle('');
    } catch (error) { toast.error(showError(error)); }
    finally { setSaving(false); }
  }

  function taskCard(task: Task) {
    return <div key={task.id} data-testid={`planning-task-${task.id}`} draggable
      onDragStart={event => event.dataTransfer.setData('text/plain', task.id)}
      className={cn('rounded-xl border bg-card px-3 py-2.5 shadow-sm', task.priority === 'urgent' ? 'border-l-2 border-l-rose-500' : 'border-border/70')}>
      <p className="break-words text-sm font-medium leading-snug">{task.title}</p>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        {task.priority === 'urgent' && <span className="text-rose-400">Urgente</span>}
        <button className="font-medium text-primary hover:underline" onClick={() => {
          setSelected(task); setSelectedDate(task.dueDate || (days[0].key > todayStr() ? days[0].key : todayStr()));
        }}>{task.dueDate ? 'Mudar dia' : 'Planejar'}</button>
        {task.dueDate && <button className="text-muted-foreground hover:text-foreground hover:underline" disabled={saving} onClick={() => void schedule(task, null)}>Devolver ao planejamento</button>}
      </div>
    </div>;
  }

  return <main className="mx-auto max-w-[1600px] px-4 pb-24 pt-6 lg:px-8 lg:pb-12">
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div><p className="mb-2 text-[11px] font-semibold uppercase tracking-[.2em] text-primary">Planejar</p>
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Sua semana</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">Compromissos reais, prioridades possíveis e um lugar para o que ainda não tem data.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowRitual(value => !value)}><Sparkles className="h-4 w-4" />{showRitual ? 'Fechar ritual' : 'Criar por pilar'}</Button>
        <Link href="/tarefas" className="rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted">Todas as tarefas</Link>
      </div>
    </header>
    {showRitual && <section className="mb-7 rounded-2xl border bg-card/70 p-4 sm:p-6"><PlanningWizard onItemsChanged={() => void load()} /></section>}
    {loadError && <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm"><CircleAlert className="h-4 w-4" />{loadError}<Button size="sm" variant="outline" onClick={() => void load()}>Tentar novamente</Button></div>}

    <div className="mb-5 grid grid-cols-2 gap-2">
      <a href="#planning-week-days" className="rounded-xl border bg-card/50 px-4 py-3 transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-primary"><p className="text-[11px] text-muted-foreground">Nesta semana ↗</p><p className="mt-1 font-mono-num text-xl font-semibold">{weekTasks.length} <span className="text-xs font-normal text-muted-foreground">tarefas</span></p></a>
      <a href="#planning-backlog" className="rounded-xl border bg-card/50 px-4 py-3 transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-primary"><p className="text-[11px] text-muted-foreground">Para decidir ↗</p><p className="mt-1 font-mono-num text-xl font-semibold">{backlog.length} <span className="text-xs font-normal text-muted-foreground">sem data</span></p></a>
    </div>

    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Semana anterior" onClick={() => setWeekOffset(value => value - 1)}><ArrowLeft className="h-4 w-4" /></Button><h2 className="min-w-44 text-center text-sm font-semibold capitalize">{period}</h2><Button variant="outline" size="icon" aria-label="Próxima semana" onClick={() => setWeekOffset(value => value + 1)}><ArrowRight className="h-4 w-4" /></Button>{weekOffset !== 0 && <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>Hoje</Button>}</div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{connection?.connected ? <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Google Agenda conectada</> : <><CalendarDays className="h-3.5 w-3.5" /> {connection?.configured ? <Link href="/api/google-calendar/connect" className="text-primary hover:underline">Conectar Google Agenda</Link> : 'Google Agenda indisponível neste ambiente'}</>}</div>
      {calendarError && <div role="status" className="flex items-center gap-2 text-xs text-amber-500"><CircleAlert className="h-3.5 w-3.5" />{calendarError}<Link href="/api/google-calendar/connect" className="underline">Reconectar</Link></div>}
    </div>

    <div className="grid min-w-0 gap-5 min-[1600px]:grid-cols-[minmax(0,1fr)_280px]">
      <section id="planning-week-days" aria-label="Dias da semana" className="order-last grid min-w-0 scroll-mt-24 gap-2 sm:grid-cols-2 lg:order-first lg:grid-cols-7">
        {days.map(({ date, key }) => {
          const dayTasks = openTasks.filter(task => task.dueDate === key);
          const dayEvents = events.filter(event => occursOn(event, key));
          const dayContent = content.filter(item => item.scheduledDate === key && item.status !== 'archived');
          const dayFinancial = financial.filter(item => item.dueDate === key && item.status !== 'paid');
          const isToday = key === todayStr();
          return <div key={key} onDragOver={event => event.preventDefault()} onDrop={event => {
            event.preventDefault(); const id = event.dataTransfer.getData('text/plain');
            const task = openTasks.find(item => item.id === id); if (task) void schedule(task, key);
          }} className={cn('min-h-44 rounded-2xl border p-2.5', isToday ? 'order-first border-primary/55 bg-primary/[.06] lg:order-none' : 'border-border/70 bg-card/30')}>
            <div className="mb-3 flex items-center justify-between px-1"><div><p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{date.toLocaleDateString('pt-BR', { weekday: 'short' })}</p><p className="font-display text-2xl leading-none">{date.getDate()}</p></div>{isToday && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">Hoje</span>}</div>
            <div className="space-y-1.5">
              {dayEvents.map(event => <div key={event.id} className="rounded-lg border border-sky-400/20 bg-sky-400/5 px-2.5 py-2 text-xs"><p className="text-[10px] text-sky-400">{event.allDay ? 'Dia inteiro' : new Date(event.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · Google</p>{event.url ? <a href={event.url} target="_blank" rel="noopener noreferrer" className="mt-1 block font-medium leading-snug hover:underline">{event.title}</a> : <p className="mt-1 font-medium leading-snug">{event.title}</p>}</div>)}
              {dayTasks.map(taskCard)}
              {dayContent.map(item => <Link key={item.id} href="/conteudo" className="flex gap-1.5 rounded-lg border border-violet-400/20 bg-violet-400/5 px-2.5 py-2 text-xs"><FileText className="mt-0.5 h-3 w-3 shrink-0 text-violet-400" /><span className="line-clamp-2">{item.title}</span></Link>)}
              {dayFinancial.map(item => <Link key={item.id} href="/financeiro" className="flex gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/5 px-2.5 py-2 text-xs"><Wallet className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" /><span className="line-clamp-2">{item.description || item.category}</span></Link>)}
            </div>
            {!loading && dayTasks.length + dayEvents.length + dayContent.length + dayFinancial.length === 0 && <p className="px-1 py-3 text-xs text-muted-foreground/70">Espaço livre</p>}
          </div>;
        })}
      </section>

      <aside id="planning-backlog" aria-label="Tarefas para planejar" className="order-first min-w-0 scroll-mt-24 lg:order-last min-[1600px]:sticky min-[1600px]:top-6 min-[1600px]:self-start"><div className="rounded-2xl border bg-card/70 p-4">
        <div className="mb-1 flex items-center gap-2"><Inbox className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Para planejar</h2><span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs">{backlog.length}</span></div>
        <p className="mb-4 text-xs text-muted-foreground">Escolha o dia. O horário continua livre até você reservar um bloco.</p>
        <div className="mb-4 flex gap-2"><Input aria-label="Nova tarefa" value={newTitle} onChange={event => setNewTitle(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void createTask(); }} placeholder="Nova tarefa..." /><Button size="icon" aria-label="Adicionar tarefa" disabled={!newTitle.trim() || saving} onClick={() => void createTask()}><Plus className="h-4 w-4" /></Button></div>
        <div className="grid max-h-[55vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-4 min-[1600px]:grid-cols-1">{(showAllBacklog ? backlog : backlog.slice(0, 4)).map(taskCard)}</div>
        {backlog.length > 4 && <button className="mt-3 text-xs font-medium text-primary hover:underline" onClick={() => setShowAllBacklog(value => !value)}>{showAllBacklog ? 'Mostrar menos' : `Ver mais ${backlog.length - 4} tarefas`}</button>}
        {!loading && backlog.length === 0 && <div className="rounded-xl border border-dashed px-3 py-7 text-center text-xs text-muted-foreground">Nada esperando uma data. Capture uma ideia quando surgir.</div>}
        {overdue.length > 0 && <div className="mt-5 border-t pt-4"><p className="mb-2 text-xs font-semibold text-amber-500">Antes desta semana · {overdue.length}</p><div className="space-y-2">{overdue.map(taskCard)}</div></div>}
      </div></aside>
    </div>

    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Planejar tarefa</DialogTitle><DialogDescription>{selected?.title}</DialogDescription></DialogHeader><label className="grid gap-2 text-sm font-medium">Dia escolhido<Input type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)} /></label><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setSelected(null)}>Cancelar</Button><Button disabled={!selectedDate || saving} onClick={() => { if (selected) void schedule(selected, selectedDate); }}>Salvar dia</Button></div></DialogContent></Dialog>
  </main>;
}
