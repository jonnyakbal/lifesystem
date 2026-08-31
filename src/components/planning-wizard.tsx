'use client';

// The "cruzar todos os pilares num fluxo só" wizard the queue's future-ideas
// section flagged (Semrush Intergalactic / gov.br DS / Eleken wizard
// patterns). Distinct from the Weekly Review: that one processes what
// already exists (INBOX, overdue tasks, metas). This one is forward-looking
// — it walks pillar by pillar and lets you drop new Tarefas/Conteúdo/Notas
// for the chosen horizon, tagging each with the pillar so they stay
// traceable without any schema change.
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2, CheckSquare, FileText, NotebookText, ArrowRight, ArrowLeft,
  SkipForward, Sparkles, Trash2, PartyPopper, Sun, CalendarDays, CalendarRange,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';

type Mode = 'dia' | 'semana' | 'mes';
type ItemType = 'task' | 'content' | 'note';

interface Pillar { id: string; name: string; icon: string; target?: string; sortOrder: number; }
interface Indicator { id: string; pillarId: string; name: string; targetValue?: number; currentValue?: number; }

interface CreatedItem {
  id: string;
  type: ItemType;
  title: string;
  pillarId: string;
  pillarName: string;
  pillarIcon: string;
}

const MODES: { id: Mode; label: string; hint: string; icon: typeof Sun }[] = [
  { id: 'dia', label: 'Dia', hint: 'O que precisa acontecer hoje em cada pilar', icon: Sun },
  { id: 'semana', label: 'Semana', hint: 'O que essa semana pede de cada pilar', icon: CalendarDays },
  { id: 'mes', label: 'Mês', hint: 'Marcos e direção do mês em cada pilar', icon: CalendarRange },
];

const TYPE_CONFIG: Record<ItemType, { label: string; icon: typeof CheckSquare; placeholder: string }> = {
  task: { label: 'Tarefa', icon: CheckSquare, placeholder: 'O que precisa ser feito?' },
  content: { label: 'Conteúdo', icon: FileText, placeholder: 'Ideia de conteúdo...' },
  note: { label: 'Nota', icon: NotebookText, placeholder: 'Anotação, lembrete, ideia solta...' },
};

function todayStr() { return new Date().toISOString().split('T')[0]; }

export function PlanningWizard() {
  const [loading, setLoading] = useState(true);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [step, setStep] = useState(0); // 0 = modo, 1..N = pilares, N+1 = resumo
  const [mode, setMode] = useState<Mode | null>(null);
  const [itemType, setItemType] = useState<ItemType>('task');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [createdItems, setCreatedItems] = useState<CreatedItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [p, i] = await Promise.all([
          apiFetch<Pillar[]>('/api/pillars'),
          apiFetch<Indicator[]>('/api/indicators'),
        ]);
        setPillars([...p].sort((a, b) => a.sortOrder - b.sortOrder));
        setIndicators(i);
      } catch (err) {
        toast.error(showError(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalSteps = pillars.length + 2; // modo + pilares + resumo
  const summaryStep = pillars.length + 1;
  const currentPillar = step >= 1 && step <= pillars.length ? pillars[step - 1] : null;
  const modeConfig = mode ? MODES.find(m => m.id === mode)! : null;

  const pillarIndicators = useMemo(
    () => currentPillar ? indicators.filter(i => i.pillarId === currentPillar.id) : [],
    [currentPillar, indicators]
  );

  async function addItem() {
    if (!title.trim() || !currentPillar || !mode) return;
    setSaving(true);
    try {
      const dueToday = mode === 'dia' ? todayStr() : undefined;
      let id: string;
      if (itemType === 'task') {
        const task = await apiFetch<{ id: string }>('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim(), pillarId: currentPillar.id, dueDate: dueToday, tags: [currentPillar.name] }),
        });
        id = task.id;
      } else if (itemType === 'content') {
        const content = await apiFetch<{ id: string }>('/api/content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim(), tags: [currentPillar.name], scheduledDate: dueToday }),
        });
        id = content.id;
      } else {
        const note = await apiFetch<{ id: string }>('/api/captures', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: title.trim(), type: 'text', category: currentPillar.name, status: 'noted' }),
        });
        id = note.id;
      }
      setCreatedItems(prev => [...prev, {
        id, type: itemType, title: title.trim(), pillarId: currentPillar.id, pillarName: currentPillar.name, pillarIcon: currentPillar.icon,
      }]);
      setTitle('');
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(item: CreatedItem) {
    const endpoint = item.type === 'task' ? '/api/tasks' : item.type === 'content' ? '/api/content' : '/api/captures';
    try {
      await apiFetch(`${endpoint}/${item.id}`, { method: 'DELETE' });
      setCreatedItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err) {
      toast.error(showError(err));
    }
  }

  function goNext() {
    setTitle('');
    setStep(s => Math.min(s + 1, summaryStep));
  }
  function goBack() {
    setTitle('');
    setStep(s => Math.max(s - 1, 0));
  }
  function restart() {
    setMode(null);
    setStep(0);
    setCreatedItems([]);
    setTitle('');
  }

  const currentPillarItems = currentPillar ? createdItems.filter(i => i.pillarId === currentPillar.id) : [];

  return (
    <motion.div className="w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">Planejar</h1>
        <p className="text-muted-foreground">Um passo por pilar — crie o que precisa existir, sem abrir tela por tela.</p>
      </div>

      {/* Stepper */}
      {mode && (
        <div className="mb-8 flex items-center gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className="flex flex-1 items-center gap-1">
              <div className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium transition-colors',
                i < step ? 'bg-money text-white' : i === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              )}>
                {i < step ? <CheckCircle2 className="h-3 w-3" /> : i === 0 ? modeConfig?.icon && <modeConfig.icon className="h-3 w-3" /> : i}
              </div>
              {i < totalSteps - 1 && <div className={cn('h-0.5 flex-1 rounded-full', i < step ? 'bg-money' : 'bg-muted')} />}
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>

            {step === 0 && (
              <div className="grid gap-3 sm:grid-cols-3">
                {MODES.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setMode(m.id); setStep(1); }}
                    className="group flex flex-col items-start gap-2 rounded-xl border p-5 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
                  >
                    <m.icon className="h-6 w-6 text-primary" />
                    <span className="font-medium">{m.label}</span>
                    <span className="text-xs text-muted-foreground">{m.hint}</span>
                  </button>
                ))}
              </div>
            )}

            {currentPillar && mode && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="text-lg">{currentPillar.icon}</span> {currentPillar.name}
                  </CardTitle>
                  {currentPillar.target && (
                    <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {currentPillar.target}
                    </p>
                  )}
                  {pillarIndicators.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {pillarIndicators.length} meta{pillarIndicators.length !== 1 ? 's' : ''} ativa{pillarIndicators.length !== 1 ? 's' : ''} nesse pilar
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-1.5">
                    {(Object.keys(TYPE_CONFIG) as ItemType[]).map(t => (
                      <Button
                        key={t}
                        type="button"
                        variant={itemType === t ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => setItemType(t)}
                      >
                        {(() => { const Icon = TYPE_CONFIG[t].icon; return <Icon className="h-3.5 w-3.5" />; })()}
                        {TYPE_CONFIG[t].label}
                      </Button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={TYPE_CONFIG[itemType].placeholder}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !saving) addItem(); }}
                    />
                    <Button onClick={addItem} disabled={!title.trim() || saving}>Adicionar</Button>
                  </div>

                  {currentPillarItems.length > 0 && (
                    <div className="space-y-1.5">
                      {currentPillarItems.map(item => {
                        const Icon = TYPE_CONFIG[item.type].icon;
                        return (
                          <div key={item.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="flex-1 truncate">{item.title}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeItem(item)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {step === summaryStep && mode && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PartyPopper className="h-4 w-4 text-money" /> Planejamento do{mode === 'dia' ? ' dia' : mode === 'semana' ? 'a semana' : ' mês'} pronto
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {createdItems.length === 0 ? 'Nada criado nesta rodada.' : `${createdItems.length} item${createdItems.length !== 1 ? 's' : ''} criado${createdItems.length !== 1 ? 's' : ''}, distribuído${createdItems.length !== 1 ? 's' : ''} pelos pilares.`}
                  </p>
                </CardHeader>
                {createdItems.length > 0 && (
                  <CardContent className="space-y-1.5">
                    {createdItems.map(item => {
                      const Icon = TYPE_CONFIG[item.type].icon;
                      return (
                        <div key={item.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                          <span>{item.pillarIcon}</span>
                          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="flex-1 truncate">{item.title}</span>
                        </div>
                      );
                    })}
                  </CardContent>
                )}
              </Card>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {mode && (
        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" onClick={goBack} disabled={step === 0} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          {step === summaryStep ? (
            <Button onClick={restart} className="gap-1.5">Planejar outro horizonte</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={goNext} className="gap-1.5">
                <SkipForward className="h-4 w-4" /> Pular
              </Button>
              <Button onClick={goNext} className="gap-1.5">
                {step === pillars.length ? 'Concluir' : 'Próximo'} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
