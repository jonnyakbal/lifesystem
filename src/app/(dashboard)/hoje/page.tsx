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
  CheckCircle2, Circle, AlertTriangle, Sparkles, FileText,
  Wallet, BookOpen, ArrowRight, Plus, Minus, PartyPopper, Repeat,
} from 'lucide-react';
import { WorkspaceHeading, WorkspaceMetric } from '@/components/workspace/workspace-heading';
import type { StageDef } from '@/types';
import { DEFAULT_STAGES } from '@/lib/default-stages';
import { isTaskCompleted, resolveTaskStages, taskCompletionStatus, taskReopenStatus } from '@/lib/task-stages';
import { cn, todayStr } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import { spawnNextOccurrenceIfRecurring, type RecurringFrequency } from '@/lib/recurring';

interface Task {
  id: string; title: string; status: string; completedAt?: string;
  priority: 'urgent' | 'important' | 'normal'; dueDate?: string;
  description?: string; projectId?: string; pillarId?: string; tags?: string[];
  recurring?: boolean; recurringFrequency?: RecurringFrequency;
}
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

const fade = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };
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
  const todayTasks = tasks.filter(t => !isTaskCompleted(t, stages) && t.dueDate === today);
  const overdueTasks = tasks.filter(t => !isTaskCompleted(t, stages) && t.dueDate && t.dueDate < today);
  const completedToday = tasks.filter(task => isTaskCompleted(task, stages) && (
    task.completedAt ? todayStr(new Date(task.completedAt)) === today : task.dueDate === today
  )).sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
  // The persisted domain value is `daily`; accept the historical Portuguese
  // label too so older records keep appearing in the daily cockpit.
  const dailyIndicators = indicators.filter(i => i.frequency === 'daily' || i.frequency === 'Diário');
  const todayContent = content.filter(c => c.scheduledDate === today);
  const todayFinancial = financial.filter(f => f.dueDate === today && f.status !== 'paid');
  const hasJournalToday = journal.some(j => j.entryDate === today);

  const nothingDue = todayTasks.length === 0 && overdueTasks.length === 0 && dailyIndicators.every(i => (i.currentValue || 0) >= (i.targetValue || 1))
    && todayContent.length === 0 && todayFinancial.length === 0 && hasJournalToday;

  const priorityConfig = {
    urgent: { label: 'Urgente', color: 'text-red-500', border: 'border-l-red-500' },
    important: { label: 'Importante', color: 'text-amber-500', border: 'border-l-amber-500' },
    normal: { label: 'Normal', color: 'text-muted-foreground', border: 'border-l-transparent' },
  };

  return (
    <motion.div className="work-page work-today p-4 sm:p-8" variants={stagger} initial="initial" animate="animate">
      <WorkspaceHeading eyebrow={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} title="Hoje" description="Abra espaço para o que importa. Seu dia, com intenção." actions={<Link href="/planejar" className="work-action-link">Planejar meu dia <ArrowRight className="h-4 w-4" /></Link>}>
        <div className="work-metrics">
          <WorkspaceMetric label="Seu foco" value={todayTasks.length} detail="tarefas para hoje" tone="primary" />
          <WorkspaceMetric label="Para retomar" value={overdueTasks.length} detail="tarefas aguardando um novo passo" tone={overdueTasks.length ? 'warning' : 'default'} />
          <WorkspaceMetric label="Pequenas conquistas" value={`${dailyIndicators.filter(ind => (ind.currentValue || 0) >= (ind.targetValue || 1)).length}/${dailyIndicators.length}`} detail="metas diárias alcançadas" />
        </div>
      </WorkspaceHeading>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : nothingDue ? (
        <motion.div variants={fade}>
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <PartyPopper className="h-10 w-10 text-money mb-3" />
              <p className="text-lg font-medium">Tudo em dia!</p>
              <p className="text-sm text-muted-foreground">Nada pendente pra hoje.</p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="work-today-grid">
          {overdueTasks.length > 0 && (
            <motion.div className="work-today-overdue" variants={fade}>
              <Card className="border-destructive/40 bg-destructive/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-destructive">
                    <AlertTriangle className="h-4 w-4" /> Atrasadas ({overdueTasks.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  <AnimatePresence initial={false}>
                    {overdueTasks.map(task => (
                      <motion.div
                        key={task.id}
                        exit={{ opacity: 0, x: -10 }}
                        className="work-today-task"
                      >
                        <Link href={`/tarefas?open=${encodeURIComponent(task.id)}`} className="flex-1 rounded-md py-2 text-sm font-medium leading-relaxed hover:underline focus-visible:ring-2 focus-visible:ring-primary">{task.title}</Link>
                        <span className="text-xs text-destructive">{new Date(task.dueDate! + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span>
                        <Button variant="outline" className="min-h-11 shrink-0 gap-2" disabled={busyTasks.has(task.id)} aria-label={`Concluir tarefa ${task.title}`} onClick={() => toggleTaskDone(task)}><Circle className="h-4 w-4" />Concluir</Button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {dailyIndicators.length > 0 && (
            <motion.div className="work-today-habits" variants={fade}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-purple-500" /> Metas do dia
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {dailyIndicators.map(ind => {
                    const pillar = pillars.find(p => p.id === ind.pillarId);
                    const done = (ind.currentValue || 0) >= (ind.targetValue || 1);
                    return (
                      <div key={ind.id} className={cn('flex items-center gap-3 rounded-xl border border-border/50 bg-background/30 px-4 py-3', done && 'border-money/40 bg-money/5')}>
                        <span className="shrink-0">{pillar?.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-relaxed">{ind.name}</p>
                          <p className="mt-1 font-mono-num text-xs text-muted-foreground">{ind.currentValue || 0}{ind.targetValue ? ` / ${ind.targetValue}` : ''}</p><div className="mt-2 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (ind.currentValue || 0) / (ind.targetValue || 1) * 100)}%` }} /></div>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Diminuir ${ind.name}`} onClick={() => incrementIndicator(ind, -1)}><Minus className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Aumentar ${ind.name}`} onClick={() => incrementIndicator(ind, 1)}><Plus className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Só renderiza com conteúdo — card "vazio" aqui é ruído, o estado
              "nada pendente" já é coberto pelo bloco Tudo em dia! acima. */}
          {todayTasks.length > 0 && (
            <motion.div className="work-today-focus" variants={fade}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CheckCircle2 className="h-4 w-4 text-blue-500" /> Tarefas de hoje ({todayTasks.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  <AnimatePresence initial={false}>
                    {todayTasks.map(task => {
                      const pc = priorityConfig[task.priority];
                      return (
                        <motion.div
                          key={task.id}
                          exit={{ opacity: 0, x: -10 }}
                          className={cn('work-today-task border-l-2', pc.border)}
                        >
                          <Link href={`/tarefas?open=${encodeURIComponent(task.id)}`} className="flex-1 rounded-md py-2 text-sm font-medium leading-relaxed hover:underline focus-visible:ring-2 focus-visible:ring-primary">{task.title}</Link>
                          {task.recurring && <Repeat className="h-3 w-3 shrink-0 text-muted-foreground" />}
                          {task.priority !== 'normal' && <span className={cn('text-xs', pc.color)}>{pc.label}</span>}
                          <Button variant="outline" className="min-h-11 shrink-0 gap-2" disabled={busyTasks.has(task.id)} aria-label={`Concluir tarefa ${task.title}`} onClick={() => toggleTaskDone(task)}><Circle className="h-4 w-4" />Concluir</Button>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  <Link href="/tarefas" className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    Ver todas as tarefas <ArrowRight className="h-3 w-3" />
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {todayContent.length > 0 && (
            <motion.div className="work-today-extra" variants={fade}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4 text-orange-500" /> Conteúdo agendado hoje
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {todayContent.map(item => (
                    <Link key={item.id} href="/conteudo" className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                      <span className="flex-1 truncate">{item.title}</span>
                      <Badge variant="outline" className="text-xs">{item.channel}</Badge>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {todayFinancial.length > 0 && (
            <motion.div className="work-today-extra" variants={fade}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Wallet className="h-4 w-4 text-emerald-500" /> Vence hoje
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {todayFinancial.map(entry => (
                    <Link key={entry.id} href="/financeiro" className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                      <span className="flex-1 truncate">{entry.description || entry.category}</span>
                      <span className={cn('text-xs font-medium', entry.type === 'income' ? 'text-money' : 'text-destructive')}>
                        R$ {entry.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {!hasJournalToday && (
            <motion.div className="work-today-journal" variants={fade}>
              <Link href="/diario">
                <Card className="border-dashed transition-colors hover:border-primary/40 hover:bg-muted/20">
                  <CardContent className="flex items-center gap-3 py-4">
                    <BookOpen className="h-4 w-4 shrink-0 text-blue-500" />
                    <span className="flex-1 text-sm text-muted-foreground">Diário de hoje ainda não preenchido</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          )}
        </div>
      )}
      {!loading && <section aria-label="Concluídas hoje" className="mt-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4 text-money" />Concluídas hoje ({completedToday.length})</CardTitle>
            <Link href="/tarefas?completed=1" className="text-xs text-primary hover:underline">Ver todas as concluídas</Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {completedToday.length === 0 && <p className="text-sm text-muted-foreground">Suas conclusões ficam aqui. Clique no título para abrir; use Concluir para finalizar.</p>}
            {completedToday.map(task => <div key={task.id} className="work-today-task">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-money" />
              <Link href={`/tarefas?open=${encodeURIComponent(task.id)}`} className="flex-1 py-2 text-sm font-medium hover:underline">{task.title}</Link>
              <Button variant="outline" className="min-h-11 shrink-0" disabled={busyTasks.has(task.id)} aria-label={`Reabrir tarefa ${task.title}`} onClick={() => toggleTaskDone(task)}>Reabrir</Button>
            </div>)}
          </CardContent>
        </Card>
      </section>}
    </motion.div>
  );
}
