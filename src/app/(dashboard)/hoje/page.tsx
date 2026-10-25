'use client';

// The unified daily view Sunsama/Motion/Things3's "Today" tab all center
// around: what's due today across every entity, in one glance, instead of
// opening 5 separate kanbans/pages to piece it together. The ⌘K palette
// already had a "hoje" quick action pointing nowhere real — this is what
// it should have opened all along.
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2, Circle, Sparkles, FileText, Inbox, Crosshair, Hourglass, Wand2, History,
  Wallet, BookOpen, ArrowRight, Plus, Minus, PartyPopper, Repeat,
} from 'lucide-react';
import type { StageDef } from '@/types';
import { DEFAULT_STAGES } from '@/lib/default-stages';
import { isTaskCompleted, resolveTaskStages, taskCompletionStatus, taskReopenStatus } from '@/lib/task-stages';
import { cn, todayStr } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import { spawnNextOccurrenceIfRecurring, type RecurringFrequency } from '@/lib/recurring';

interface Task {
  id: string; title: string; status: string; completedAt?: string;
  priority: 'urgent' | 'important' | 'normal'; dueDate?: string;
  description?: string; projectId?: string; pillarId?: string; tags?: string[];
  recurring?: boolean; recurringFrequency?: RecurringFrequency; waitingFor?: string | null;
}
interface Capture { id: string; status: string }
interface Project { id: string; name: string }
interface Indicator {
  id: string; pillarId: string; name: string; targetValue?: number;
  currentValue?: number; frequency: string; history?: number[];
}
interface Pillar { id: string; name: string; icon: string; color: string; }
interface ContentItem { id: string; title: string; channel: string; stage: string; scheduledDate?: string; }
interface FinancialEntry {
  id: string; description?: string; category: string; amount: number;
  type: string; dueDate?: string; status?: string;
}
interface JournalEntry { id: string; entryDate: string; }

const stagger = { animate: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } };

function fireConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden';
  document.body.appendChild(container);
  for (let i = 0; i < 40; i++) {
    const el = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = Math.random() * 8 + 4;
    const x = Math.random() * 100;
    const delay = Math.random() * 0.3;
    const duration = Math.random() * 1 + 1;
    const rotation = Math.random() * 360;
    el.style.cssText = `position:absolute;top:-10px;left:${x}%;width:${size}px;height:${size}px;background:${color};border-radius:${Math.random() > 0.5 ? '50%' : '2px'};transform:rotate(${rotation}deg);animation:confetti-fall ${duration}s ${delay}s ease-out forwards;`;
    container.appendChild(el);
  }
  const style = document.createElement('style');
  style.textContent = `@keyframes confetti-fall { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }`;
  container.appendChild(style);
  setTimeout(() => container.remove(), 2500);
}

export default function HojePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [financial, setFinancial] = useState<FinancialEntry[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  // Revisão semanal combinada para segunda: lembrar até ela ser feita na semana.
  const [reviewDue, setReviewDue] = useState(false);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const now = new Date(); const monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
        const last = localStorage.getItem('lifesystem-last-weekly-review');
        setReviewDue(!last || new Date(last) < monday);
      } catch { /* sem armazenamento, sem lembrete */ }
    });
  }, []);
  const [configuredStages, setStages] = useState<StageDef[]>(DEFAULT_STAGES.tasks);
  const stages = resolveTaskStages(configuredStages, tasks);
  const pendingTaskIds = useRef(new Set<string>());
  const previousStatuses = useRef(new Map<string, string>());
  const recurringCreated = useRef(new Set<string>());
  const [busyTasks, setBusyTasks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [t, i, p, c, f, j, stageConfig] = await Promise.all([
        apiFetch<Task[]>('/api/tasks'),
        apiFetch<Indicator[]>('/api/indicators'),
        apiFetch<Pillar[]>('/api/pillars'),
        apiFetch<ContentItem[]>('/api/content'),
        apiFetch<FinancialEntry[]>('/api/financial'),
        apiFetch<JournalEntry[]>('/api/journal'),
        apiFetch<{ stages: StageDef[] }>('/api/stage-configs/tasks'),
      ]);
      void apiFetch<Capture[]>('/api/captures').then(setCaptures).catch(() => {});
      void apiFetch<Project[]>('/api/projects').then(setProjects).catch(() => {});
      setStages(stageConfig.stages); setTasks(t); setIndicators(i); setPillars(p); setContent(c); setFinancial(f); setJournal(j);
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setLoading(false);
    }
  }

  async function toggleTaskDone(task: Task, restoreStatus?: string) {
    if (pendingTaskIds.current.has(task.id)) return;
    pendingTaskIds.current.add(task.id);
    setBusyTasks(new Set(pendingTaskIds.current));
    const completed = isTaskCompleted(task, stages);
    const nextStatus = restoreStatus || (completed
      ? previousStatuses.current.get(task.id) || taskReopenStatus(stages)
      : taskCompletionStatus(stages));
    let newlyCompleted: Task | undefined;
    try {
      const updated = await apiFetch<Task>(`/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }) });
      setTasks(current => current.map(item => item.id === task.id ? updated : item));
      if (!completed && !restoreStatus) {
        previousStatuses.current.set(task.id, task.status);
        fireConfetti();
        newlyCompleted = updated;
      } else { toast.success('Tarefa reaberta'); }
    } catch (err) { toast.error(showError(err)); }
    finally {
      pendingTaskIds.current.delete(task.id);
      setBusyTasks(new Set(pendingTaskIds.current));
    }
    if (newlyCompleted) {
      const completedTask = newlyCompleted;
      toast.success('Tarefa concluída! 🎉', {
        duration: 10000, description: task.recurring ? 'A próxima ocorrência continua no planejamento.' : task.title,
        action: { label: task.recurring ? 'Reabrir' : 'Desfazer', onClick: () => { void toggleTaskDone(completedTask, task.status); } },
      });
      if (!recurringCreated.current.has(task.id)) {
        recurringCreated.current.add(task.id);
        try {
          const next = await spawnNextOccurrenceIfRecurring(task, taskReopenStatus(stages));
          if (next) setTasks(current => current.some(item => item.id === next.id) ? current : [...current, next]);
        } catch (err) {
          recurringCreated.current.delete(task.id);
          toast.error(`Tarefa concluída, mas a próxima ocorrência não foi criada: ${showError(err)}`);
        }
      }
    }
  }

  async function incrementIndicator(indicator: Indicator, delta: number) {
    const newVal = Math.max(0, (indicator.currentValue || 0) + delta);
    const history = [...(indicator.history || []), newVal].slice(-12);
    try {
      await apiFetch(`/api/indicators/${indicator.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentValue: newVal, history }) });
      loadAll();
    } catch (err) { toast.error(showError(err)); }
  }

  const today = todayStr();
  const open = tasks.filter(t => !isTaskCompleted(t, stages) && !t.waitingFor);
  const todayTasks = open.filter(t => t.dueDate === today);
  const overdueTasks = open.filter(t => t.dueDate && t.dueDate < today);
  const waitingCount = tasks.filter(t => !isTaskCompleted(t, stages) && t.waitingFor).length;
  const completedToday = tasks.filter(task => isTaskCompleted(task, stages) && (
    task.completedAt ? todayStr(new Date(task.completedAt)) === today : task.dueDate === today
  )).sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
  // O dia em ordem: urgente, importante, normal; dentro de cada nível, atrasadas primeiro.
  const rank = { urgent: 0, important: 1, normal: 2 } as const;
  const ordered = [...overdueTasks, ...todayTasks].sort((a, b) => {
    const late = Number(Boolean(b.dueDate && b.dueDate < today)) - Number(Boolean(a.dueDate && a.dueDate < today));
    return rank[a.priority] - rank[b.priority] || late || (a.dueDate || '').localeCompare(b.dueDate || '');
  });
  const priorities = ordered.slice(0, 3);
  const others = ordered.slice(3);
  // The persisted domain value is `daily`; accept the historical Portuguese
  // label too so older records keep appearing in the daily cockpit.
  const dailyIndicators = indicators.filter(i => i.frequency === 'daily' || i.frequency === 'Diário');
  const todayContent = content.filter(c => c.scheduledDate === today);
  const todayFinancial = financial.filter(f => f.dueDate === today && f.status !== 'paid');
  const hasJournalToday = journal.some(j => j.entryDate === today);
  const inboxCount = captures.filter(c => c.status === 'inbox').length;
  const agendaCount = todayContent.length + todayFinancial.length;

  function taskRow(task: Task, big: boolean) {
    const late = Boolean(task.dueDate && task.dueDate < today);
    const project = task.projectId ? projects.find(p => p.id === task.projectId)?.name : undefined;
    return <motion.div key={task.id} layout exit={{ opacity: 0, x: -10 }} className={cn('today-task', big && 'is-big', `is-${task.priority}`)}>
      <Button variant="ghost" className="today-check" disabled={busyTasks.has(task.id)} aria-label={`Concluir tarefa ${task.title}`} onClick={() => toggleTaskDone(task)}><Circle className="h-5 w-5" /></Button>
      <div className="today-task-body">
        <Link href={`/tarefas?open=${encodeURIComponent(task.id)}`} className="today-task-title">{task.title}</Link>
        <span className="today-task-meta">
          {late && <span className="is-late">atrasada · {new Date(task.dueDate! + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span>}
          {task.priority !== 'normal' && <span className={`is-${task.priority}`}>{task.priority === 'urgent' ? 'Urgente' : 'Importante'}</span>}
          {project && <span>{project}</span>}
          {task.recurring && <Repeat className="h-3 w-3" />}
        </span>
      </div>
      {big && <Link href={`/tarefas?view=focus&open=${encodeURIComponent(task.id)}`} className="today-focus-link" aria-label={`Focar em ${task.title}`}><Crosshair className="h-4 w-4" /></Link>}
    </motion.div>;
  }

  return (
    <motion.div className="work-page today-page mx-auto max-w-[1180px] p-4 pb-24 lg:p-8" variants={stagger} initial="initial" animate="animate">
      <header className="today-head">
        <div>
          <p className="today-date" suppressHydrationWarning>{loading ? ' ' : new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="font-display">Hoje</h1>
        </div>
        {reviewDue && <Link href="/revisao" className="today-inbox today-review"><History className="h-4 w-4" />Revisão semanal pendente</Link>}
        {inboxCount > 0 && <Link href="/inbox" className="today-inbox"><Inbox className="h-4 w-4" />{inboxCount} na caixa para esclarecer</Link>}
        <Button asChild className="ml-auto"><Link href={priorities[0] ? `/tarefas?view=focus&open=${encodeURIComponent(priorities[0].id)}` : '/tarefas?view=focus'}><Crosshair className="h-4 w-4" />Começar Foco</Link></Button>
      </header>

      {loading ? <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div> : (
        <div className="today-grid">
          <section className="today-main" aria-label="Prioridades de hoje">
            {priorities.length === 0 ? <div className="today-clear">
              <PartyPopper className="h-8 w-8" />
              <h2>Tudo em dia!</h2>
              <p>Nada pendente pra hoje. Puxe algo do backlog ou descanse.</p>
              <Link href="/tarefas" className="work-action-link">Abrir tarefas<ArrowRight className="h-4 w-4" /></Link>
            </div> : <>
              <h2 className="today-label">{priorities.length === 1 ? 'Sua prioridade' : `Suas ${priorities.length} prioridades`}</h2>
              <AnimatePresence initial={false}>{priorities.map(task => taskRow(task, true))}</AnimatePresence>
              {others.length > 0 && <>
                <h2 className="today-label mt-6">Também para hoje · {others.length}</h2>
                <AnimatePresence initial={false}>{others.map(task => taskRow(task, false))}</AnimatePresence>
              </>}
            </>}

            <section aria-label="Concluídas hoje" className="today-done">
              <div className="today-done-head"><h2 className="today-label"><CheckCircle2 className="h-4 w-4 text-money" />Concluídas hoje · {completedToday.length}</h2><Link href="/tarefas?completed=1" className="text-xs text-primary hover:underline">Ver todas as concluídas</Link></div>
              {completedToday.length === 0 && <p className="text-sm text-muted-foreground">Suas conclusões aparecem aqui.</p>}
              {completedToday.map(task => <div key={task.id} className="today-task is-done">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-money" />
                <Link href={`/tarefas?open=${encodeURIComponent(task.id)}`} className="today-task-title flex-1">{task.title}</Link>
                <Button variant="ghost" size="sm" disabled={busyTasks.has(task.id)} aria-label={`Reabrir tarefa ${task.title}`} onClick={() => toggleTaskDone(task)}>Reabrir</Button>
              </div>)}
            </section>
          </section>

          <aside className="today-side">
            {agendaCount > 0 && <section aria-label="Agenda de hoje" className="today-card">
              <h2 className="today-label">Agenda de hoje</h2>
              {todayContent.map(item => <Link key={item.id} href="/conteudo" className="today-side-row"><FileText className="h-4 w-4 text-orange-400" /><span>{item.title}</span><small>{item.channel}</small></Link>)}
              {todayFinancial.map(entry => <Link key={entry.id} href="/financeiro" className="today-side-row"><Wallet className="h-4 w-4 text-emerald-400" /><span>{entry.description || entry.category}</span><small className={entry.type === 'income' ? 'text-money' : 'text-destructive'}>R$ {entry.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</small></Link>)}
            </section>}

            {dailyIndicators.length > 0 && <section aria-label="Metas do dia" className="today-card">
              <h2 className="today-label"><Sparkles className="h-4 w-4 text-primary" />Metas do dia</h2>
              {dailyIndicators.map(ind => {
                const pillar = pillars.find(p => p.id === ind.pillarId);
                const done = (ind.currentValue || 0) >= (ind.targetValue || 1);
                return <div key={ind.id} className={cn('today-habit', done && 'is-done')}>
                  <span className="shrink-0">{pillar?.icon}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{ind.name}</span>
                  <span className="font-mono-num text-xs text-muted-foreground">{ind.currentValue || 0}{ind.targetValue ? `/${ind.targetValue}` : ''}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Diminuir ${ind.name}`} onClick={() => incrementIndicator(ind, -1)}><Minus className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Aumentar ${ind.name}`} onClick={() => incrementIndicator(ind, 1)}><Plus className="h-3 w-3" /></Button>
                </div>;
              })}
            </section>}

            <nav className="today-card today-links" aria-label="Atalhos do dia">
              {!hasJournalToday && <Link href="/diario" className="today-side-row"><BookOpen className="h-4 w-4 text-sky-400" /><span>Escrever o diário de hoje</span><ArrowRight className="h-3.5 w-3.5" /></Link>}
              {waitingCount > 0 && <Link href="/tarefas" className="today-side-row"><Hourglass className="h-4 w-4 text-amber-400" /><span>{waitingCount} aguardando outras pessoas</span><ArrowRight className="h-3.5 w-3.5" /></Link>}
              <Link href="/planejar" className="today-side-row"><Wand2 className="h-4 w-4 text-primary" /><span>Planejar horários do dia</span><ArrowRight className="h-3.5 w-3.5" /></Link>
            </nav>
          </aside>
        </div>
      )}
    </motion.div>
  );
}
