'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Inbox, Layers, FolderKanban, CheckSquare, BarChart3, TrendingUp, Clock,
  AlertTriangle, Wallet, BookOpen, ArrowRight, Circle, CheckCircle2, Flame,
  Calendar, Plus, Newspaper, Sparkles, TrendingDown, CircleDot, Target,
  Zap, Home, Activity, BarChart4
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';

interface Task {
  id: string;
  title: string;
  status: 'todo' | 'doing' | 'review' | 'done';
  priority: 'urgent' | 'important' | 'normal';
  dueDate?: string;
  createdAt: string;
  projectId?: string;
  pillarId?: string;
}

interface Capture {
  id: string;
  title?: string;
  content: string;
  type: string;
  category?: string;
  createdAt: string;
}

interface FinancialEntry {
  id: string;
  type: string;
  amount: number;
  date: string;
  category: string;
}

interface JournalEntry {
  id: string;
  content: string;
  mood?: string;
  entryDate: string;
  pillarChecks: Record<string, number>;
}

interface Project {
  id: string;
  name: string;
  status: 'active' | 'development' | 'paused' | 'idea';
  emoji?: string;
  coverUrl?: string;
  coverColor?: string;
}

interface Pillar {
  id: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
}

interface Indicator {
  id: string;
  pillarId: string;
  name: string;
  targetValue?: number;
  currentValue?: number;
}

interface Content {
  id: string;
  title: string;
  stage: string;
  channel: string;
}

interface Budget {
  id: string;
  category: string;
  monthlyLimit: number;
  spent: number;
  month: string;
}

const fade = { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 } };
const stagger = { animate: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } };

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const duration = 600;
    const startTime = performance.now();
    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [value]);
  return <span>{display}</span>;
}

function timeAgo(date: string) {
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function MiniProgressRing({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const r = 16;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0">
      <circle cx="20" cy="20" r={r} fill="none" stroke="currentColor" className="text-muted/40" strokeWidth="3" />
      <circle
        cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 20 20)"
        className="transition-all duration-700 ease-out"
      />
      <text x="20" y="20" textAnchor="middle" dominantBaseline="central"
        className="fill-foreground text-xs font-bold font-mono-num">
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

const stageLabels: Record<string, string> = {
  idea: 'Ideia', draft: 'Roteiro', review: 'Produção', scheduled: 'Agendado', published: 'Publicado', archived: 'Arquivado',
};

const stageColors: Record<string, string> = {
  idea: 'bg-muted-foreground/30', draft: 'bg-primary/60', review: 'bg-stellar/60', scheduled: 'bg-qty/60', published: 'bg-money/60', archived: 'bg-muted',
};

const moodEmoji: Record<string, string> = { great: '😄', good: '😊', neutral: '😐', bad: '😔', terrible: '😢' };
const moodColor: Record<string, string> = { great: '#22c55e', good: '#86efac', neutral: '#eab308', bad: '#f97316', terrible: '#ef4444' };

const priorityConfig: Record<string, { label: string; color: string; dot: string; borderColor: string }> = {
  urgent: { label: 'Urgente', color: 'bg-destructive', dot: 'bg-destructive', borderColor: 'border-l-destructive' },
  important: { label: 'Importante', color: 'bg-primary', dot: 'bg-primary', borderColor: 'border-l-primary' },
  normal: { label: 'Normal', color: 'bg-muted', dot: 'bg-muted-foreground', borderColor: 'border-l-muted' },
};

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  todo: { label: 'A fazer', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  doing: { label: 'Fazendo', color: 'text-primary', dot: 'bg-primary' },
  review: { label: 'Revisão', color: 'text-qty', dot: 'bg-qty' },
  done: { label: 'Concluída', color: 'text-money', dot: 'bg-money' },
};

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [financial, setFinancial] = useState<FinancialEntry[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [contentItems, setContentItems] = useState<Content[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [quickAddValue, setQuickAddValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadAll() {
      try {
        const [tasksData, capturesData, financialData, journalData, projectsData, pillarsData, indicatorsData, contentData, budgetsData] = await Promise.all([
          fetch('/api/tasks').then(r => r.json()),
          fetch('/api/captures').then(r => r.json()),
          fetch('/api/financial').then(r => r.json()),
          fetch('/api/journal').then(r => r.json()),
          fetch('/api/projects').then(r => r.json()),
          fetch('/api/pillars').then(r => r.json()),
          fetch('/api/indicators').then(r => r.json()),
          fetch('/api/content').then(r => r.json()),
          fetch('/api/budgets').then(r => r.json()),
        ]);
        setTasks(tasksData);
        setCaptures(capturesData);
        setFinancial(financialData);
        setJournalEntries(journalData);
        setProjects(projectsData);
        setPillars(pillarsData.sort((a: Pillar, b: Pillar) => a.sortOrder - b.sortOrder));
        setIndicators(indicatorsData);
        setContentItems(contentData);
        setBudgets(budgetsData);
      } catch (err) {
        toast.error(showError(err));
      } finally {
        setIsLoading(false);
      }
    }
    loadAll();
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const todayTasks = tasks.filter(t => t.dueDate === today && t.status !== 'done');
  const tasksDone = tasks.filter(t => t.status === 'done').length;
  const currentMonth = today.substring(0, 7);
  const monthFinancial = financial.filter(e => e.date.startsWith(currentMonth));
  const totalIncome = monthFinancial.filter(e => e.type === 'income').reduce((a, e) => a + e.amount, 0);
  const totalExpenses = monthFinancial.filter(e => e.type !== 'income').reduce((a, e) => a + e.amount, 0);
  const balance = totalIncome - totalExpenses;
  const todayJournal = journalEntries.find(e => e.entryDate === today);
  const recentCaptures = captures.slice(0, 6);
  const recentTasks = [...tasks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
  const overBudgetBudgets = budgets.filter(b => b.month === currentMonth && b.spent > b.monthlyLimit);

  const pillarProgress = useMemo(() => pillars.map(p => {
    const pillarIndicators = indicators.filter(i => i.pillarId === p.id);
    const total = pillarIndicators.reduce((a, i) => a + (i.targetValue || 0), 0);
    const current = pillarIndicators.reduce((a, i) => a + (i.currentValue || 0), 0);
    return { ...p, total, current, indicatorCount: pillarIndicators.length };
  }), [pillars, indicators]);

  const contentByStage = useMemo(() => {
    const counts: Record<string, number> = { idea: 0, draft: 0, review: 0, scheduled: 0, published: 0 };
    contentItems.forEach(c => { if (counts[c.stage] !== undefined) counts[c.stage]++; });
    return counts;
  }, [contentItems]);

  const last7Days = useMemo(() => {
    const days: { date: string; label: string; journal?: JournalEntry }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        date: dateStr,
        label: d.toLocaleDateString('pt-BR', { weekday: 'short' }).substring(0, 3),
        journal: journalEntries.find(j => j.entryDate === dateStr),
      });
    }
    return days;
  }, [journalEntries]);

  function getWeekStreak() {
    let streak = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const hasEntry = journalEntries.find(j => j.entryDate === dateStr);
      if (hasEntry) streak++; else break;
    }
    return streak;
  }

  const weekStreak = getWeekStreak();
  const completionRate = tasks.length > 0 ? Math.round((tasksDone / tasks.length) * 100) : 0;
  const overdueTasks = tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done');

  const handleQuickAdd = useCallback(async () => {
    const title = quickAddValue.trim();
    if (!title || isAdding) return;
    setIsAdding(true);
    try {
      await apiFetch('/api/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, status: 'todo', priority: 'normal' }),
      });
      setQuickAddValue('');
      toast.success('Tarefa adicionada!');
      // Reload tasks
      const data = await apiFetch<Task[]>('/api/tasks');
      setTasks(data);
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setIsAdding(false);
    }
  }, [quickAddValue, isAdding]);

  const statCards = [
    { title: 'Capturas', value: captures.length, icon: Inbox, href: '/inbox', color: 'text-qty', className: 'kpi-capturas', subtitle: 'Capturadas' },
    { title: 'Tarefas', value: tasks.length, icon: CheckSquare, href: '/tarefas', color: 'text-primary', className: 'kpi-tarefas', subtitle: 'Total' },
    { title: 'Concluídas', value: tasksDone, icon: BarChart3, href: '/tarefas', color: 'text-money', className: 'kpi-concluidas', subtitle: 'Finalizadas' },
    { title: 'Projetos', value: projects.length, icon: FolderKanban, href: '/projetos', color: 'text-stellar', className: 'kpi-projetos', subtitle: 'Ativos' },
    { title: 'Pilares', value: pillars.length, icon: Layers, href: '/pilares', color: 'text-critical', className: 'kpi-pilares', subtitle: 'Monitorados' },
  ];

  return (
    <motion.div className="p-4 lg:p-8" variants={stagger} initial="initial" animate="animate">
      {/* ─── Hero Section with Gradient ─── */}
      <motion.div className="mb-8" variants={fade}>
        <div className="relative mb-6 overflow-hidden">
          <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-shimmer">
            Command Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>

          {/* Aurora background decoration */}
          <div className="absolute -top-4 -right-4 w-32 h-32 opacity-20 pointer-events-none">
            <Sparkles className="h-32 w-32 text-primary animate-pulse" />
          </div>
        </div>

        {/* Quick Add */}
        <div className="flex items-center gap-2 rounded-xl border-2 border-primary/20 bg-card px-4 py-2.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 transition-all hover:border-primary/50">
          <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Adicionar tarefa rápida..."
            value={quickAddValue}
            onChange={e => setQuickAddValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd(); }}
            disabled={isAdding}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
          />
          {quickAddValue.trim() && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleQuickAdd} disabled={isAdding}>
                <CheckCircle2 className="h-3 w-3" />
              </Button>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* ─── Stats Row (5 Cards) ─── */}
      <motion.div className="mb-6" variants={fade}>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-4 rounded" />
                </CardHeader>
                <CardContent><Skeleton className="h-8 w-12" /></CardContent>
              </Card>
            ))
          ) : (
            statCards.map((card) => (
              <motion.div key={card.title} variants={fade}>
                <Link href={card.href}>
                  <Card className={cn("group transition-all border-2 hover:shadow-lg", card.className)}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-3">
                      <CardTitle className="text-xs font-medium text-muted-foreground">{card.title}</CardTitle>
                      <motion.div whileHover={{ y: -2, scale: 1.1 }} transition={{ type: 'spring', stiffness: 400, damping: 17 }}>
                        <card.icon className={cn('h-3.5 w-3.5', card.color)} />
                      </motion.div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div className="text-xl font-bold"><AnimatedNumber value={card.value} /></div>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">{card.subtitle}</p>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>

      {/* ─── Critical Alert Bar ─── */}
      {overdueTasks.length > 0 && (
        <motion.div className="mb-6" variants={fade}>
          <Card className="border-destructive/50 bg-destructive/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-destructive/5 opacity-30" />
            <CardHeader className="flex flex-row items-center gap-2 pb-3 relative z-10">
              <AlertTriangle className="h-4 w-4 text-destructive animate-pulse" />
              <CardTitle className="text-sm font-semibold text-destructive">Atenção: {overdueTasks.length} tarefa{overdueTasks.length > 1 ? 's' : ''} atrasada{overdueTasks.length > 1 ? 's' : ''}</CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="flex flex-wrap gap-2">
                {overdueTasks.slice(0, 3).map(task => (
                  <Badge key={task.id} variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {task.title}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── Main Content Grid ─── */}
      <div className="grid gap-6 xl:grid-cols-12">
        {/* ─── LEFT COLUMN (7 cols) ─── */}
        <div className="xl:col-span-8 space-y-6">
          {/* Today's Tasks - Enhanced */}
          <motion.div variants={fade}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4 text-primary" />
                  Tarefas de Hoje
                  {todayTasks.length > 0 && <Badge variant="secondary" className="ml-1 text-xs h-5">{todayTasks.length}</Badge>}
                </CardTitle>
                <Link href="/tarefas">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs">
                    Ver todas <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3"><Skeleton className="h-4 w-4 rounded-full" /><Skeleton className="h-4 w-full" /></div>
                    ))}
                  </div>
                ) : todayTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6">
                    <CheckCircle2 className="h-8 w-8 text-muted-foreground/20 mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma tarefa para hoje 🎉</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {todayTasks.slice(0, 5).map(task => (
                      <div key={task.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 transition-colors group">
                        <div className={cn('h-2 w-2 rounded-full shrink-0', priorityConfig[task.priority]?.dot)} />
                        <span className="text-sm flex-1 truncate group-hover:text-foreground transition-colors">{task.title}</span>
                        <Badge variant="outline" className={cn('text-xs px-1.5 py-0',
                          task.priority === 'urgent' ? 'border-destructive text-destructive' :
                          task.priority === 'important' ? 'border-primary text-primary' :
                          'text-muted-foreground'
                        )}>
                          {priorityConfig[task.priority]?.label}
                        </Badge>
                        {task.projectId && (() => {
                          const proj = projects.find(p => p.id === task.projectId);
                          return proj ? <Badge variant="secondary" className="text-xs px-1.5 py-0">{proj.emoji || '📁'}</Badge> : null;
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Content Pipeline - Enhanced */}
          <motion.div variants={fade}>
            <Card className="border-stellar/20 bg-stellar/5">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Newspaper className="h-4 w-4 text-stellar" />
                  Pipeline de Conteúdo
                </CardTitle>
                <Link href="/conteudo">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs">
                    Ver tudo <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-6 w-full" />
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-3 flex-wrap">
                      {Object.entries(contentByStage).map(([stage, count]) => (
                        <div key={stage} className="flex items-center gap-1.5">
                          <span className={cn('h-2.5 w-2.5 rounded-full', stageColors[stage])} />
                          <span className="text-xs text-muted-foreground">{stageLabels[stage]}</span>
                          <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 font-mono-num">{count}</Badge>
                        </div>
                      ))}
                    </div>
                    {(() => {
                      const total = Object.values(contentByStage).reduce((a, b) => a + b, 0);
                      if (total === 0) return <p className="text-xs text-muted-foreground">Nenhum conteúdo cadastrado</p>;
                      return (
                        <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-muted/50">
                          {Object.entries(contentByStage).map(([stage, count]) => {
                            const pct = (count / total) * 100;
                            if (pct === 0) return null;
                            return (
                              <motion.div key={stage} className={cn('h-full rounded-full', stageColors[stage])}
                                initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut' }} />
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Captures - Enhanced */}
          <motion.div variants={fade}>
            <Card className="border-qty/20 bg-qty/5">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="h-4 w-4 text-qty" />
                  Últimas Capturas
                </CardTitle>
                <Link href="/inbox">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs">
                    Ver todas <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3"><Skeleton className="h-4 w-full" /></div>
                    ))}
                  </div>
                ) : recentCaptures.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6">
                    <Inbox className="h-8 w-8 text-muted-foreground/20 mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma captura ainda</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {recentCaptures.map(capture => (
                      <div key={capture.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 transition-colors">
                        <span className="text-xs text-muted-foreground shrink-0 w-12">{timeAgo(capture.createdAt)}</span>
                        <span className="text-sm truncate flex-1">{capture.title || capture.content.slice(0, 50) + '...'}</span>
                        <Badge variant="secondary" className="text-xs px-1 py-0 shrink-0">{capture.category || 'Geral'}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* ─── RIGHT COLUMN (5 cols) ─── */}
        <div className="xl:col-span-4 space-y-6">
          {/* Summary Card */}
          <motion.div variants={fade}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Resumo Geral
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex justify-between"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-4 w-12" /></div>
                  ))
                ) : (
                  <>
                    <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Total de Tarefas</span>
                      <span className="font-mono-num text-lg">{tasks.length}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Concluídas</span>
                      <span className="font-mono-num text-lg text-money">{tasksDone}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Pendentes</span>
                      <span className="font-mono-num text-lg text-destructive">{tasks.filter(t => t.status !== 'done').length}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Capturas</span>
                      <span className="font-mono-num text-lg text-qty">{captures.length}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-muted-foreground">Projetos Ativos</span>
                      <span className="font-mono-num text-lg text-stellar">{projects.filter(p => p.status === 'active' || p.status === 'development').length}</span>
                    </div>
                    <div className="pt-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Taxa de Conclusão</span>
                        <span className="font-mono-num text-money">{completionRate}%</span>
                      </div>
                      <Progress value={completionRate} className="h-2" />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Financial Snapshot */}
          <motion.div variants={fade}>
            <Card className="border-money/20 bg-money/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="h-4 w-4 text-money" />
                  Financeiro
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2"><Skeleton className="h-6 w-full" /><Skeleton className="h-4 w-2/3" /></div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-center">
                      <motion.span
                        className="text-2xl font-bold text-money font-mono-num"
                        key={balance}
                        initial={{ scale: 0.9, opacity: 0.5 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      >
                        R$ {balance.toLocaleString('pt-BR')}
                      </motion.span>
                      <p className="text-sm text-muted-foreground mt-0.5">Saldo atual</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Entradas</p>
                        <p className="text-base font-bold text-money font-mono-num">R$ {totalIncome.toLocaleString('pt-BR')}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Saídas</p>
                        <p className="text-base font-bold text-destructive font-mono-num">R$ {totalExpenses.toLocaleString('pt-BR')}</p>
                      </div>
                    </div>
                    {overBudgetBudgets.length > 0 && (
                      <Badge variant="destructive" className="w-full justify-center text-xs mt-2 gap-1">
                        <AlertTriangle className="h-3 w-3" /> {overBudgetBudgets.length} orçamento{overBudgetBudgets.length > 1 ? 's' : ''} estourado{overBudgetBudgets.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Pillars Progress - Enhanced */}
          <motion.div variants={fade}>
            <Card className="border-critical/20 bg-critical/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="h-4 w-4 text-critical" />
                  Pilares
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-1"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3" /></div>
                  ))
                ) : pillarProgress.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">Nenhum pilar cadastrado</p>
                ) : (
                  pillarProgress.map(p => {
                    const pct = p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;
                    return (
                      <Link key={p.id} href="/pilares" className="flex items-center gap-2 group">
                        <div className="relative">
                          <MiniProgressRing value={p.current} max={p.total} color={p.color || 'hsl(var(--critical))'} />
                          <span className="absolute inset-0 flex items-center justify-center text-xs">{p.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium truncate max-w-[120px]">{p.name}</span>
                            <span className="text-sm text-muted-foreground font-mono-num">{p.indicatorCount}i</span>
                          </div>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                      </Link>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Journal Streak - Enhanced */}
          <motion.div variants={fade}>
            <Card className="border-stellar/20 bg-stellar/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="h-4 w-4 text-stellar" />
                  Diário — Streak
                  {weekStreak > 0 && <Badge variant="secondary" className="ml-1 text-xs h-5 gap-0.5"><Flame className="h-3 w-3 text-orange-500" />{weekStreak}d</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex gap-2 justify-center">
                    {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-8 w-8 rounded-full" />)}
                  </div>
                ) : (
                  <div className="flex gap-2 justify-center">
                    {last7Days.map(day => {
                      const hasEntry = !!day.journal;
                      const mood = day.journal?.mood;
                      const isToday = day.date === today;
                      return (
                        <Link key={day.date} href="/diario" className="flex flex-col items-center gap-0.5 group">
                          <div
                            className={cn(
                              'h-9 w-9 rounded-full flex items-center justify-center text-xs font-medium transition-all relative',
                              !hasEntry && 'bg-muted/50 text-muted-foreground'
                            )}
                            style={hasEntry && mood ? {
                              backgroundColor: moodColor[mood],
                              boxShadow: isToday ? `0 0 0 2px hsl(262 95% 72%)` : undefined,
                            } : undefined}
                          >
                            {hasEntry ? moodEmoji[mood || ''] : day.label.substring(0, 1)}
                          </div>
                          <span className="text-sm text-muted-foreground">{day.label.substring(0, 2)}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
                {todayJournal?.mood && (
                  <div className="mt-3 flex justify-center">
                    <Badge variant="secondary" className="gap-1 text-xs">
                      {moodEmoji[todayJournal.mood]} {todayJournal.mood === 'great' ? 'Ótimo' : todayJournal.mood === 'good' ? 'Bom' : todayJournal.mood === 'neutral' ? 'Neutro' : todayJournal.mood === 'bad' ? 'Ruim' : 'Péssimo'}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* ─── Projects Quick View ─── */}
      <motion.div className="mt-6" variants={fade}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderKanban className="h-4 w-4 text-primary" />
              Projetos Ativos
            </CardTitle>
            <Link href="/projetos">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                Ver todos <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}><CardContent className="p-4">
                    <Skeleton className="h-4 w-3/4 mb-2" /><Skeleton className="h-3 w-full mb-1" /><Skeleton className="h-3 w-1/2" />
                  </CardContent></Card>
                ))}
            </div>
            ) : projects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum projeto</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {projects.filter(p => p.status === 'active' || p.status === 'development').slice(0, 6).map(project => {
                  const statusColorMap = {
                    active: 'text-money', development: 'text-primary', paused: 'text-critical', idea: 'text-muted-foreground',
                  };
                  const statusLabel = { active: 'Ativo', development: 'Dev', paused: 'Parado', idea: 'Ideia' };
                  return (
                    <Link key={project.id} href="/projetos" className="group">
                      <Card className="overflow-hidden transition-all hover:shadow-lg hover:border-primary/50">
                        {(project.coverUrl || project.coverColor) ? (
                          <div className="h-16 relative">
                            {project.coverUrl && <img src={project.coverUrl} alt="" className="w-full h-full object-cover" />}
                            <div className={cn('absolute inset-0', !project.coverUrl && 'bg-gradient-to-br from-primary/30 to-stellar/10')} />
                          </div>
                        ) : (
                          <div className="h-16 bg-gradient-to-br from-muted/30 to-muted/10 flex items-center justify-center text-2xl">
                            {project.emoji || '📁'}
                          </div>
                        )}
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{project.name}</span>
                            <Badge variant="secondary" className={cn('ml-auto text-xs capitalize', statusColorMap[project.status])}>
                              {statusLabel[project.status]}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

export { AnimatedNumber as DashboardAnimatedNumber };
