'use client';

// A guided, manual ritual — not automation. The Metodologia doc (Visão →
// custom section) is explicit that memory/review has to be an intentional
// act, not something silently generated for you. This walks GTD's Weekly
// Review: clarify what piled up, clear what's overdue, give every project a
// next action, chase what you're waiting on, look at someday/maybe and the
// areas, and end by choosing what matters this week.
//
// Shared by the /revisao route and the modal opened from INBOX.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, Calendar, Check, CheckCircle2, Circle, Compass, PartyPopper, Star } from 'lucide-react';
import { cn, todayStr, addDays } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import { DEFAULT_STAGES } from '@/lib/default-stages';
import type { StageDef, TaskPlanning } from '@/types';
import { ClarifyCard, type ClarifyCapture } from '@/components/clarify-card';
import { spawnNextOccurrenceIfRecurring, type RecurringFrequency } from '@/lib/recurring';
import { useLastReview } from '@/lib/use-last-review';
import { calendarDaysBetween, daysSince, MAX_WEEK_PRIORITIES, type WeeklyReview } from '@/lib/weekly-review';

interface Indicator { id: string; pillarId: string; name: string; targetValue?: number; currentValue?: number; frequency: string; }
interface Pillar { id: string; name: string; icon: string; }
interface Task {
  id: string; title: string; status: string; priority: string; dueDate?: string;
  description?: string; projectId?: string; pillarId?: string; tags?: string[];
  recurring?: boolean; recurringFrequency?: RecurringFrequency;
  planning?: TaskPlanning; waitingFor?: string | null;
}
interface Project { id: string; name: string; emoji?: string; status: string }
interface VisionDoc { id: string; section: string; title: string; content?: string; }

// Nomes das seções da Visão quando ainda não há documento com título.
const VISION_SECTIONS: [string, string][] = [['identity', 'Identidade'], ['vision_5y', 'Visão 5 anos'], ['timeline', 'Linha do tempo'], ['dream', 'Sonho grande'], ['custom', 'Metodologia']];
const STEPS = ['Caixa', 'Atrasadas', 'Projetos', 'Aguardando', 'Backlog', 'Direção', 'Semana'];
const TITLES = ['Esvaziar a caixa', 'Atrasadas', 'Projetos sem próxima ação', 'Aguardando alguém', 'Algum dia / talvez', 'Áreas e rumo', 'Sua semana'];
const WEEK = STEPS.length - 1;
const PRIORITY_RANK: Record<string, number> = { urgent: 0, important: 1, normal: 2 };
type Summary = { clarified: number; rescheduled: number; completed: number; nextActions: number };

const rowActions = 'flex shrink-0 items-center gap-1 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100';

export function WeeklyReviewFlow({ onFinish }: { onFinish?: () => void; embedded?: boolean }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [captures, setCaptures] = useState<ClarifyCapture[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stages, setStages] = useState<StageDef[]>(DEFAULT_STAGES.tasks);
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [vision, setVision] = useState<VisionDoc[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [summary, setSummary] = useState<Summary>({ clarified: 0, rescheduled: 0, completed: 0, nextActions: 0 });
  const [chosen, setChosen] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState<WeeklyReview | null>(null);
  const started = useRef(false);
  const { lastCompletedAt, loaded: reviewLoaded, setReview } = useLastReview();

  useEffect(() => { queueMicrotask(() => void loadAll()); }, []);

  async function loadAll() {
    setLoading(true);
    setLoadError('');
    try {
      const [c, i, p, t, v, stageConfig] = await Promise.all([
        apiFetch<ClarifyCapture[]>('/api/captures'),
        apiFetch<Indicator[]>('/api/indicators'),
        apiFetch<Pillar[]>('/api/pillars'),
        apiFetch<Task[]>('/api/tasks'),
        apiFetch<VisionDoc[]>('/api/vision'),
        apiFetch<{ stages: StageDef[] }>('/api/stage-configs/tasks'),
      ]);
      if (!Array.isArray(stageConfig.stages) || !stageConfig.stages.length) throw new Error('Não foi possível carregar as etapas das tarefas.');
      const projectList = await apiFetch<Project[]>('/api/projects').catch(() => [] as Project[]);
      setCaptures(c); setIndicators(i); setPillars(p); setTasks(t); setVision(v); setStages(stageConfig.stages); setProjects(projectList);
      // Abre no primeiro passo que tem algo a decidir.
      if (!started.current) {
        started.current = true;
        setStep(firstStepWithWork(counts({ captures: c, tasks: t, stages: stageConfig.stages, projects: projectList })));
      }
    } catch (err) {
      setLoadError(showError(err));
    } finally {
      setLoading(false);
    }
  }

  const bump = (key: keyof Summary) => setSummary(previous => ({ ...previous, [key]: previous[key] + 1 }));

  async function toggleTaskDone(task: Task) {
    const terminal = stages.find(stage => stage.isTerminal);
    if (!terminal || busyTask) return;
    setBusyTask(task.id);
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: terminal.id }) });
      toast.success('Tarefa concluída! 🎉');
      bump('completed');
      await spawnNextOccurrenceIfRecurring(task);
      void loadAll();
    } catch (err) { toast.error(showError(err)); }
    finally { setBusyTask(null); }
  }

  async function rescheduleTask(task: Task, days: number | null) {
    if (busyTask || task.planning?.startAt) return;
    setBusyTask(task.id);
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dueDate: days === null ? null : addDays(todayStr(), days) }) });
      toast.success(days === null ? 'Foi para o backlog.' : 'Reagendada!');
      bump('rescheduled');
      void loadAll();
    } catch (err) { toast.error(showError(err)); }
    finally { setBusyTask(null); }
  }

  async function addNextAction(projectId: string, title: string) {
    if (!title.trim() || busyTask) return false;
    setBusyTask(projectId);
    try {
      await apiFetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim(), projectId, status: stages.find(stage => !stage.isTerminal)?.id || 'todo', priority: 'normal' }) });
      toast.success('Próxima ação criada.');
      bump('nextActions');
      await loadAll();
      return true;
    } catch (err) { toast.error(showError(err)); return false; }
    finally { setBusyTask(null); }
  }

  async function finishReview() {
    if (saving) return;
    setSaving(true);
    try {
      const review = await apiFetch<WeeklyReview>('/api/weekly-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priorities: chosen, summary }) });
      setReview(review);
      setFinished(review);
      onFinish?.();
    } catch (err) { toast.error(showError(err)); }
    finally { setSaving(false); }
  }

  function daysToFriday() { const day = new Date().getDay(); return day <= 5 ? Math.max(5 - day, 1) : 6; }

  const today = todayStr();
  const terminalIds = new Set(stages.filter(stage => stage.isTerminal).map(stage => stage.id));
  const pendingCaptures = captures.filter(c => c.status === 'inbox').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const openTasks = tasks.filter(t => !terminalIds.has(t.status));
  const overdueTasks = openTasks.filter(t => t.dueDate && t.dueDate < today);
  const waitingTasks = openTasks.filter(t => t.waitingFor);
  const backlogTasks = openTasks.filter(t => !t.dueDate && !t.waitingFor);
  const stalledProjects = stalled(projects, openTasks);
  const indicatorsByPillar = pillars.map(p => ({ pillar: p, indicators: indicators.filter(i => i.pillarId === p.id) })).filter(g => g.indicators.length > 0);
  const stepCounts = counts({ captures, tasks, stages, projects });
  const isEmpty = (i: number) => stepCounts[i] === 0;
  // Candidatas a prioridade da semana: o que já pesa mais vem primeiro.
  const candidates = openTasks.filter(t => !t.waitingFor).sort((a, b) =>
    (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  const visibleCandidates = showAll ? candidates : candidates.slice(0, 8);
  const age = lastCompletedAt ? daysSince(lastCompletedAt) : null;

  function next() { setStep(current => { for (let i = current + 1; i < WEEK; i++) if (!isEmpty(i)) return i; return WEEK; }); }
  function back() { setStep(current => { for (let i = current - 1; i >= 0; i--) if (!isEmpty(i)) return i; return current; }); }
  function toggleChosen(id: string) {
    setChosen(previous => previous.includes(id) ? previous.filter(item => item !== id) : previous.length >= MAX_WEEK_PRIORITIES ? previous : [...previous, id]);
  }
  function rowKeys(task: Task) {
    return (event: React.KeyboardEvent) => {
      if (event.target !== event.currentTarget || event.metaKey || event.ctrlKey || event.altKey) return;
      const actions: Record<string, () => void> = task.planning?.startAt ? { c: () => void toggleTaskDone(task) } : {
        a: () => void rescheduleTask(task, 1), s: () => void rescheduleTask(task, 7), b: () => void rescheduleTask(task, null), c: () => void toggleTaskDone(task),
      };
      const action = actions[event.key.toLowerCase()];
      if (action) { event.preventDefault(); action(); }
    };
  }
  const doneLine = [
    summary.clarified && `${summary.clarified} esclarecida${summary.clarified > 1 ? 's' : ''}`,
    summary.rescheduled && `${summary.rescheduled} reagendada${summary.rescheduled > 1 ? 's' : ''}`,
    summary.completed && `${summary.completed} concluída${summary.completed > 1 ? 's' : ''}`,
    summary.nextActions && `${summary.nextActions} próxima${summary.nextActions > 1 ? 's' : ''} aç${summary.nextActions > 1 ? 'ões' : 'ão'}`,
  ].filter(Boolean).join(' · ');
  const completeButton = (task: Task) => <button type="button" aria-label={`Concluir ${task.title}`} title="Concluir (C)" disabled={!!busyTask || !stages.some(stage => stage.isTerminal)} onClick={() => toggleTaskDone(task)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"><Circle className="h-4 w-4 text-muted-foreground" /></button>;
  const row = 'group flex min-h-12 items-center gap-2 rounded-lg px-1 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <motion.div className="work-page w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <header className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3">
        <h1 className="font-display text-2xl">Revisão semanal</h1>
        {reviewLoaded && <span className={cn('rounded-full px-2.5 py-0.5 text-xs', age === null ? 'bg-muted text-muted-foreground' : age > 7 ? 'bg-destructive/15 text-destructive' : 'bg-money/15 text-money')}>
          {age === null ? 'primeira' : age === 0 ? 'feita hoje' : `há ${age} dia${age > 1 ? 's' : ''}`}
        </span>}
        <nav aria-label="Etapas da revisão" className="ml-auto flex items-center gap-1">
          {STEPS.map((label, i) => {
            const count = stepCounts[i];
            // ✓ só quando não sobrou nada; passo visitado com itens mostra quantos faltam.
            const done = !loading && !loadError && !finished && isEmpty(i) && i !== step;
            return <button key={label} type="button" disabled={loading || !!loadError || !!finished}
              aria-current={i === step && !finished ? 'step' : undefined}
              aria-label={`${i + 1}. ${label}${count === null ? '' : count === 0 ? ': nada aqui' : `: ${count}`}`}
              title={label} onClick={() => setStep(i)}
              className={cn('flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-medium transition-colors disabled:cursor-default',
                finished || done ? 'bg-money/15 text-money' : i === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70')}>
              {finished || done ? <Check className="h-3.5 w-3.5" /> : loading || loadError ? i + 1 : count ? count : count === 0 ? <Check className="h-3.5 w-3.5" /> : i === WEEK ? <Star className="h-3.5 w-3.5" /> : <Compass className="h-3.5 w-3.5" />}
            </button>;
          })}
        </nav>
      </header>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : loadError ? (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-destructive">{loadError}</p>
          <p className="text-sm text-muted-foreground">Não foi possível carregar sua revisão. Seus dados foram preservados.</p>
          <Button onClick={loadAll}>Tentar novamente</Button>
        </div>
      ) : finished ? (
        <section className="flex flex-col items-center rounded-2xl border border-money/30 bg-money/5 px-4 py-12 text-center">
          <PartyPopper className="mb-3 h-10 w-10 text-money" />
          <p className="text-lg font-medium">Revisão concluída!</p>
          {doneLine && <p className="mt-1 text-sm text-muted-foreground">{doneLine}</p>}
          {finished.priorities.length > 0 && <ol className="my-5 space-y-1 text-left text-sm">
            {finished.priorities.map((id, i) => <li key={id} className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{i + 1}</span>{tasks.find(t => t.id === id)?.title || 'Tarefa'}</li>)}
          </ol>}
          <Button asChild className="mt-4 gap-1.5"><Link href="/planejar"><Calendar className="h-4 w-4" />Planejar a semana</Link></Button>
        </section>
      ) : (
        <AnimatePresence mode="wait">
          <motion.section key={step} aria-labelledby="review-step-title" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>
            <h2 id="review-step-title" className="mb-3 text-base font-semibold">{TITLES[step]}</h2>

            {step === 0 && (pendingCaptures.length === 0
              ? <p className="py-6 text-center text-sm text-muted-foreground">Caixa zerada ✓</p>
              : <ClarifyCard queue={pendingCaptures} projects={projects}
                  onOrganized={id => { setCaptures(previous => previous.map(item => item.id === id ? { ...item, status: 'organized' } : item)); bump('clarified'); }}
                  onRemoved={id => { setCaptures(previous => previous.filter(item => item.id !== id)); bump('clarified'); }}
                  onRestored={capture => setCaptures(previous => [capture, ...previous])} />)}

            {step === 1 && (overdueTasks.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nada atrasado ✓</p> : <ul className="space-y-1">
              {overdueTasks.map(task => <li key={task.id} tabIndex={0} onKeyDown={rowKeys(task)} aria-label={task.title} className={row}>
                {completeButton(task)}
                <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
                <span className="shrink-0 text-xs text-destructive">há {calendarDaysBetween(task.dueDate!, today)} d</span>
                {task.planning?.startAt
                  ? <Button asChild variant="outline" size="sm"><Link href="/planejar" aria-label={`Replanejar ${task.title}`}>Replanejar horário<ArrowRight className="h-3.5 w-3.5" /></Link></Button>
                  : <span className={rowActions}>
                      <Button variant="ghost" size="sm" title="Amanhã (A)" disabled={!!busyTask} onClick={() => rescheduleTask(task, 1)}>Amanhã</Button>
                      <Button variant="ghost" size="sm" title="+7 dias (S)" disabled={!!busyTask} onClick={() => rescheduleTask(task, 7)}>+7 dias</Button>
                      <Button variant="ghost" size="sm" title="Backlog (B)" disabled={!!busyTask} onClick={() => rescheduleTask(task, null)}>Backlog</Button>
                    </span>}
              </li>)}
            </ul>)}

            {step === 2 && (stalledProjects.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Todo projeto ativo tem próxima ação ✓</p> : <div className="space-y-1">
              {stalledProjects.map(project => (
                <form key={project.id} className="flex flex-wrap items-center gap-2 rounded-lg px-1 py-1.5" onSubmit={event => { event.preventDefault(); const input = event.currentTarget.elements.namedItem('next') as HTMLInputElement; void addNextAction(project.id, input.value).then(ok => { if (ok) input.value = ''; }); }}>
                  <span className="min-w-0 flex-1 basis-40 truncate text-sm font-medium">{project.emoji ? `${project.emoji} ` : ''}{project.name}</span>
                  <input name="next" aria-label={`Próxima ação de ${project.name}`} placeholder="Próxima ação… (Enter)" className="h-10 min-w-0 flex-[2] basis-56 rounded-md border bg-background px-3 text-base sm:text-sm" />
                  <Button type="submit" size="sm" variant="ghost" disabled={!!busyTask}>Adicionar</Button>
                </form>
              ))}
            </div>)}

            {step === 3 && (waitingTasks.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Ninguém te devendo nada ✓</p> : <ul className="space-y-1">
              {waitingTasks.map(task => <li key={task.id} className={row}>
                {completeButton(task)}
                <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
                <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-500">{task.waitingFor}</span>
              </li>)}
            </ul>)}

            {step === 4 && (backlogTasks.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Backlog vazio ✓</p> : <>
              <ul className="space-y-1">
                {backlogTasks.slice(0, 12).map(task => <li key={task.id} className={row}>
                  <span className="min-w-0 flex-1 truncate pl-2 text-sm">{task.title}</span>
                  <span className={rowActions}>
                    <Button variant="ghost" size="sm" disabled={!!busyTask} onClick={() => rescheduleTask(task, 1)}>Amanhã</Button>
                    <Button variant="ghost" size="sm" disabled={!!busyTask} onClick={() => rescheduleTask(task, daysToFriday())}>Esta semana</Button>
                  </span>
                </li>)}
              </ul>
              {backlogTasks.length > 12 && <Link href="/tarefas" className="mt-1 flex min-h-10 items-center gap-1 px-2 text-xs text-muted-foreground hover:text-foreground">Ver o backlog inteiro em Tarefas <ArrowRight className="h-3 w-3" /></Link>}
            </>)}

            {step === 5 && <div className="space-y-1">
              {indicatorsByPillar.length === 0
                ? <p className="py-2 text-sm text-muted-foreground">Nenhuma meta cadastrada ainda. <Link href="/indicadores" className="text-primary underline">Criar metas</Link></p>
                : indicatorsByPillar.map(({ pillar, indicators: inds }) => <div key={pillar.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg px-1 py-2">
                    <span className="w-44 shrink-0 truncate text-sm font-medium">{pillar.icon} {pillar.name}</span>
                    {inds.map(ind => {
                      const pct = ind.targetValue ? Math.min(100, Math.round(((ind.currentValue || 0) / ind.targetValue) * 100)) : null;
                      return <span key={ind.id} className="min-w-28 text-xs" title={`${ind.name}: ${ind.currentValue || 0}${ind.targetValue ? ` de ${ind.targetValue}` : ''}`}>
                        <span className={cn('flex justify-between gap-2', pct !== null && pct < 50 ? 'text-amber-500' : 'text-muted-foreground')}><span className="truncate">{ind.name}</span><span>{ind.currentValue || 0}{ind.targetValue ? `/${ind.targetValue}` : ''}</span></span>
                        {pct !== null && <span className="mt-1 block h-1 overflow-hidden rounded-full bg-muted"><span className={cn('block h-full rounded-full', pct >= 100 ? 'bg-money' : 'bg-primary')} style={{ width: `${pct}%` }} /></span>}
                      </span>;
                    })}
                  </div>)}
              <div className="flex flex-wrap gap-2 pt-3">
                {VISION_SECTIONS.map(([section, label]) => {
                  const doc = vision.find(v => v.section === section);
                  const hasContent = Boolean(doc?.content?.trim().length);
                  return <Link key={section} href="/visao" className="inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs hover:bg-muted/50">{hasContent ? <CheckCircle2 className="h-3.5 w-3.5 text-money" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}{doc?.title || label}</Link>;
                })}
              </div>
            </div>}

            {step === WEEK && <div>
              <p className="mb-3 text-sm text-muted-foreground">Escolha até {MAX_WEEK_PRIORITIES} prioridades · {chosen.length}/{MAX_WEEK_PRIORITIES}</p>
              {candidates.length === 0 ? <p className="py-4 text-sm text-muted-foreground">Nenhuma tarefa aberta.</p> : <ul className="space-y-1" aria-label="Prioridades da semana">
                {visibleCandidates.map(task => {
                  const position = chosen.indexOf(task.id);
                  const full = position === -1 && chosen.length >= MAX_WEEK_PRIORITIES;
                  return <li key={task.id}>
                    <button type="button" aria-pressed={position !== -1} disabled={full} onClick={() => toggleChosen(task.id)}
                      className={cn('flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm transition-colors disabled:opacity-40', position !== -1 ? 'bg-primary/10' : 'hover:bg-muted/40')}>
                      <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs', position !== -1 && 'border-primary bg-primary text-primary-foreground')}>{position !== -1 ? position + 1 : ''}</span>
                      <span className="min-w-0 flex-1 truncate">{task.title}</span>
                      {task.priority !== 'normal' && <span className="shrink-0 text-xs text-muted-foreground">{task.priority === 'urgent' ? 'Urgente' : 'Importante'}</span>}
                      {task.dueDate && <span className={cn('shrink-0 text-xs', task.dueDate < today ? 'text-destructive' : 'text-muted-foreground')}>{new Date(`${task.dueDate}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span>}
                    </button>
                  </li>;
                })}
              </ul>}
              {candidates.length > 8 && <button type="button" onClick={() => setShowAll(value => !value)} className="mt-1 min-h-10 px-2 text-xs text-muted-foreground hover:text-foreground">{showAll ? 'Mostrar menos' : `Mostrar todas (${candidates.length})`}</button>}
              {doneLine && <p className="mt-4 text-xs text-muted-foreground">Nesta revisão: {doneLine}</p>}
            </div>}
          </motion.section>
        </AnimatePresence>
      )}

      {!loading && !loadError && !finished && (
        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" disabled={step === 0 || STEPS.slice(0, step).every((_, i) => isEmpty(i))} onClick={back} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          {step === WEEK ? (
            <Button onClick={finishReview} disabled={saving} className="gap-1.5">{saving ? 'Salvando…' : 'Concluir revisão'} <CheckCircle2 className="h-4 w-4" /></Button>
          ) : (
            <Button onClick={next} className="gap-1.5">Próximo <ArrowRight className="h-4 w-4" /></Button>
          )}
        </div>
      )}
    </motion.div>
  );
}

function stalled(projects: Project[], openTasks: Task[]) {
  return projects.filter(project => ['active', 'development'].includes(project.status) && !openTasks.some(task => task.projectId === project.id && !task.waitingFor));
}

/** Itens por passo; null = passo sem contagem (sempre visitado). */
function counts({ captures, tasks, stages, projects }: { captures: ClarifyCapture[]; tasks: Task[]; stages: StageDef[]; projects: Project[] }): (number | null)[] {
  const today = todayStr();
  const terminal = new Set(stages.filter(stage => stage.isTerminal).map(stage => stage.id));
  const open = tasks.filter(t => !terminal.has(t.status));
  return [
    captures.filter(c => c.status === 'inbox').length,
    open.filter(t => t.dueDate && t.dueDate < today).length,
    stalled(projects, open).length,
    open.filter(t => t.waitingFor).length,
    open.filter(t => !t.dueDate && !t.waitingFor).length,
    null,
    null,
  ];
}

function firstStepWithWork(stepCounts: (number | null)[]) {
  const index = stepCounts.findIndex(count => count !== 0);
  return index === -1 ? WEEK : index;
}
