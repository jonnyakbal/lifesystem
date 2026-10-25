'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Calendar, CheckSquare, Inbox, Plus, RefreshCw, Wallet, BookOpen, FolderKanban } from 'lucide-react';
import { apiFetch, showError } from '@/lib/api';
import { cn, todayStr } from '@/lib/utils';
import { DEFAULT_STAGES } from '@/lib/default-stages';
import { summarizeFinancialMonth } from '@/lib/financial-period';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import type { Task, Capture, FinancialEntry, JournalEntry, Project, Pillar, Indicator, Content, Budget, StageDef } from '@/types';

const sources = ['tasks', 'captures', 'financial', 'journal', 'projects', 'pillars', 'indicators', 'content', 'budgets'] as const;
type Source = typeof sources[number];
interface DashboardData {
  tasks: Task[]; captures: Capture[]; financial: FinancialEntry[]; journal: JournalEntry[];
  projects: Project[]; pillars: Pillar[]; indicators: Indicator[]; content: Content[]; budgets: Budget[];
}
const empty: DashboardData = { tasks: [], captures: [], financial: [], journal: [], projects: [], pillars: [], indicators: [], content: [], budgets: [] };
const sourceLabels: Record<string, string> = { tasks: 'Tarefas', captures: 'Caixa de entrada', financial: 'Financeiro', journal: 'Diário', projects: 'Projetos', pillars: 'Pilares', indicators: 'Metas', content: 'Conteúdo', budgets: 'Orçamentos', taskStages: 'Etapas de tarefas', projectStages: 'Etapas de projetos' };
const moods: Record<string, string> = { great: 'Ótimo', good: 'Bom', neutral: 'Neutro', bad: 'Ruim', terrible: 'Péssimo' };
const money = (value: number) => `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`;

function Section({ title, href, icon, children, label }: { title: string; href: string; icon: ReactNode; children: ReactNode; label?: string }) {
  return <Card role="region" aria-label={label || title} className="h-full min-w-0">
    <CardHeader className="flex flex-row items-center justify-between gap-3 pb-4">
      <CardTitle className="flex min-w-0 items-center gap-2 text-base">{icon}{title}</CardTitle>
      <Link href={href} aria-label={`Abrir ${title}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-primary"><ArrowRight className="h-4 w-4" /></Link>
    </CardHeader><CardContent>{children}</CardContent>
  </Card>;
}
function Unavailable() { return <p className="py-4 text-sm text-muted-foreground">Resumo indisponível. Tente atualizar os dados.</p>; }

export default function HomePage() {
  const [data, setData] = useState<DashboardData>(empty);
  const [stages, setStages] = useState<StageDef[]>(DEFAULT_STAGES.tasks);
  const [projectStages, setProjectStages] = useState<StageDef[]>(DEFAULT_STAGES.projects);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickTitle, setQuickTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const saving = useRef(false);
  const [reviewAge, setReviewAge] = useState<number | null>(null);
  useEffect(() => { queueMicrotask(() => { try { const last = localStorage.getItem('lifesystem-last-weekly-review'); if (last) setReviewAge(Math.max(0, Math.floor((Date.now() - new Date(last).getTime()) / 86400000))); } catch { /* sem armazenamento */ } }); }, []);
  const loadAll = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled(sources.map(async source => {
      const items = await apiFetch<unknown>(`/api/${source}`);
      if (!Array.isArray(items)) throw new Error('Resposta inválida');
      return [source, items] as const;
    }));
    const stageResults = await Promise.allSettled(['tasks', 'projects'].map(async scope => {
      const config = await apiFetch<{ stages: StageDef[] }>(`/api/stage-configs/${scope}`);
      if (!Array.isArray(config.stages) || !config.stages.length) throw new Error('Etapas indisponíveis');
      return config.stages;
    }));
    const failures = results.flatMap((result, index) => result.status === 'rejected' ? [sources[index]] : []);
    setData(previous => {
      const next = { ...previous };
      for (const result of results) if (result.status === 'fulfilled') Object.assign(next, { [result.value[0]]: result.value[1] });
      return next;
    });
    if (stageResults[0].status === 'fulfilled') setStages(stageResults[0].value);
    if (stageResults[1].status === 'fulfilled') setProjectStages(stageResults[1].value);
    setErrors([...failures, ...stageResults.flatMap((result, index) => result.status === 'rejected' ? [index === 0 ? 'taskStages' : 'projectStages'] : [])]);
    setLoading(false);
  }, []);
  useEffect(() => { queueMicrotask(() => { void loadAll(); }); }, [loadAll]);

  const today = todayStr();
  const terminal = new Set(stages.filter(stage => stage.isTerminal).map(stage => stage.id));
  const activeTasks = data.tasks.filter(task => !terminal.has(task.status));
  const dueToday = activeTasks.filter(task => task.dueDate === today);
  const overdue = activeTasks.filter(task => task.dueDate && task.dueDate < today);
  const queue = data.captures.filter(capture => capture.status === 'inbox').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const activeProjects = data.projects.filter(project => !['idea', 'paused'].includes(project.status) && !projectStages.find(stage => stage.id === project.status)?.isTerminal);
  const financial = summarizeFinancialMonth(data.financial, today.slice(0, 7));
  const failed = (source: Source) => errors.includes(source);
  const unavailableTasks = failed('tasks') || errors.includes('taskStages');
  const unavailableProjects = failed('projects') || errors.includes('projectStages');
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setDate(date.getDate() - 6 + index);
    const key = todayStr(date);
    return { date: key, label: date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), entry: data.journal.find(entry => entry.entryDate === key) };
  });
  async function addTask() {
    const title = quickTitle.trim();
    const initial = stages.find(stage => !stage.isTerminal)?.id;
    if (!title || saving.current || !initial || errors.includes('taskStages')) return;
    saving.current = true; setAdding(true);
    try {
      const created = await apiFetch<Task>('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, status: initial, priority: 'normal' }) });
      setData(previous => ({ ...previous, tasks: [created, ...previous.tasks] }));
      setQuickTitle(''); toast.success('Tarefa adicionada!');
    } catch (error) { toast.error(showError(error)); }
    finally { saving.current = false; setAdding(false); }
  }

  const open = activeTasks.filter(task => !task.waitingFor);
  const waiting = activeTasks.filter(task => task.waitingFor);
  const backlog = open.filter(task => !task.dueDate);
  const nextSteps = [...overdue.filter(task => !task.waitingFor), ...dueToday.filter(task => !task.waitingFor)];
  const stalled = activeProjects.filter(project => !open.some(task => task.projectId === project.id));
  const cycle = [
    { key: 'capturar', step: '1', title: 'Capturar', value: queue.length, unit: queue.length === 1 ? 'item para esclarecer' : 'itens para esclarecer', href: '/inbox', action: queue.length ? 'Esclarecer' : 'Caixa zerada', tone: queue.length ? 'attention' : 'ok', unavailable: failed('captures') },
    { key: 'organizar', step: '2', title: 'Organizar', value: stalled.length, unit: stalled.length === 1 ? 'projeto sem próxima ação' : 'projetos sem próxima ação', detail: backlog.length ? `${backlog.length} no backlog` : undefined, detailTone: 'muted', href: '/projetos', action: stalled.length ? 'Definir próximos passos' : 'Tudo com próximo passo', tone: stalled.length ? 'attention' : 'ok', unavailable: unavailableProjects || unavailableTasks },
    { key: 'agir', step: '3', title: 'Agir', unit: dueToday.length === 1 ? 'para hoje' : 'para hoje', value: dueToday.length, detail: overdue.length ? `+ ${overdue.length} atrasada${overdue.length > 1 ? 's' : ''}` : undefined, detailTone: 'late', href: '/hoje', action: 'Abrir o dia', tone: overdue.length ? 'late' : 'neutral', unavailable: unavailableTasks },
    { key: 'aguardando', step: '4', title: 'Aguardando', value: waiting.length, unit: waiting.length === 1 ? 'com outra pessoa' : 'com outras pessoas', href: '/tarefas', action: 'Ver quem', tone: 'neutral', unavailable: unavailableTasks },
    { key: 'revisar', step: '5', title: 'Revisar', value: reviewAge === null ? '—' : reviewAge, unit: reviewAge === null ? 'nenhuma revisão ainda' : reviewAge === 1 ? 'dia desde a revisão' : 'dias desde a revisão', href: '/revisao', action: 'Revisão semanal', tone: reviewAge === null || reviewAge > 7 ? 'attention' : 'ok', unavailable: false },
  ];

  return <div className="work-page mx-auto max-w-[1280px] space-y-6 p-4 pb-24 lg:p-8">
    <header className="today-head">
      <div><p className="today-date" suppressHydrationWarning>{loading ? ' ' : new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><h1 className="font-display">Seu dia em órbita</h1></div>
      <Button asChild className="ml-auto"><Link href="/hoje"><Calendar className="h-4 w-4" />Abrir meu dia</Link></Button>
    </header>
    {errors.length > 0 && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm"><p>Não foi possível atualizar: {errors.map(source => sourceLabels[source]).join(', ')}. As outras áreas continuam disponíveis.</p><Button variant="outline" onClick={loadAll} disabled={loading}><RefreshCw className="h-4 w-4" />Tentar novamente</Button></div>}

    <nav className="cycle" aria-label="Ciclo do sistema">
      {cycle.map(item => <Link key={item.key} href={item.href} className={cn('cycle-step', `is-${item.tone}`)}>
        <span className="cycle-head"><span className="cycle-num">{item.step}</span>{item.title}</span>
        <strong className="cycle-value">{loading || item.unavailable ? '—' : item.value}</strong>
        <span className="cycle-unit">{item.unit}</span>
        {item.detail && !loading && <span className={cn('cycle-detail', item.detailTone === 'muted' && 'is-muted')}>{item.detail}</span>}
        <span className="cycle-action">{item.action}<ArrowRight className="h-3.5 w-3.5" /></span>
      </Link>)}
    </nav>

    <form onSubmit={event => { event.preventDefault(); void addTask(); }} className="inbox-capture">
      <Plus className="h-4 w-4" /><input aria-label="Adicionar tarefa rápida" placeholder="Adicionar tarefa rápida..." value={quickTitle} onChange={event => setQuickTitle(event.target.value)} disabled={adding || loading || errors.includes('taskStages')} />
      <Button type="submit" size="sm" disabled={!quickTitle.trim() || adding || loading || errors.includes('taskStages')}>{adding ? 'Salvando…' : 'Adicionar'}</Button>
    </form>

    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Section title="Próximos passos" href="/hoje" icon={<CheckSquare className="h-4 w-4 text-primary" />}>
        {loading ? <Skeleton className="h-32" /> : unavailableTasks ? <Unavailable /> : nextSteps.length ? <div className="divide-y">{nextSteps.slice(0, 5).map(task => <Link key={task.id} href={`/tarefas?open=${encodeURIComponent(task.id)}`} className="group flex min-h-12 items-center gap-3 py-2"><span className={cn('h-2 w-2 shrink-0 rounded-full', task.priority === 'urgent' ? 'bg-destructive' : task.priority === 'important' ? 'bg-primary' : 'bg-muted-foreground/40')} /><span className="min-w-0 flex-1 truncate text-sm font-medium group-hover:text-primary">{task.title}</span>{task.dueDate && task.dueDate < today && <span className="shrink-0 text-xs text-destructive">atrasada</span>}</Link>)}{nextSteps.length > 5 && <p className="pt-2 text-xs text-muted-foreground">+{nextSteps.length - 5} no Hoje</p>}</div> : <p className="py-4 text-sm text-muted-foreground">Nada para hoje. Escolha algo do backlog ou descanse.</p>}
        {!loading && !failed('captures') && queue.length > 0 && <div className="mt-4 border-t pt-3"><p className="mb-1 text-xs text-muted-foreground">Na caixa de entrada</p>{queue.slice(0, 3).map(capture => <Link key={capture.id} href="/inbox" className="flex min-h-9 items-center gap-2 text-sm hover:text-primary"><Inbox className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{capture.title || capture.content.replace(/<[^>]*>/g, '').trim().slice(0, 90)}</span></Link>)}</div>}
      </Section>
      <Section title="Financeiro" label="Resumo financeiro do mês" href="/financeiro" icon={<Wallet className="h-4 w-4 text-money" />}>
        {loading ? <Skeleton className="h-32" /> : failed('financial') ? <Unavailable /> : <div className="space-y-4">
          <div><p className="text-xs text-muted-foreground">Resultado realizado · {new Date().toLocaleDateString('pt-BR', { month: 'long' })}</p><p className={cn('mt-2 font-mono-num text-3xl tracking-tight', financial.realized.balance < 0 ? 'text-destructive' : 'text-money')}>{money(financial.realized.balance)}</p></div>
          <div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Recebido</p><p className="mt-1 font-mono-num">{money(financial.realized.income)}</p></div><div><p className="text-xs text-muted-foreground">Pago</p><p className="mt-1 font-mono-num">{money(financial.realized.expenses)}</p></div></div>
          <div className="grid grid-cols-2 gap-3 border-t pt-3 text-sm"><div><p className="text-xs text-muted-foreground">A receber · previsto</p><p className="mt-1 font-mono-num text-primary">{money(financial.projected.income)}</p></div><div><p className="text-xs text-muted-foreground">A pagar · previsto</p><p className="mt-1 font-mono-num text-primary">{money(financial.projected.expenses)}</p></div></div>
          {!failed('budgets') && data.budgets.some(budget => budget.month === today.slice(0, 7) && budget.spent > budget.monthlyLimit) && <p className="text-xs text-destructive">Há orçamentos acima do limite. Revise no Financeiro.</p>}
        </div>}
      </Section>
      <Section title="Projetos em movimento" href="/projetos" icon={<FolderKanban className="h-4 w-4 text-primary" />}>
        {loading ? <Skeleton className="h-24" /> : unavailableProjects ? <Unavailable /> : activeProjects.length ? <div className="divide-y">{activeProjects.slice(0, 5).map(project => {
          const next = open.find(task => task.projectId === project.id);
          return <Link key={project.id} href="/projetos" className="group flex min-h-12 items-center gap-3 py-2"><FolderKanban className="h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium group-hover:text-primary">{project.name}</span><span className={cn('block truncate text-xs', next ? 'text-muted-foreground' : 'text-amber-400')}>{next ? `Próxima: ${next.title}` : 'Sem próxima ação'}</span></span></Link>;
        })}</div> : <p className="py-4 text-sm text-muted-foreground">Escolha uma ideia em Projetos e dê o próximo passo.</p>}
      </Section>
      <Section title="Diário" href="/diario" icon={<BookOpen className="h-4 w-4 text-primary" />}>
        {loading ? <Skeleton className="h-24" /> : failed('journal') ? <Unavailable /> : <><div className="grid grid-cols-7 gap-1">{week.map(day => <Link key={day.date} href={`/diario?date=${day.date}`} aria-label={`Diário de ${day.date}${day.entry ? ', preenchido' : ''}`} className="flex min-h-14 flex-col items-center justify-center gap-2 rounded-xl border transition-colors hover:border-primary"><span className="text-xs text-muted-foreground">{day.label}</span><span className={cn('h-2 w-2 rounded-full', day.entry ? 'bg-primary' : 'bg-muted-foreground/25')} /></Link>)}</div><p className="mt-3 text-xs text-muted-foreground">{data.journal.find(entry => entry.entryDate === today)?.mood ? `Hoje: ${moods[data.journal.find(entry => entry.entryDate === today)!.mood!] || 'registrado'}` : 'Como foi seu dia? Escolha uma data para escrever.'}</p></>}
      </Section>
    </div>
  </div>;
}
