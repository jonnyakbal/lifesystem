'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, CircleAlert, FileText, Inbox, Plus, Sparkles, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import type { Content, FinancialEntry, StageConfig, Task } from '@/types';
import type { GoogleCalendarEvent } from '@/lib/google-calendar';
import { apiFetch, showError } from '@/lib/api';
import { addDays, cn, todayStr } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { WorkspaceHeading } from '@/components/workspace/workspace-heading';
import { TaskDeleteDialog } from '@/components/task-delete-dialog';
import { TaskPlanningDialog } from '@/components/task-planning-dialog';
import { Input } from '@/components/ui/input';
import { PlanningWizard } from '@/components/planning-wizard';
import { clockLabel, dateKeyInTimeZone, freeIntervals, minutesOnDay } from '@/lib/planning-availability';
import { DEFAULT_PLANNING_PREFERENCES, workWindowOnDay, type PlanningPreferences } from '@/lib/planning-preferences';
import { TaskCapacitySettings } from '@/components/tasks/task-capacity-settings';

type Connection = { configured: boolean; connected: boolean };

function taskDay(task: Task, timeZone: string) {
  if (task.planning?.startAt) return dateKeyInTimeZone(task.planning.startAt, timeZone);
  return task.planning?.date || task.dueDate;
}

function weekStartAt(offset: number, timeZone: string) {
  const date = new Date(`${dateKeyInTimeZone(new Date(), timeZone)}T12:00:00`);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7) + offset * 7);
  return date;
}

function occursOn(event: GoogleCalendarEvent, day: string, timeZone: string) {
  if (event.allDay) return event.start <= day && day < event.end;
  return minutesOnDay(event.start, day, timeZone) < 1440 && minutesOnDay(event.end, day, timeZone) > 0;
}

export function PlanningWorkspace({ embedded = false, onTasksChanged, onOpenTask, refreshKey = '' }: { embedded?: boolean; onTasksChanged?: () => void; onOpenTask?: (id: string, task: Task) => void; refreshKey?: string } = {}) {
  const [deletionTask, setDeletionTask] = useState<Task | null>(null);
  const mutationLock = useRef(false);
  const weekGridRef = useRef<HTMLElement | null>(null);
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
  const [preferences, setPreferences] = useState<PlanningPreferences>(DEFAULT_PLANNING_PREFERENCES);
  const [preferencesError, setPreferencesError] = useState('');
  const [selected, setSelected] = useState<Task | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [calendarRefresh, setCalendarRefresh] = useState(0);
  const [newTitle, setNewTitle] = useState('');
  const [showRitual, setShowRitual] = useState(false);
  const [showAllBacklog, setShowAllBacklog] = useState(false);
  const [activeDay, setActiveDay] = useState(todayStr());
  const [loadedPeriod, setLoadedPeriod] = useState('');
  const periodKey = `${weekOffset}:${calendarRefresh}:${preferences.timeZone}`;

  const weekStart = useMemo(() => weekStartAt(weekOffset, preferences.timeZone), [weekOffset, preferences.timeZone]);
  const weekEnd = addDays(weekStart, 7);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart); date.setDate(date.getDate() + index);
    return { date, key: todayStr(date) };
  }), [weekStart]);

  async function load() {
    setLoading(true);
    const [t, c, f, g, s, p] = await Promise.allSettled([
      apiFetch<Task[]>('/api/tasks'), apiFetch<Content[]>('/api/content'),
      apiFetch<FinancialEntry[]>('/api/financial'), apiFetch<Connection>('/api/google-calendar/status'),
      apiFetch<{ stages: StageConfig['stages'] }>('/api/stage-configs/tasks'),
      apiFetch<PlanningPreferences>('/api/planning-preferences'),
    ]);
    if (t.status === 'fulfilled') { setTasks(t.value); setLoadError(''); }
    else setLoadError(showError(t.reason));
    if (c.status === 'fulfilled') setContent(c.value);
    if (f.status === 'fulfilled') setFinancial(f.value);
    if (g.status === 'fulfilled') setConnection(g.value);
    if (p.status === 'fulfilled') { setPreferences(p.value); setPreferencesError(''); }
    else setPreferencesError(showError(p.reason));
    if (s.status === 'fulfilled') {
      const ids = s.value.stages.filter(stage => stage.isTerminal).map(stage => stage.id);
      setTerminal(ids.length ? ids : ['done']);
    }
    setLoading(false);
  }

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [refreshKey]);
  useEffect(() => {
    if (!connection?.connected) return;
    let active = true;
    // One day of margin covers the civil week in every IANA timezone; the grid
    // filters the returned events to the configured local days.
    const from = new Date(Date.parse(`${todayStr(weekStart)}T00:00:00Z`) - 86400000).toISOString();
    const to = new Date(Date.parse(`${weekEnd}T00:00:00Z`) + 86400000).toISOString();
    queueMicrotask(() => {
      if (!active) return;
      apiFetch<GoogleCalendarEvent[]>(`/api/google-calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
        .then(items => { if (active) { setEvents(items); setCalendarError(''); setLoadedPeriod(periodKey); } })
        .catch(error => { if (active) { setEvents([]); setCalendarError(showError(error)); setLoadedPeriod(periodKey); } });
    });
    return () => { active = false; };
  }, [connection?.connected, weekStart, weekEnd, calendarRefresh, periodKey]);
  const calendarReady = Boolean(!loading && !loadError && !preferencesError && connection?.connected && loadedPeriod === periodKey && !calendarError);
  const visibleEvents = loadedPeriod === periodKey ? events : [];
  const mobileDay = days.some(day => day.key === activeDay) ? activeDay : days[0].key;
  const planningToday = dateKeyInTimeZone(new Date(), preferences.timeZone);
  function plannedDay(task: Task) { return taskDay(task, preferences.timeZone); }

  const openTasks = tasks.filter(task => !terminal.includes(task.status));
  const backlog = openTasks.filter(task => !plannedDay(task)).sort((a, b) => {
    const order = { urgent: 0, important: 1, normal: 2 };
    return order[a.priority] - order[b.priority] || a.createdAt.localeCompare(b.createdAt);
  });
  const overdue = openTasks.filter(task => plannedDay(task) && plannedDay(task)! < days[0].key);
  const weekTasks = openTasks.filter(task => plannedDay(task) && plannedDay(task)! >= days[0].key && plannedDay(task)! < weekEnd);
  const period = `${days[0].date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} – ${days[6].date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  async function schedule(task: Task, date: string | null) {
    if (mutationLock.current) return;
    if (date && task.planning?.startAt) { setSelected(task); setSelectedDate(date); return; }
    if (!date && task.planning?.eventId && !window.confirm('Devolver a tarefa ao planejamento e remover seu evento espelhado do Google Agenda? O dia e o prazo serão removidos; a tarefa continuará na lista para planejar.')) return;
    mutationLock.current = true; setSaving(true);
    try {
      const updated = await apiFetch<Task>(`/api/tasks/${task.id}/planning`, {
        method: date ? 'PUT' : 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(date ? { date, timeZone: preferences.timeZone, syncToGoogle: false } : { removeGoogleEvent: Boolean(task.planning?.eventId) }),
      });
      setTasks(items => items.map(item => item.id === task.id ? updated : item));
      onTasksChanged?.();
      setSelected(null);
      setCalendarRefresh(value => value + 1);
      toast.success(date ? 'Tarefa planejada.' : 'Tarefa devolvida ao planejamento.');
    } catch (error) { toast.error(showError(error)); }
    finally { mutationLock.current = false; setSaving(false); }
  }

  function planningSaved(updated: Task) {
    onTasksChanged?.();
    setActiveDay(plannedDay(updated) || todayStr());
    setTasks(items => items.map(item => item.id === updated.id ? updated : item));
    setSelected(null); setCalendarRefresh(value => value + 1);
    if (updated.planning?.syncState === 'error') toast.warning('Planejamento salvo. A sincronização com o Google precisa de atenção.');
    else toast.success(updated.planning?.syncState === 'synced' ? 'Bloco salvo e espelhado no Google.' : 'Tarefa planejada.');
  }

  async function retrySync(task: Task) {
    const plan = task.planning;
    if (!plan?.date || saving) return;
    setSaving(true);
    try {
      planningSaved(await apiFetch<Task>(`/api/tasks/${task.id}/planning`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: plan.date, startAt: plan.startAt, endAt: plan.endAt, timeZone: plan.timeZone, syncToGoogle: true }),
      }));
    } catch (error) { toast.error(showError(error)); }
    finally { setSaving(false); }
  }

  async function adoptGoogle(task: Task) {
    if (saving || !window.confirm('Adotar o título e o horário atuais do evento Google nesta tarefa? O prazo seguirá o dia do Google e o status será preservado.')) return;
    setSaving(true);
    try { planningSaved(await apiFetch<Task>(`/api/tasks/${task.id}/planning`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'adopt-google' }) })); }
    catch (error) { toast.error(showError(error)); }
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
      onTasksChanged?.();
    } catch (error) { toast.error(showError(error)); }
    finally { setSaving(false); }
  }

  function taskCard(task: Task) {
    return <div key={task.id} data-testid={`planning-task-${task.id}`} draggable
      onDragStart={event => event.dataTransfer.setData('text/plain', task.id)}
      className={cn('work-planning-card rounded-xl border bg-card px-4 py-3 shadow-sm', task.priority === 'urgent' ? 'border-l-2 border-l-rose-500' : 'border-border/70')}>
      {onOpenTask ? <button type="button" disabled={saving} className="task-row-title text-left" onClick={() => { if (!mutationLock.current) onOpenTask(task.id, task); }}>{task.title}</button> : <Link href={`/tarefas?open=${encodeURIComponent(task.id)}`} aria-disabled={saving} tabIndex={saving ? -1 : undefined} onClick={event => { if (saving) event.preventDefault(); }} className="block break-words text-sm font-semibold leading-relaxed hover:text-primary">{task.title}</Link>}
      {task.planning?.startAt && <p className="mt-2 text-xs font-medium text-primary">{new Date(task.planning.startAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: preferences.timeZone })} – {new Date(task.planning.endAt!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: preferences.timeZone })} · Bloco de foco</p>}
      {task.planning?.syncToGoogle && <div className="mt-2 text-[11px] text-muted-foreground">
        {task.planning.syncState === 'synced' ? 'Espelhado no Google' : task.planning.syncState === 'pending' ? 'Sincronização pendente' : task.planning.syncError || 'Falha ao sincronizar'}
        {task.planning.eventUrl && <a className="ml-2 text-primary underline" target="_blank" rel="noopener noreferrer" href={task.planning.eventUrl}>Abrir no Google</a>}
        {task.planning.syncState !== 'synced' && <button disabled={saving} className="mt-1 block text-primary underline" onClick={() => void retrySync(task)}>Tentar sincronizar</button>}
        {task.planning.syncState === 'error' && task.planning.eventId && <button disabled={saving} className="mt-1 block text-primary underline" onClick={() => void adoptGoogle(task)}>Adotar bloco do Google</button>}
      </div>}
      <div className="work-planning-actions mt-3 flex flex-wrap gap-1 text-xs">
        {task.priority === 'urgent' && <span className="text-rose-400">Urgente</span>}
        <button className="work-planning-action font-medium text-primary" onClick={() => {
          setSelected(task); setSelectedDate(task.planning?.startAt && task.planning.date ? task.planning.date : plannedDay(task) || (days[0].key > planningToday ? days[0].key : planningToday));
        }}>{task.planning?.startAt ? 'Replanejar' : plannedDay(task) ? 'Mudar dia' : 'Planejar'}</button>
        {plannedDay(task) && <button className="work-planning-action text-muted-foreground hover:text-foreground" title="Remover o dia, o horário e o evento espelhado; manter a tarefa" disabled={saving} onClick={() => void schedule(task, null)}>Devolver ao planejamento</button>}
        <button className="work-planning-action text-muted-foreground hover:text-destructive" disabled={saving} onClick={() => setDeletionTask(task)}>Excluir tarefa</button>
      </div>
    </div>;
  }

  return <section aria-label="Planejamento integrado" className={embedded ? 'min-w-0' : 'work-page work-planning mx-auto max-w-[1800px] px-4 pb-24 pt-6 lg:px-8 lg:pb-12'}>
    {embedded ? <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-2xl">Sua semana</h2><div className="flex items-center gap-2"><Button variant="outline" onClick={() => setShowRitual(value => !value)}>{showRitual ? 'Fechar ritual' : 'Criar por pilar'}</Button><Link href="/planejar" className="work-action-link">Abrir Planejar</Link></div></header> : <WorkspaceHeading eyebrow="Tempo com intenção" title="Sua semana" description="Uma agenda possível. Distribua suas prioridades, reserve seu foco e encontre espaço para a vida." actions={<><Button variant="outline" className="gap-2" onClick={() => setShowRitual(value => !value)}><Sparkles className="h-4 w-4" />{showRitual ? 'Fechar ritual' : 'Criar por pilar'}</Button><Link href="/tarefas" className="work-action-link">Todas as tarefas</Link></>} />}
    {showRitual && <section className="mb-7 rounded-2xl border bg-card/70 p-4 sm:p-6"><PlanningWizard onItemsChanged={() => { void load(); onTasksChanged?.(); }} /></section>}
    {loadError && <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm"><CircleAlert className="h-4 w-4" />{loadError}<Button size="sm" variant="outline" onClick={() => void load()}>Tentar novamente</Button></div>}
    <TaskCapacitySettings preferences={preferences} loadError={preferencesError} onRetry={() => void load()} onSaved={value => { setPreferences(value); setPreferencesError(''); }} />

    <div className="mb-6 grid grid-cols-2 gap-3">
      <a href="#planning-week-days" className="work-planning-summary rounded-2xl border bg-card/50 px-5 py-4 transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-primary"><p className="text-[11px] text-muted-foreground">Nesta semana ↗</p><p className="mt-1 font-mono-num text-xl font-semibold">{weekTasks.length} <span className="text-xs font-normal text-muted-foreground">tarefas</span></p></a>
      <a href="#planning-backlog" className="work-planning-summary rounded-2xl border bg-card/50 px-5 py-4 transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-primary"><p className="text-[11px] text-muted-foreground">Para decidir ↗</p><p className="mt-1 font-mono-num text-xl font-semibold">{backlog.length} <span className="text-xs font-normal text-muted-foreground">sem data</span></p></a>
    </div>

    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Semana anterior" onClick={() => setWeekOffset(value => value - 1)}><ArrowLeft className="h-4 w-4" /></Button><h2 className="min-w-44 text-center text-sm font-semibold capitalize">{period}</h2><Button variant="outline" size="icon" aria-label="Próxima semana" onClick={() => setWeekOffset(value => value + 1)}><ArrowRight className="h-4 w-4" /></Button>{weekOffset !== 0 && <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>Hoje</Button>}</div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{connection?.connected ? <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Google Agenda conectada</> : <><CalendarDays className="h-3.5 w-3.5" /> {connection?.configured ? <Link href="/api/google-calendar/connect" className="text-primary hover:underline">Conectar Google Agenda</Link> : 'Google Agenda indisponível neste ambiente'}</>}</div>
      {calendarError && <div role="status" className="flex items-center gap-2 text-xs text-amber-500"><CircleAlert className="h-3.5 w-3.5" />{calendarError}<Link href="/api/google-calendar/connect" className="underline">Reconectar</Link></div>}
      {connection?.connected && <Button variant="ghost" size="sm" disabled={loadedPeriod !== periodKey} onClick={() => setCalendarRefresh(value => value + 1)}>{loadedPeriod !== periodKey ? 'Atualizando agenda…' : 'Atualizar agenda'}</Button>}
    </div>

    <details className="mb-4 text-xs text-muted-foreground"><summary className="cursor-pointer">Horários locais · {preferences.timeZone} · {preferences.workStart}–{preferences.workEnd}</summary><p className="mt-2 max-w-2xl leading-relaxed">Os intervalos livres consideram sua janela de trabalho, seus blocos e compromissos na agenda principal do Google. Eventos de dia inteiro não reservam horários.</p></details>
    {embedded && <section className="task-week-distribution" aria-label="Distribuição semanal"><div><h3>Ritmo da semana</h3><p>Quantidade de prioridades por dia. Somente os blocos com horário reservam tempo.</p></div><div className="task-week-bars">{days.map(({ date, key }) => { const items = weekTasks.filter(task => plannedDay(task) === key); const timed = items.filter(task => task.planning?.startAt).length; return <button type="button" key={key} aria-label={`Focar ${date.toLocaleDateString('pt-BR', { weekday: 'long' })}: ${items.length} tarefas, ${timed} blocos`} onClick={() => { setActiveDay(key); requestAnimationFrame(() => weekGridRef.current?.querySelector(`[data-day="${key}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center' })); }}><span>{items.length}</span><i style={{ height: `${8 + Math.min(items.length, 8) * 7}px` }} /><small>{date.toLocaleDateString('pt-BR', { weekday: 'short' })}</small><small>{timed} blocos</small></button>; })}</div></section>}
    <nav aria-label="Escolher dia" className="mb-4 grid grid-cols-7 gap-1">{days.map(({date, key}) => <button key={key} aria-pressed={key === mobileDay} onClick={() => { setActiveDay(key); requestAnimationFrame(() => weekGridRef.current?.querySelector(`[data-day="${key}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center' })); }} className="min-h-14 rounded-xl border text-xs aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary"><span className="block text-[10px] uppercase">{date.toLocaleDateString('pt-BR', {weekday:'short'})}</span><span className="mt-1 block text-lg">{date.getDate()}</span></button>)}</nav>
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
      <section ref={weekGridRef} id="planning-week-days" aria-label="Dias da semana" className="work-week-grid min-w-0 scroll-mt-24">
        {days.map(({ date, key }) => {
          const dayTasks = openTasks.filter(task => task.planning?.startAt && task.planning.endAt ? occursOn({ start: task.planning.startAt, end: task.planning.endAt, allDay: false } as GoogleCalendarEvent, key, preferences.timeZone) : plannedDay(task) === key);
          const dayEvents = visibleEvents.filter(event => occursOn(event, key, preferences.timeZone) && !dayTasks.some(task => task.planning?.eventId === event.id && task.planning.syncState === 'synced' && Date.parse(task.planning.startAt!) === Date.parse(event.start) && Date.parse(task.planning.endAt!) === Date.parse(event.end) && task.title === event.title));
          const timed = [
            ...dayTasks.filter(task => task.planning?.startAt).map(task => ({ id: task.id, start: minutesOnDay(task.planning!.startAt!, key, preferences.timeZone), end: minutesOnDay(task.planning!.endAt!, key, preferences.timeZone), task, event: null })),
            ...dayEvents.filter(event => !event.allDay).map(event => ({ id: event.id, start: minutesOnDay(event.start, key, preferences.timeZone), end: minutesOnDay(event.end, key, preferences.timeZone), task: null, event })),
          ].sort((a,b) => a.start - b.start);
          const workWindow = workWindowOnDay(key, preferences);
          const free = workWindow ? freeIntervals(timed.filter(item => !item.event || item.event.busy !== false), workWindow.start, workWindow.end) : [];
          const freeMinutes = free.reduce((total, item) => total + item.end - item.start, 0);
          const dayContent = content.filter(item => item.scheduledDate === key && item.status !== 'archived');
          const dayFinancial = financial.filter(item => item.dueDate === key && item.status !== 'paid');
          const isToday = key === planningToday;
          return <div key={key} data-day={key} onDragOver={event => event.preventDefault()} onDrop={event => {
            event.preventDefault(); const id = event.dataTransfer.getData('text/plain');
            const task = openTasks.find(item => item.id === id); if (task) void schedule(task, key);
          }} className={cn('work-week-day rounded-2xl border lg:block', key !== mobileDay && 'hidden', isToday ? 'border-primary/55 bg-primary/[.06]' : 'border-border/70 bg-card/30')}>
            <div className="work-day-header flex items-center justify-between"><div><p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{date.toLocaleDateString('pt-BR', { weekday: 'short' })}</p><p className="font-display text-2xl leading-none">{date.getDate()}</p></div>{isToday && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">Hoje</span>}</div>
            <div className="work-day-content space-y-3">
              <p className="pb-2 text-[11px] text-muted-foreground">{!workWindow ? 'Fora da capacidade definida' : calendarReady ? `${Math.floor(freeMinutes / 60)}h${freeMinutes % 60 ? ` ${freeMinutes % 60}min` : ''} sem blocos · ${preferences.workStart}–${preferences.workEnd}` : connection?.connected ? 'Disponibilidade aguardando agenda' : 'Somente planejamento local'}</p>
              {dayEvents.filter(event => event.allDay).map(event => <p key={event.id} className="rounded-lg border border-sky-400/20 bg-sky-400/5 p-2 text-xs">Dia inteiro · {event.title}</p>)}
              {timed.map(item => <div key={item.id} className="border-l-2 border-primary/20 pl-2"><p className="mb-1 text-[10px] tabular-nums text-muted-foreground">{clockLabel(item.start)} – {clockLabel(item.end)}</p>{item.task ? taskCard(item.task) : <div className="rounded-lg border border-sky-400/20 bg-sky-400/5 px-2.5 py-2 text-xs"><p className="mb-1 text-[10px] text-sky-400">Google{item.event?.busy === false ? ' · Disponível' : ''}</p>{item.event?.url ? <a href={item.event.url} target="_blank" rel="noopener noreferrer" className="break-words font-medium hover:underline">{item.event.title}</a> : <p className="break-words font-medium">{item.event?.title}</p>}</div>}</div>)}
              {calendarReady && free.length > 0 && <details className="rounded-lg border border-dashed p-2 text-[11px] text-muted-foreground"><summary className="cursor-pointer">{free.length} {free.length === 1 ? 'intervalo livre' : 'intervalos livres'}</summary><ul className="mt-2 space-y-1">{free.map(slot => <li key={slot.start} className="tabular-nums">{clockLabel(slot.start)} – {clockLabel(slot.end)}</li>)}</ul></details>}
              {dayTasks.some(task => !task.planning?.startAt) && <p className="pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Prioridades · sem horário</p>}
              {dayTasks.filter(task => !task.planning?.startAt).map(taskCard)}
              {dayContent.map(item => <Link key={item.id} href="/conteudo" className="flex gap-1.5 rounded-lg border border-violet-400/20 bg-violet-400/5 px-2.5 py-2 text-xs"><FileText className="mt-0.5 h-3 w-3 shrink-0 text-violet-400" /><span className="line-clamp-2">{item.title}</span></Link>)}
              {dayFinancial.map(item => <Link key={item.id} href="/financeiro" className="flex gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/5 px-2.5 py-2 text-xs"><Wallet className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" /><span className="line-clamp-2">{item.description || item.category}</span></Link>)}
            </div>
            {!loading && dayTasks.length + dayEvents.length + dayContent.length + dayFinancial.length === 0 && <p className="px-1 py-3 text-xs text-muted-foreground/70">Nenhum item carregado para este dia</p>}
          </div>;
        })}
      </section>

      <aside id="planning-backlog" aria-label="Tarefas para planejar" className="min-w-0 scroll-mt-24 xl:sticky xl:top-6 xl:self-start"><div className="rounded-2xl border bg-card/70 p-4">
        <div className="mb-1 flex items-center gap-2"><Inbox className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Para planejar</h2><span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs">{backlog.length}</span></div>
        <p className="mb-4 text-xs text-muted-foreground">Escolha o dia. O horário continua livre até você reservar um bloco.</p>
        <div className="mb-4 flex gap-2"><Input aria-label="Nova tarefa" value={newTitle} onChange={event => setNewTitle(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void createTask(); }} placeholder="Nova tarefa..." /><Button size="icon" aria-label="Adicionar tarefa" disabled={!newTitle.trim() || saving} onClick={() => void createTask()}><Plus className="h-4 w-4" /></Button></div>
        <div className="grid max-h-[55vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1">{(showAllBacklog ? backlog : backlog.slice(0, 4)).map(taskCard)}</div>
        {backlog.length > 4 && <button className="mt-3 text-xs font-medium text-primary hover:underline" onClick={() => setShowAllBacklog(value => !value)}>{showAllBacklog ? 'Mostrar menos' : `Ver mais ${backlog.length - 4} tarefas`}</button>}
        {!loading && backlog.length === 0 && <div className="rounded-xl border border-dashed px-3 py-7 text-center text-xs text-muted-foreground">Nada esperando uma data. Capture uma ideia quando surgir.</div>}
        {overdue.length > 0 && <div className="mt-5 border-t pt-4"><p className="mb-2 text-xs font-semibold text-amber-500">Antes desta semana · {overdue.length}</p><div className="space-y-2">{overdue.map(taskCard)}</div></div>}
      </div></aside>
    </div>

    {deletionTask && <TaskDeleteDialog task={deletionTask} onClose={() => setDeletionTask(null)} onDeleted={() => {
      setTasks(items => items.filter(item => item.id !== deletionTask.id)); onTasksChanged?.(); setCalendarRefresh(value => value + 1); toast.success('Tarefa excluída.');
    }} />}
    {selected && <TaskPlanningDialog key={selected.id + selectedDate} task={selected} initialDate={selectedDate} preferredTimeZone={preferencesError ? undefined : preferences.timeZone} connected={Boolean(connection?.connected)} onClose={() => setSelected(null)} onSaved={planningSaved} />}
  </section>;
}
