'use client';

// A guided, manual ritual — not automation. The Metodologia doc (Visão →
// custom section) is explicit that memory/review has to be an intentional
// act, not something silently generated for you. This walks the same path
// GTD's Weekly Review and Sunsama's "shutdown" ritual do: process what's
// piled up, check the health of each area, clear what's overdue, and
// reconnect with the long-range plan — one deliberate screen at a time.
//
// Extracted from the standalone /revisao route so it can also open as a
// modal from inside INBOX (the queue item that asked for this) — the route
// still works too, it just renders this same component.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import {
  Inbox, AlertTriangle, Target, CheckCircle2, ArrowRight, ArrowLeft,
  Circle, PartyPopper, Calendar, FolderKanban, Hourglass, Archive,
} from 'lucide-react';
import { cn, todayStr, addDays } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import { DEFAULT_STAGES } from '@/lib/default-stages';
import type { StageDef, TaskPlanning } from '@/types';
import { CaptureConversionDialog } from '@/components/capture-conversion-dialog';
import { spawnNextOccurrenceIfRecurring, type RecurringFrequency } from '@/lib/recurring';

interface Capture { id: string; content: string; title?: string; status: string; targetId?: string; createdAt: string; }
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

const LAST_REVIEW_KEY = 'lifesystem-last-weekly-review';
const VISION_SECTIONS = ['identity', 'vision_5y', 'timeline', 'dream', 'custom'];

function getTitle(content: string): string {
  const text = content.replace(/<[^>]*>/g, '').trim();
  return text.split('\n')[0].slice(0, 80) || 'Sem título';
}

// GTD: esvaziar → atrasadas → projetos parados → aguardando → backlog → direção.
const STEPS = ['Caixa', 'Atrasadas', 'Projetos', 'Aguardando', 'Backlog', 'Direção', 'Pronto'];
const LAST = STEPS.length - 1;

export function WeeklyReviewFlow({ onFinish, embedded = false }: { onFinish?: () => void; embedded?: boolean }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [converting, setConverting] = useState<Capture | null>(null);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stages, setStages] = useState<StageDef[]>(DEFAULT_STAGES.tasks);
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [vision, setVision] = useState<VisionDoc[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [lastReview, setLastReview] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
    queueMicrotask(() => { try { setLastReview(localStorage.getItem(LAST_REVIEW_KEY)); } catch { /* O ritual não depende do armazenamento do navegador. */ } });
  }, []);

  async function loadAll() {
    setLoading(true);
    setLoadError('');
    try {
      const [c, i, p, t, v, stageConfig] = await Promise.all([
        apiFetch<Capture[]>('/api/captures'),
        apiFetch<Indicator[]>('/api/indicators'),
        apiFetch<Pillar[]>('/api/pillars'),
        apiFetch<Task[]>('/api/tasks'),
        apiFetch<VisionDoc[]>('/api/vision'),
        apiFetch<{ stages: StageDef[] }>('/api/stage-configs/tasks'),
      ]);
      if (!Array.isArray(stageConfig.stages) || !stageConfig.stages.length) throw new Error('Não foi possível carregar as etapas das tarefas.');
      void apiFetch<Project[]>('/api/projects').then(setProjects).catch(() => {});
      setCaptures(c); setIndicators(i); setPillars(p); setTasks(t); setVision(v); setStages(stageConfig.stages);
    } catch (err) {
      setLoadError(showError(err));
    } finally {
      setLoading(false);
    }
  }



  async function toggleTaskDone(task: Task) {
    const terminal = stages.find(stage => stage.isTerminal);
    if (!terminal || busyTask) return;
    setBusyTask(task.id);
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: terminal.id }) });
      toast.success('Tarefa concluída! 🎉');
      await spawnNextOccurrenceIfRecurring(task);
      loadAll();
    } catch (err) { toast.error(showError(err)); }
    finally { setBusyTask(null); }
  }

  async function rescheduleTask(task: Task, days: number | null) {
    if (busyTask || task.planning?.startAt) return;
    setBusyTask(task.id);
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dueDate: days === null ? null : addDays(todayStr(), days) }) });
      toast.success(days === null ? 'Foi para o backlog.' : 'Reagendada!');
      loadAll();
    } catch (err) { toast.error(showError(err)); }
    finally { setBusyTask(null); }
  }

  async function addNextAction(projectId: string, title: string) {
    if (!title.trim() || busyTask) return false;
    setBusyTask(projectId);
    try {
      await apiFetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim(), projectId, status: stages.find(stage => !stage.isTerminal)?.id || 'todo', priority: 'normal' }) });
      toast.success('Próxima ação criada.');
      await loadAll();
      return true;
    } catch (err) { toast.error(showError(err)); return false; }
    finally { setBusyTask(null); }
  }

  function daysToFriday() { const day = new Date().getDay(); return day <= 5 ? Math.max(5 - day, 1) : 6; }

  function finishReview() {
    const now = new Date().toISOString();
    try { localStorage.setItem(LAST_REVIEW_KEY, now); } catch { toast.info('Revisão concluída. O navegador não permitiu guardar a data deste ritual.'); }
    setLastReview(now);
    setStep(LAST);
    onFinish?.();
  }

  const pendingCaptures = captures.filter(c => c.status === 'inbox');
  const today = todayStr();
  const terminalIds = new Set(stages.filter(stage => stage.isTerminal).map(stage => stage.id));
  const overdueTasks = tasks.filter(t => !terminalIds.has(t.status) && t.dueDate && t.dueDate < today);
  const openTasks = tasks.filter(t => !terminalIds.has(t.status));
  const waitingTasks = openTasks.filter(t => t.waitingFor);
  const backlogTasks = openTasks.filter(t => !t.dueDate && !t.waitingFor);
  const stalledProjects = projects.filter(project => ['active', 'development'].includes(project.status) && !openTasks.some(task => task.projectId === project.id && !task.waitingFor));
  const indicatorsByPillar = pillars.map(p => ({ pillar: p, indicators: indicators.filter(i => i.pillarId === p.id) })).filter(g => g.indicators.length > 0);

  function daysSince(iso: string): number {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    return Number.isFinite(days) ? Math.max(0, days) : 0;
  }

  return (
    <motion.div className="work-page w-full space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <CaptureConversionDialog key={converting?.id || "closed"} capture={converting} onClose={() => setConverting(null)} onConverted={loadAll} />
      <header className="today-head">
        <div><p className="today-date">{lastReview ? `Última revisão há ${daysSince(lastReview)} dia${daysSince(lastReview) !== 1 ? 's' : ''}` : 'Primeira revisão'}</p><h1 className="font-display">Revisão Semanal</h1></div>
      </header>

      {/* Stepper */}
      <div aria-label="Etapas da revisão" className="mb-8 flex items-center gap-1.5">
        {STEPS.map((s, i) => (
          <div key={s} aria-current={i === step ? 'step' : undefined} aria-label={`${i + 1}. ${s}`} className="flex min-w-0 flex-1 flex-col items-start gap-2">
            <div className="flex w-full items-center gap-1.5">
            <div className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors',
              i < step ? 'bg-money text-white' : i === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}>
              {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && <div className={cn('h-0.5 flex-1 rounded-full', i < step ? 'bg-money' : 'bg-muted')} />}
            </div><span className="max-w-full truncate text-[11px] text-muted-foreground">{s}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : loadError ? (
        <Card><CardContent className="space-y-3 pt-6">
          <p role="alert" className="text-sm text-destructive">{loadError}</p>
          <p className="text-sm text-muted-foreground">Não foi possível carregar sua revisão. Seus dados foram preservados.</p>
          <Button onClick={loadAll}>Tentar novamente</Button>
        </CardContent></Card>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>

            {step === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Inbox className="h-4 w-4 text-primary" /> Esvaziar a caixa de entrada ({pendingCaptures.length})
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Tudo o que entrou na semana precisa de uma decisão.</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pendingCaptures.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Caixa zerada. Nada pra processar 🎉</p>
                  ) : <>
                    {pendingCaptures.slice(0, 6).map(c => (
                      <div key={c.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                        <span className="flex-1 truncate text-sm">{c.title || getTitle(c.content)}</span>
                        <Button variant="outline" size="sm" className="h-11 gap-1 text-xs" onClick={() => setConverting(c)}>
                          <ArrowRight className="h-3 w-3" /> Converter
                        </Button>
                      </div>
                    ))}
                    {pendingCaptures.length > 6 && <p className="text-xs text-muted-foreground">+{pendingCaptures.length - 6} na fila</p>}
                  </>}
                  {!embedded && pendingCaptures.length > 0 && <Button asChild size="sm"><Link href="/inbox">Esclarecer um por vez <ArrowRight className="h-3.5 w-3.5" /></Link></Button>}
                </CardContent>
              </Card>
            )}

            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4 text-destructive" /> Tarefas atrasadas ({overdueTasks.length})
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Concluir, dar novo prazo ou mandar pro backlog.</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {overdueTasks.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Nada atrasado. Tudo em dia 🎉</p>
                  ) : (
                    overdueTasks.map(task => (
                      <div key={task.id} className="rounded-xl border border-destructive/20 p-3">
                        <div className="flex items-start gap-2"><button aria-label={`Concluir ${task.title}`} disabled={!!busyTask || !stages.some(stage => stage.isTerminal)} onClick={() => toggleTaskDone(task)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"><Circle className="h-4 w-4 text-muted-foreground" /></button><div className="min-w-0 flex-1 pt-2"><p className="text-sm font-medium">{task.title}</p><p className="mt-1 text-xs text-destructive">{task.dueDate && new Date(`${task.dueDate}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</p></div></div>
                        <div className="mt-2 flex flex-wrap gap-2 pl-1 sm:pl-13">{task.planning?.startAt ? <Button asChild variant="outline" size="sm"><Link href="/planejar" aria-label={`Replanejar ${task.title}`}>Replanejar horário<ArrowRight className="h-3.5 w-3.5" /></Link></Button> : <><Button variant="outline" size="sm" disabled={!!busyTask} onClick={() => rescheduleTask(task, 1)}>Amanhã</Button><Button variant="ghost" size="sm" disabled={!!busyTask} onClick={() => rescheduleTask(task, 7)}>+7 dias</Button><Button variant="ghost" size="sm" disabled={!!busyTask} onClick={() => rescheduleTask(task, null)}>Backlog</Button></>}</div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FolderKanban className="h-4 w-4 text-primary" /> Projetos sem próxima ação ({stalledProjects.length})
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Todo projeto ativo precisa de um próximo passo concreto.</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {stalledProjects.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Todos os projetos ativos têm uma próxima ação 🎉</p>
                  ) : stalledProjects.map(project => (
                    <form key={project.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2" onSubmit={event => { event.preventDefault(); const input = event.currentTarget.elements.namedItem('next') as HTMLInputElement; void addNextAction(project.id, input.value).then(ok => { if (ok) input.value = ''; }); }}>
                      <span className="min-w-0 flex-1 basis-40 truncate text-sm font-medium">{project.emoji ? `${project.emoji} ` : ''}{project.name}</span>
                      <input name="next" aria-label={`Próxima ação de ${project.name}`} placeholder="Próxima ação…" className="h-10 min-w-0 flex-[2] basis-56 rounded-md border bg-background px-3 text-sm" />
                      <Button type="submit" size="sm" variant="outline" disabled={!!busyTask}>Adicionar</Button>
                    </form>
                  ))}
                </CardContent>
              </Card>
            )}

            {step === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Hourglass className="h-4 w-4 text-amber-500" /> Aguardando outras pessoas ({waitingTasks.length})
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Cobre quem precisa ser cobrado. Se chegou, conclua.</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {waitingTasks.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Ninguém te devendo nada.</p>
                  ) : waitingTasks.map(task => (
                    <div key={task.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                      <button aria-label={`Concluir ${task.title}`} disabled={!!busyTask} onClick={() => toggleTaskDone(task)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-muted"><Circle className="h-4 w-4 text-muted-foreground" /></button>
                      <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
                      <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-500">{task.waitingFor}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {step === 4 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Archive className="h-4 w-4 text-primary" /> Backlog: algum dia / talvez ({backlogTasks.length})
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Algo daqui entra nesta semana? Dê um prazo ou deixe descansar.</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {backlogTasks.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Backlog vazio.</p>
                  ) : backlogTasks.slice(0, 12).map(task => (
                    <div key={task.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
                      <span className="min-w-0 flex-1 basis-48 truncate text-sm">{task.title}</span>
                      <Button variant="outline" size="sm" disabled={!!busyTask} onClick={() => rescheduleTask(task, 1)}>Amanhã</Button>
                      <Button variant="ghost" size="sm" disabled={!!busyTask} onClick={() => rescheduleTask(task, daysToFriday())}>Esta semana</Button>
                    </div>
                  ))}
                  {backlogTasks.length > 12 && <Link href="/tarefas" className="flex min-h-10 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">Ver o backlog inteiro em Tarefas <ArrowRight className="h-3 w-3" /></Link>}
                </CardContent>
              </Card>
            )}

            {step === 5 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-4 w-4 text-primary" /> Áreas e direção
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Como está cada área? Ainda faz sentido o rumo?</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {indicatorsByPillar.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada ainda. <Link href="/indicadores" className="text-primary underline">Criar metas</Link></p>
                  ) : indicatorsByPillar.map(({ pillar, indicators: inds }) => (
                    <div key={pillar.id}>
                      <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">{pillar.icon} {pillar.name}</p>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {inds.map(ind => {
                          const pct = ind.targetValue ? Math.min(100, Math.round(((ind.currentValue || 0) / ind.targetValue) * 100)) : null;
                          return <div key={ind.id} className="rounded-md border px-2.5 py-1.5 text-xs">
                            <div className="flex items-center justify-between"><span className="truncate">{ind.name}</span><span className="shrink-0 text-muted-foreground">{ind.currentValue || 0}{ind.targetValue ? `/${ind.targetValue}` : ''}</span></div>
                            {pct !== null && <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', pct >= 100 ? 'bg-money' : 'bg-primary')} style={{ width: `${pct}%` }} /></div>}
                          </div>;
                        })}
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    {VISION_SECTIONS.map(sec => {
                      const doc = vision.find(v => v.section === sec);
                      const hasContent = Boolean(doc?.content?.trim().length);
                      return <Link key={sec} href="/visao" className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs hover:bg-muted/50">{hasContent ? <CheckCircle2 className="h-3.5 w-3.5 text-money" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}{doc?.title || sec}</Link>;
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 6 && (
              <Card className="border-money/30 bg-money/5">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <PartyPopper className="h-10 w-10 text-money mb-3" />
                  <p className="text-lg font-medium">Revisão concluída!</p>
                  <p className="mb-4 px-4 text-center text-sm text-muted-foreground">Sistema em dia. Agora escolha os horários da semana.</p>
                  <Button asChild className="gap-1.5"><Link href="/planejar"><Calendar className="h-4 w-4" />Planejar a próxima semana</Link></Button>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {!loading && !loadError && step < LAST && (
        <div className="mt-6 flex items-center justify-between">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          {step === LAST - 1 ? (
            <Button onClick={finishReview} className="gap-1.5">Concluir revisão <CheckCircle2 className="h-4 w-4" /></Button>
          ) : (
            <Button onClick={() => setStep(s => s + 1)} className="gap-1.5">Próximo <ArrowRight className="h-4 w-4" /></Button>
          )}
        </div>
      )}
    </motion.div>
  );
}
