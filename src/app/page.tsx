'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Calendar, CheckSquare, Inbox, Layers, Plus, RefreshCw, Wallet, BookOpen, FolderKanban, Newspaper } from 'lucide-react';
import { apiFetch, showError } from '@/lib/api';
import { cn, todayStr } from '@/lib/utils';
import { DEFAULT_STAGES } from '@/lib/default-stages';
import { summarizeFinancialMonth } from '@/lib/financial-period';
import { WorkspaceHeading, WorkspaceMetric } from '@/components/workspace/workspace-heading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
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
const stageLabels: Record<string, string> = { idea: 'Ideias', draft: 'Roteiros', review: 'Em produção', scheduled: 'Agendados', published: 'Publicados', archived: 'Arquivados' };
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

  return <div className="work-page mx-auto max-w-[1600px] space-y-6 p-4 pb-24 lg:p-8">
    <WorkspaceHeading eyebrow="Seu espaço" title="Seu dia em órbita" description={loading ? 'Seu próximo passo começa aqui.' : new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} actions={<><Button asChild><Link href="/hoje"><Calendar className="h-4 w-4" />Abrir meu dia</Link></Button><Button variant="outline" asChild><Link href="/planejar">Planejar semana<ArrowRight className="h-4 w-4" /></Link></Button></>}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <WorkspaceMetric label="Para hoje" value={loading || unavailableTasks ? '—' : dueToday.length} detail="Próximos passos" tone="primary" />
        <WorkspaceMetric label="Para decidir" value={loading || failed('captures') ? '—' : queue.length} detail="Na caixa de entrada" />
        <WorkspaceMetric label="Em andamento" value={loading || unavailableProjects ? '—' : activeProjects.length} detail="Projetos em movimento" />
        <WorkspaceMetric label="Para replanejar" value={loading || unavailableTasks ? '—' : overdue.length} detail="Prazos anteriores a hoje" tone={overdue.length ? 'warning' : 'default'} />
      </div>
    </WorkspaceHeading>
    {errors.length > 0 && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm"><p>Não foi possível atualizar: {errors.map(source => sourceLabels[source]).join(', ')}. As outras áreas continuam disponíveis.</p><Button variant="outline" onClick={loadAll} disabled={loading}><RefreshCw className="h-4 w-4" />Tentar novamente</Button></div>}
    <form onSubmit={event => { event.preventDefault(); void addTask(); }} className="work-toolbar flex items-center gap-2 rounded-2xl border bg-card p-3">
      <Plus className="ml-1 h-4 w-4 shrink-0 text-primary" /><Input aria-label="Adicionar tarefa rápida" placeholder="Adicionar tarefa rápida..." value={quickTitle} onChange={event => setQuickTitle(event.target.value)} disabled={adding || loading || errors.includes('taskStages')} className="min-w-0 border-0 bg-transparent shadow-none" />
      <Button type="submit" disabled={!quickTitle.trim() || adding || loading || errors.includes('taskStages')} className="shrink-0">{adding ? 'Salvando…' : 'Adicionar'}</Button>
    </form>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Section title="Próximos passos" href="/tarefas" icon={<CheckSquare className="h-4 w-4 text-primary" />}>
        {loading ? <Skeleton className="h-32" /> : unavailableTasks ? <Unavailable /> : <>
          {overdue.length > 0 && <Link href="/planejar" className="mb-3 flex min-h-11 items-center justify-between gap-2 rounded-xl bg-destructive/8 px-3 py-2 text-sm text-destructive"><span>{overdue.length} prazo{overdue.length !== 1 ? 's' : ''} para rever</span><ArrowRight className="h-4 w-4 shrink-0" /></Link>}
          {dueToday.length ? <div className="divide-y">{dueToday.slice(0, 5).map(task => <Link key={task.id} href={`/tarefas?open=${encodeURIComponent(task.id)}`} className="group flex min-h-16 items-center gap-3 py-3"><span className={cn('h-2 w-2 shrink-0 rounded-full', task.priority === 'urgent' ? 'bg-destructive' : 'bg-primary')} /><div className="min-w-0 flex-1"><p className="text-sm font-medium group-hover:text-primary">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{stages.find(stage => stage.id === task.status)?.label || task.status}{task.projectId && ` · ${data.projects.find(project => project.id === task.projectId)?.name || 'Projeto'}`}</p></div><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" /></Link>)}</div> : <div className="space-y-3 py-5"><p className="font-display text-2xl">Um espaço para escolher.</p><p className="text-sm text-muted-foreground">Nenhuma tarefa planejada para hoje. Reserve tempo para o que importa.</p><Link href="/planejar" className="work-action-link">Escolher tarefas para o dia<ArrowRight className="h-4 w-4" /></Link></div>}
        </>}
      </Section>
      <Section title="Financeiro" label="Resumo financeiro do mês" href="/financeiro" icon={<Wallet className="h-4 w-4 text-money" />}>
        {loading ? <Skeleton className="h-32" /> : failed('financial') ? <Unavailable /> : <div className="space-y-4">
          <div><p className="text-xs text-muted-foreground">Resultado realizado · {new Date().toLocaleDateString('pt-BR', { month: 'long' })}</p><p className={cn('mt-2 font-mono-num text-3xl tracking-tight', financial.realized.balance < 0 ? 'text-destructive' : 'text-money')}>{money(financial.realized.balance)}</p></div>
          <div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Recebido</p><p className="mt-1 font-mono-num">{money(financial.realized.income)}</p></div><div><p className="text-xs text-muted-foreground">Pago</p><p className="mt-1 font-mono-num">{money(financial.realized.expenses)}</p></div></div>
          <div className="grid grid-cols-2 gap-3 border-t pt-3 text-sm"><div><p className="text-xs text-muted-foreground">A receber · previsto</p><p className="mt-1 font-mono-num text-primary">{money(financial.projected.income)}</p></div><div><p className="text-xs text-muted-foreground">A pagar · previsto</p><p className="mt-1 font-mono-num text-primary">{money(financial.projected.expenses)}</p></div></div>
          {!failed('budgets') && data.budgets.some(budget => budget.month === today.slice(0, 7) && budget.spent > budget.monthlyLimit) && <p className="text-xs text-destructive">Há orçamentos acima do limite. Revise no Financeiro.</p>}
        </div>}
      </Section>
      <Section title="Caixa de entrada" href="/inbox" icon={<Inbox className="h-4 w-4 text-primary" />}>
        {loading ? <Skeleton className="h-24" /> : failed('captures') ? <Unavailable /> : queue.length ? <div className="divide-y">{queue.slice(0, 3).map(capture => <Link key={capture.id} href="/inbox" className="group flex min-h-14 items-center justify-between gap-3 py-3"><span className="min-w-0 text-sm group-hover:text-primary">{capture.title || capture.content.replace(/<[^>]*>/g, '').trim().slice(0, 90)}</span><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" /></Link>)}</div> : <p className="py-5 text-sm text-muted-foreground">Nada esperando uma decisão. Capture uma ideia quando surgir.</p>}
      </Section>
      <Section title="Diário" href="/diario" icon={<BookOpen className="h-4 w-4 text-primary" />}>
        {loading ? <Skeleton className="h-24" /> : failed('journal') ? <Unavailable /> : <><p className="mb-4 text-sm text-muted-foreground">Um momento para perceber seu caminho.</p><div className="grid grid-cols-7 gap-1">{week.map(day => <Link key={day.date} href={`/diario?date=${day.date}`} aria-label={`Diário de ${day.date}${day.entry ? ', preenchido' : ''}`} className="flex min-h-16 flex-col items-center justify-center gap-2 rounded-xl border transition-colors hover:border-primary"><span className="text-xs text-muted-foreground">{day.label}</span><span className={cn('h-2 w-2 rounded-full', day.entry ? 'bg-primary' : 'bg-muted-foreground/25')} /></Link>)}</div><p className="mt-4 text-xs text-muted-foreground">{data.journal.find(entry => entry.entryDate === today)?.mood ? `Hoje: ${moods[data.journal.find(entry => entry.entryDate === today)!.mood!] || 'registrado'}` : 'Como foi seu dia? Escolha uma data para escrever.'}</p></>}
      </Section>
    </div>
    <div className="grid gap-5 xl:grid-cols-3">
      <Section title="Projetos em movimento" href="/projetos" icon={<FolderKanban className="h-4 w-4 text-primary" />}>
        {loading ? <Skeleton className="h-24" /> : unavailableProjects ? <Unavailable /> : activeProjects.length ? <div className="space-y-2">{activeProjects.slice(0, 4).map(project => <Link key={project.id} href={`/projetos?open=${encodeURIComponent(project.id)}`} className="flex min-h-14 items-center gap-3 rounded-xl border p-3 transition-colors hover:border-primary/50"><span aria-hidden="true"><FolderKanban className="h-4 w-4 text-primary" /></span><div className="min-w-0"><p className="text-sm font-medium">{project.name}</p><p className="text-xs text-muted-foreground">{projectStages.find(stage => stage.id === project.status)?.label || project.status}</p></div></Link>)}</div> : <p className="py-5 text-sm text-muted-foreground">Escolha uma ideia em Projetos e dê o próximo passo.</p>}
      </Section>
      <Section title="Pilares e metas" href="/visao?tab=pilares" icon={<Layers className="h-4 w-4 text-primary" />}>
        {loading ? <Skeleton className="h-24" /> : failed('pillars') || failed('indicators') ? <Unavailable /> : data.pillars.length ? <div className="space-y-4">{[...data.pillars].sort((a, b) => a.sortOrder - b.sortOrder).map(pillar => {
          const indicators = data.indicators.filter(indicator => indicator.pillarId === pillar.id && (indicator.targetValue || 0) > 0);
          const progress = indicators.length ? indicators.reduce((sum, indicator) => sum + Math.max(0, Math.min(1, (indicator.currentValue || 0) / indicator.targetValue!)), 0) / indicators.length * 100 : null;
          return <Link key={pillar.id} href={`/indicadores?pillar=${encodeURIComponent(pillar.id)}`} className="block rounded-lg py-1"><div className="mb-2 flex items-center justify-between gap-3 text-sm"><span>{pillar.icon} {pillar.name}</span><span className="shrink-0 text-xs text-muted-foreground">{progress === null ? 'Definir metas' : `${Math.round(progress)}%`}</span></div>{progress !== null && <Progress value={progress} className="h-1.5" />}</Link>;
        })}</div> : <p className="py-5 text-sm text-muted-foreground">Defina suas áreas de vida em Visão.</p>}
      </Section>
      <Section title="Conteúdo" href="/conteudo" icon={<Newspaper className="h-4 w-4 text-primary" />}>
        {loading ? <Skeleton className="h-24" /> : failed('content') ? <Unavailable /> : data.content.length ? <div className="divide-y">{Object.entries(data.content.reduce<Record<string, number>>((counts, item) => ({ ...counts, [item.stage]: (counts[item.stage] || 0) + 1 }), {})).map(([stage, count]) => <div key={stage} className="flex min-h-11 items-center justify-between text-sm"><span className="text-muted-foreground">{stageLabels[stage] || stage}</span><span className="font-mono-num">{count}</span></div>)}</div> : <div className="space-y-3 py-5"><p className="text-sm text-muted-foreground">Transforme uma referência em uma história sua.</p><Link href="/content-hub" className="work-action-link">Explorar fontes<ArrowRight className="h-4 w-4" /></Link></div>}
      </Section>
    </div>
    <Link href="/revisao" className="flex min-h-16 items-center justify-between gap-4 rounded-2xl border border-dashed p-4 text-sm transition-colors hover:border-primary"><span>Revisar a semana e ajustar a direção</span><ArrowRight className="h-4 w-4 shrink-0 text-primary" /></Link>
  </div>;
}
