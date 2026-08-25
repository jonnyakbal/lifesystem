'use client';

// A guided, manual ritual — not automation. The Metodologia doc (Visão →
// custom section) is explicit that memory/review has to be an intentional
// act, not something silently generated for you. This walks the same path
// GTD's Weekly Review and Sunsama's "shutdown" ritual do: process what's
// piled up, check the health of each area, clear what's overdue, and
// reconnect with the long-range plan — one deliberate screen at a time.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import {
  Inbox, Sparkles, AlertTriangle, Target, CheckCircle2, ArrowRight, ArrowLeft,
  CheckSquare, FolderKanban, Circle, PartyPopper, Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import { spawnNextOccurrenceIfRecurring, type RecurringFrequency } from '@/lib/recurring';

interface Capture { id: string; content: string; title?: string; status: string; targetId?: string; createdAt: string; }
interface Indicator { id: string; pillarId: string; name: string; targetValue?: number; currentValue?: number; frequency: string; }
interface Pillar { id: string; name: string; icon: string; }
interface Task {
  id: string; title: string; status: string; priority: string; dueDate?: string;
  description?: string; projectId?: string; pillarId?: string; tags?: string[];
  recurring?: boolean; recurringFrequency?: RecurringFrequency;
}
interface VisionDoc { id: string; section: string; title: string; content?: string; }

const LAST_REVIEW_KEY = 'lifesystem-last-weekly-review';
const VISION_SECTIONS = ['identity', 'vision_5y', 'timeline', 'dream', 'custom'];

function getTitle(content: string): string {
  const text = content.replace(/<[^>]*>/g, '').trim();
  return text.split('\n')[0].slice(0, 80) || 'Sem título';
}

function todayStr() { return new Date().toISOString().split('T')[0]; }

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const STEPS = ['Capturas', 'Metas', 'Tarefas', 'Visão', 'Concluído'];

export default function RevisaoPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [vision, setVision] = useState<VisionDoc[]>([]);
  const [lastReview, setLastReview] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
    setLastReview(localStorage.getItem(LAST_REVIEW_KEY));
  }, []);

  async function loadAll() {
    try {
      const [c, i, p, t, v] = await Promise.all([
        apiFetch<Capture[]>('/api/captures'),
        apiFetch<Indicator[]>('/api/indicators'),
        apiFetch<Pillar[]>('/api/pillars'),
        apiFetch<Task[]>('/api/tasks'),
        apiFetch<VisionDoc[]>('/api/vision'),
      ]);
      setCaptures(c); setIndicators(i); setPillars(p); setTasks(t); setVision(v);
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleConvert(capture: Capture, targetType: 'task' | 'project') {
    try {
      const title = getTitle(capture.content);
      const created = targetType === 'task'
        ? await apiFetch<{ id: string }>('/api/tasks', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, priority: 'normal', status: 'todo', sortOrder: 0, tags: [], checklist: [] }),
          })
        : await apiFetch<{ id: string }>('/api/projects', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: title, description: capture.content.replace(/<[^>]*>/g, '').slice(0, 300), status: 'idea', stack: [], needs: '', links: [], tasksCount: 0, tasksDone: 0 }),
          });
      await apiFetch(`/api/captures/${capture.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId: created.id, status: 'organized' }),
      });
      loadAll();
      toast.success(targetType === 'task' ? 'Virou tarefa!' : 'Virou projeto!');
    } catch (err) { toast.error(showError(err)); }
  }

  async function toggleTaskDone(task: Task) {
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'done' }) });
      toast.success('Tarefa concluída! 🎉');
      await spawnNextOccurrenceIfRecurring(task);
      loadAll();
    } catch (err) { toast.error(showError(err)); }
  }

  async function rescheduleTask(task: Task, days: number) {
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dueDate: addDays(todayStr(), days) }) });
      toast.success('Reagendada!');
      loadAll();
    } catch (err) { toast.error(showError(err)); }
  }

  function finishReview() {
    const now = new Date().toISOString();
    localStorage.setItem(LAST_REVIEW_KEY, now);
    setLastReview(now);
    setStep(4);
  }

  const pendingCaptures = captures.filter(c => c.status === 'inbox');
  const today = todayStr();
  const overdueTasks = tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < today);
  const indicatorsByPillar = pillars.map(p => ({ pillar: p, indicators: indicators.filter(i => i.pillarId === p.id) })).filter(g => g.indicators.length > 0);

  function daysSince(iso: string): number {
    return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  }

  return (
    <motion.div className="p-8 max-w-3xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">Revisão Semanal</h1>
        <p className="text-muted-foreground">
          {lastReview ? `Última revisão: há ${daysSince(lastReview)} dia${daysSince(lastReview) !== 1 ? 's' : ''}` : 'Primeira revisão'}
        </p>
      </div>

      {/* Stepper */}
      <div className="mb-8 flex items-center gap-1.5">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-1.5">
            <div className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors',
              i < step ? 'bg-money text-white' : i === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}>
              {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && <div className={cn('h-0.5 flex-1 rounded-full', i < step ? 'bg-money' : 'bg-muted')} />}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>

            {step === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Inbox className="h-4 w-4 text-yellow-500" /> Processar o INBOX ({pendingCaptures.length})
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Cada captura vira uma tarefa, um projeto, ou fica como está.</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pendingCaptures.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">INBOX vazia. Nada pra processar 🎉</p>
                  ) : (
                    pendingCaptures.map(c => (
                      <div key={c.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                        <span className="flex-1 truncate text-sm">{c.title || getTitle(c.content)}</span>
                        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => handleConvert(c, 'task')}>
                          <CheckSquare className="h-3 w-3" /> Tarefa
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => handleConvert(c, 'project')}>
                          <FolderKanban className="h-3 w-3" /> Projeto
                        </Button>
                      </div>
                    ))
                  )}
                  <Link href="/inbox" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    Abrir INBOX completo <ArrowRight className="h-3 w-3" />
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
                      <div key={task.id} className="flex items-center gap-2 rounded-lg border border-destructive/30 px-3 py-2">
                        <button onClick={() => toggleTaskDone(task)} className="shrink-0"><Circle className="h-4 w-4 text-muted-foreground" /></button>
                        <span className="flex-1 truncate text-sm">{task.title}</span>
                        <span className="shrink-0 text-xs text-destructive">{task.dueDate}</span>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => rescheduleTask(task, 1)}>Amanhã</Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => rescheduleTask(task, 7)}>+7 dias</Button>
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
                  <p className="mb-4 text-sm text-muted-foreground">Semana processada, INBOX limpo, direção clara.</p>
                  <Link href="/hoje"><Button className="gap-1.5"><Calendar className="h-4 w-4" /> Ver Hoje</Button></Link>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {!loading && step < 4 && (
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
