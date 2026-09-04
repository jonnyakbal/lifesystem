'use client';

// The unified daily view Sunsama/Motion/Things3's "Today" tab all center
// around: what's due today across every entity, in one glance, instead of
// opening 5 separate kanbans/pages to piece it together. The ⌘K palette
// already had a "hoje" quick action pointing nowhere real — this is what
// it should have opened all along.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2, Circle, AlertTriangle, Calendar, Sparkles, FileText,
  Wallet, BookOpen, ArrowRight, Plus, Minus, PartyPopper, Repeat,
} from 'lucide-react';
import { cn, todayStr } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import { spawnNextOccurrenceIfRecurring, type RecurringFrequency } from '@/lib/recurring';

interface Task {
  id: string; title: string; status: 'todo' | 'doing' | 'review' | 'done';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [t, i, p, c, f, j] = await Promise.all([
        apiFetch<Task[]>('/api/tasks'),
        apiFetch<Indicator[]>('/api/indicators'),
        apiFetch<Pillar[]>('/api/pillars'),
        apiFetch<ContentItem[]>('/api/content'),
        apiFetch<FinancialEntry[]>('/api/financial'),
        apiFetch<JournalEntry[]>('/api/journal'),
      ]);
      setTasks(t); setIndicators(i); setPillars(p); setContent(c); setFinancial(f); setJournal(j);
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setLoading(false);
    }
  }

  async function toggleTaskDone(task: Task) {
    try {
      const nextStatus = task.status === 'done' ? 'todo' : 'done';
      await apiFetch(`/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }) });
      if (nextStatus === 'done') {
        fireConfetti();
        toast.success('Tarefa concluída! 🎉');
        await spawnNextOccurrenceIfRecurring(task);
      }
      loadAll();
    } catch (err) { toast.error(showError(err)); }
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
  const todayTasks = tasks.filter(t => t.status !== 'done' && t.dueDate === today);
  const overdueTasks = tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < today);
  const dailyIndicators = indicators.filter(i => i.frequency === 'Diário');
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
    <motion.div className="p-8 max-w-4xl" variants={stagger} initial="initial" animate="animate">
      <motion.div className="mb-8" variants={fade}>
        <h1 className="font-display text-3xl font-bold tracking-tight">Hoje</h1>
        <p className="text-muted-foreground capitalize">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </motion.div>

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
        <div className="space-y-6">
          {overdueTasks.length > 0 && (
            <motion.div variants={fade}>
              <Card className="border-destructive/40 bg-destructive/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-destructive">
                    <AlertTriangle className="h-4 w-4" /> Atrasadas ({overdueTasks.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  <AnimatePresence initial={false}>
                    {overdueTasks.map(task => (
                      <motion.button
                        key={task.id}
                        exit={{ opacity: 0, x: -10 }}
                        onClick={() => toggleTaskDone(task)}
                        className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/50"
                      >
                        <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate">{task.title}</span>
                        <span className="text-xs text-destructive">{task.dueDate}</span>
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {(todayTasks.length > 0 || overdueTasks.length === 0) && (
            <motion.div variants={fade}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CheckCircle2 className="h-4 w-4 text-blue-500" /> Tarefas de hoje ({todayTasks.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {todayTasks.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma tarefa com prazo hoje.</p>
                  ) : (
                    <AnimatePresence initial={false}>
                      {todayTasks.map(task => {
                        const pc = priorityConfig[task.priority];
                        return (
                          <motion.button
                            key={task.id}
                            exit={{ opacity: 0, x: -10 }}
                            onClick={() => toggleTaskDone(task)}
                            className={cn('flex w-full items-center gap-2.5 rounded-md border-l-2 px-2 py-1.5 text-left text-sm hover:bg-muted/50', pc.border)}
                          >
                            <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="flex-1 truncate">{task.title}</span>
                            {task.recurring && <Repeat className="h-3 w-3 shrink-0 text-muted-foreground" />}
                            {task.priority !== 'normal' && <span className={cn('text-xs', pc.color)}>{pc.label}</span>}
                          </motion.button>
                        );
                      })}
                    </AnimatePresence>
                  )}
                  <Link href="/tarefas" className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    Ver todas as tarefas <ArrowRight className="h-3 w-3" />
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {dailyIndicators.length > 0 && (
            <motion.div variants={fade}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-purple-500" /> Metas do dia
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2">
                  {dailyIndicators.map(ind => {
                    const pillar = pillars.find(p => p.id === ind.pillarId);
                    const done = (ind.currentValue || 0) >= (ind.targetValue || 1);
                    return (
                      <div key={ind.id} className={cn('flex items-center gap-2 rounded-lg border px-3 py-2', done && 'border-money/40 bg-money/5')}>
                        <span className="shrink-0">{pillar?.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{ind.name}</p>
                          <p className="text-xs text-muted-foreground">{ind.currentValue || 0}{ind.targetValue ? ` / ${ind.targetValue}` : ''}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => incrementIndicator(ind, -1)}><Minus className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => incrementIndicator(ind, 1)}><Plus className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </motion.div>
          )}

          <motion.div variants={fade}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-orange-500" /> Conteúdo agendado hoje
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {todayContent.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">Nenhum conteúdo agendado hoje.</p>
                ) : (
                  todayContent.map(item => (
                    <Link key={item.id} href="/conteudo" className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                      <span className="flex-1 truncate">{item.title}</span>
                      <Badge variant="outline" className="text-xs">{item.channel}</Badge>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </motion.div>

          {todayFinancial.length > 0 && (
            <motion.div variants={fade}>
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
            <motion.div variants={fade}>
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
    </motion.div>
  );
}
