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
  Inbox, Sparkles, AlertTriangle, Target, CheckCircle2, ArrowRight, ArrowLeft,
  Circle, PartyPopper, Calendar,
} from 'lucide-react';
import { cn, todayStr, addDays } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import { WorkspaceHeading } from '@/components/workspace/workspace-heading';
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
  planning?: TaskPlanning;
}
interface VisionDoc { id: string; section: string; title: string; content?: string; }

const LAST_REVIEW_KEY = 'lifesystem-last-weekly-review';
const VISION_SECTIONS = ['identity', 'vision_5y', 'timeline', 'dream', 'custom'];

function getTitle(content: string): string {
  const text = content.replace(/<[^>]*>/g, '').trim();
  return text.split('\n')[0].slice(0, 80) || 'Sem título';
}

const STEPS = ['Capturas', 'Metas', 'Tarefas', 'Visão', 'Concluído'];

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

  async function rescheduleTask(task: Task, days: number) {
    if (busyTask || task.planning?.startAt) return;
    setBusyTask(task.id);
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dueDate: addDays(todayStr(), days) }) });
      toast.success('Reagendada!');
      loadAll();
    } catch (err) { toast.error(showError(err)); }
    finally { setBusyTask(null); }
  }

  function finishReview() {
    const now = new Date().toISOString();
    try { localStorage.setItem(LAST_REVIEW_KEY, now); } catch { toast.info('Revisão concluída. O navegador não permitiu guardar a data deste ritual.'); }
    setLastReview(now);
    setStep(4);
    onFinish?.();
  }

  const pendingCaptures = captures.filter(c => c.status === 'inbox');
  const today = todayStr();
  const terminalIds = new Set(stages.filter(stage => stage.isTerminal).map(stage => stage.id));
  const overdueTasks = tasks.filter(t => !terminalIds.has(t.status) && t.dueDate && t.dueDate < today);
  const indicatorsByPillar = pillars.map(p => ({ pillar: p, indicators: indicators.filter(i => i.pillarId === p.id) })).filter(g => g.indicators.length > 0);

  function daysSince(iso: string): number {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    return Number.isFinite(days) ? Math.max(0, days) : 0;
  }

  return (
    <motion.div className="work-page w-full space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <CaptureConversionDialog key={converting?.id || "closed"} capture={converting} onClose={() => setConverting(null)} onConverted={loadAll} />
      <WorkspaceHeading eyebrow="Ajustar a direção" title="Revisão Semanal" description={<><span>Reconheça o progresso, escolha o que continua e abra espaço para a próxima semana.</span><span className="mt-2 block text-xs">{lastReview ? `Última revisão: há ${daysSince(lastReview)} dia${daysSince(lastReview) !== 1 ? 's' : ''}` : 'Seu primeiro ritual de revisão'}</span></>} showContinuations={!embedded} />

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
                    <Inbox className="h-4 w-4 text-primary" /> Processar o INBOX ({pendingCaptures.length})
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Escolha o destino de cada captura ou deixe para depois.</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pendingCaptures.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">INBOX vazia. Nada pra processar 🎉</p>
                  ) : (
                    pendingCaptures.map(c => (
                      <div key={c.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                        <span className="flex-1 truncate text-sm">{c.title || getTitle(c.content)}</span>
                        <Button variant="outline" size="sm" className="h-11 gap-1 text-xs" onClick={() => setConverting(c)}>
                          <ArrowRight className="h-3 w-3" /> Converter
                        </Button>
                      </div>
                    ))
                  )}
                  <Link href="/inbox" className="flex min-h-10 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    Abrir caixa de entrada completa <ArrowRight className="h-3 w-3" />
                  </Link>
                </CardContent>
              </Card>
            )}

            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-purple-500" /> Revisar Metas por pilar
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Como está cada área da sua vida essa semana?</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {indicatorsByPillar.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma meta cadastrada ainda.</p>
                  ) : (
                    indicatorsByPillar.map(({ pillar, indicators: inds }) => (
                      <div key={pillar.id}>
                        <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">{pillar.icon} {pillar.name}</p>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {inds.map(ind => {
                            const pct = ind.targetValue ? Math.min(100, Math.round(((ind.currentValue || 0) / ind.targetValue) * 100)) : null;
                            return (
                              <div key={ind.id} className="rounded-md border px-2.5 py-1.5 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="truncate">{ind.name}</span>
                                  <span className="shrink-0 text-muted-foreground">{ind.currentValue || 0}{ind.targetValue ? `/${ind.targetValue}` : ''}</span>
                                </div>
                                {pct !== null && (
                                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                                    <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-money' : 'bg-primary')} style={{ width: `${pct}%` }} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                  <Link href="/indicadores" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    Abrir Metas completo <ArrowRight className="h-3 w-3" />
                  </Link>
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4 text-destructive" /> Tarefas atrasadas ({overdueTasks.length})
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Concluir, adiar, ou deixar pra próxima revisão.</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {overdueTasks.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Nada atrasado. Tudo em dia 🎉</p>
                  ) : (
                    overdueTasks.map(task => (
                      <div key={task.id} className="rounded-xl border border-destructive/20 p-3">
                        <div className="flex items-start gap-2"><button aria-label={`Concluir ${task.title}`} disabled={!!busyTask || !stages.some(stage => stage.isTerminal)} onClick={() => toggleTaskDone(task)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"><Circle className="h-4 w-4 text-muted-foreground" /></button><div className="min-w-0 flex-1 pt-2"><p className="text-sm font-medium">{task.title}</p><p className="mt-1 text-xs text-destructive">{task.dueDate && new Date(`${task.dueDate}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</p></div></div>
                        <div className="mt-2 flex flex-wrap gap-2 pl-1 sm:pl-13">{task.planning?.startAt ? <Button asChild variant="outline" size="sm"><Link href="/planejar" aria-label={`Replanejar ${task.title}`}>Replanejar horário<ArrowRight className="h-3.5 w-3.5" /></Link></Button> : <><Button variant="outline" size="sm" disabled={!!busyTask} onClick={() => rescheduleTask(task, 1)}>Amanhã</Button><Button variant="ghost" size="sm" disabled={!!busyTask} onClick={() => rescheduleTask(task, 7)}>+7 dias</Button></>}</div>
                      </div>
                    ))
                  )}
                  <Link href="/tarefas" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    Abrir Tarefas completo <ArrowRight className="h-3 w-3" />
                  </Link>
                </CardContent>
              </Card>
            )}

            {step === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-4 w-4 text-primary" /> Reler a Visão
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Um lembrete rápido de pra onde você está indo.</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {VISION_SECTIONS.map(sec => {
                    const doc = vision.find(v => v.section === sec);
                    const hasContent = Boolean(doc?.content?.trim().length);
                    return (
                      <Link key={sec} href="/visao" className="flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
                        {hasContent ? <CheckCircle2 className="h-4 w-4 shrink-0 text-money" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <span className="flex-1 truncate">{doc?.title || sec}</span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </Link>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {step === 4 && (
              <Card className="border-money/30 bg-money/5">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <PartyPopper className="h-10 w-10 text-money mb-3" />
                  <p className="text-lg font-medium">Revisão concluída!</p>
                  <p className="mb-4 px-4 text-center text-sm text-muted-foreground">Seu ritual foi registrado. Você pode voltar às decisões pendentes quando quiser.</p>
                  <Button asChild className="gap-1.5"><Link href="/planejar"><Calendar className="h-4 w-4" />Planejar a próxima semana</Link></Button>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {!loading && !loadError && step < 4 && (
        <div className="mt-6 flex items-center justify-between">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          {step === 3 ? (
            <Button onClick={finishReview} className="gap-1.5">Concluir revisão <CheckCircle2 className="h-4 w-4" /></Button>
          ) : (
            <Button onClick={() => setStep(s => s + 1)} className="gap-1.5">Próximo <ArrowRight className="h-4 w-4" /></Button>
          )}
        </div>
      )}
    </motion.div>
  );
}
