'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { BarChart3, TrendingUp, TrendingDown, Minus, Plus, Trash2, ArrowUpRight, Layers, BookOpen, Target, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch, showError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkspaceHeading, WorkspaceMetric } from '@/components/workspace/workspace-heading';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { IndicatorFrequency, Pillar } from '@/types';

interface Indicator {
  id: string; pillarId: string; name: string; type: 'count' | 'boolean' | 'scale' | 'currency' | 'percentage';
  targetValue?: number; currentValue?: number; frequency: string; history?: number[];
}

const types: [Indicator['type'], string][] = [['count', 'Contador'], ['boolean', 'Sim/Não'], ['scale', 'Escala (1-10)'], ['currency', 'Moeda'], ['percentage', 'Porcentagem']];
const frequencies: { value: IndicatorFrequency; label: string }[] = [
  { value: 'daily', label: 'Diário' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
];
const fade = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };

function normalizeFrequency(value: string): IndicatorFrequency {
  return frequencies.find(f => f.value === value || f.label === value)?.value || 'daily';
}

function frequencyLabel(value: string) {
  return frequencies.find(f => f.value === value || f.label === value)?.label || value;
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1), min = Math.min(...data, 0);
  const points = data.map((value, i) => `${2 + (i / (data.length - 1)) * 116},${34 - ((value - min) / (max - min || 1)) * 30}`).join(' ');
  return <svg viewBox="0 0 120 38" className="h-10 w-full text-primary" aria-hidden="true"><polyline fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" points={points} /></svg>;
}

function formatValue(value: number, type: Indicator['type']) {
  if (type === 'boolean') return value > 0 ? 'Sim' : 'Não';
  if (type === 'currency') return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
  return `${value.toLocaleString('pt-BR')}${type === 'percentage' ? '%' : ''}`;
}

function IndicatorFields({ prefix, pillars, name, setName, pillar, setPillar, type, setType, target, setTarget, frequency, setFrequency, value, setValue, disabled = false }: {
  prefix: string; pillars: Pillar[]; name: string; setName: (v: string) => void; pillar: string; setPillar: (v: string) => void;
  type: Indicator['type']; setType: (v: Indicator['type']) => void; target: string; setTarget: (v: string) => void;
  frequency: IndicatorFrequency; setFrequency: (v: IndicatorFrequency) => void; value?: string; setValue?: (v: string) => void; disabled?: boolean;
}) {
  return <fieldset disabled={disabled} className="grid gap-4 py-4">
    <div className="grid gap-2"><Label htmlFor={`${prefix}-name`}>Nome</Label><Input id={`${prefix}-name`} value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Livros lidos" required /></div>
    <div className="grid gap-2"><Label htmlFor={`${prefix}-pillar`}>Pilar</Label><Select value={pillar} onValueChange={setPillar}><SelectTrigger id={`${prefix}-pillar`} className="min-h-11"><SelectValue placeholder="Selecione um pilar" /></SelectTrigger><SelectContent>{pillars.map(p => <SelectItem key={p.id} value={p.id}>{p.icon} {p.name}</SelectItem>)}</SelectContent></Select></div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-2"><Label htmlFor={`${prefix}-type`}>Tipo</Label><Select value={type} onValueChange={v => setType(v as Indicator['type'])}><SelectTrigger id={`${prefix}-type`} className="min-h-11"><SelectValue /></SelectTrigger><SelectContent>{types.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid gap-2"><Label htmlFor={`${prefix}-frequency`}>Frequência</Label><Select value={frequency} onValueChange={v => setFrequency(v as IndicatorFrequency)}><SelectTrigger id={`${prefix}-frequency`} className="min-h-11"><SelectValue /></SelectTrigger><SelectContent>{frequencies.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent></Select></div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      {setValue && <div className="grid gap-2"><Label htmlFor={`${prefix}-value`}>Valor atual</Label><Input id={`${prefix}-value`} type="number" step="any" value={value} onChange={e => setValue(e.target.value)} /></div>}
      <div className="grid gap-2"><Label htmlFor={`${prefix}-target`}>Meta (opcional)</Label><Input id={`${prefix}-target`} type="number" step="any" value={target} onChange={e => setTarget(e.target.value)} placeholder="Ex: 12" /></div>
    </div>
  </fieldset>;
}

function IndicadoresWorkspace() {
  const searchParams = useSearchParams();
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<Indicator | null>(null);
  const [newName, setNewName] = useState('');
  const [newPillar, setNewPillar] = useState('');
  const [newType, setNewType] = useState<Indicator['type']>('count');
  const [newTarget, setNewTarget] = useState('');
  const [newFrequency, setNewFrequency] = useState<IndicatorFrequency>('daily');
  const [editName, setEditName] = useState('');
  const [editPillar, setEditPillar] = useState('');
  const [editType, setEditType] = useState<Indicator['type']>('count');
  const [editTarget, setEditTarget] = useState('');
  const [editFrequency, setEditFrequency] = useState<IndicatorFrequency>('daily');
  const [editValue, setEditValue] = useState('');

  const loadData = useCallback(async () => {
    setLoadError(''); setIsLoading(true);
    try {
      const [pillarData, indicatorData] = await Promise.all([apiFetch<Pillar[]>('/api/pillars'), apiFetch<Indicator[]>('/api/indicators')]);
      setPillars([...pillarData].sort((a, b) => a.sortOrder - b.sortOrder));
      setIndicators(indicatorData.map(i => ({ ...i, history: i.history || [] })));
    } catch (error) { setLoadError(showError(error)); }
    finally { setIsLoading(false); }
  }, []);
  useEffect(() => { queueMicrotask(() => { void loadData(); }); }, [loadData]);

  async function refreshIndicators() {
    try { setIndicators(await apiFetch<Indicator[]>('/api/indicators')); }
    catch { toast.error('Alteração salva. Recarregue a página para atualizar as metas.'); }
  }

  const activePillar = pillars.find(p => p.id === searchParams.get('pillar'));
  const visiblePillars = activePillar ? [activePillar] : pillars;
  const reached = indicators.filter(i => (i.targetValue || 0) > 0 && (i.currentValue || 0) >= (i.targetValue || 0)).length;
  const covered = new Set(indicators.filter(i => pillars.some(p => p.id === i.pillarId)).map(i => i.pillarId)).size;
  function openCreate(pillarId = activePillar?.id || pillars[0]?.id || '') { setNewPillar(pillarId); setIsDialogOpen(true); }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newPillar || isMutating) return;
    setIsMutating(true);
    try {
      await apiFetch('/api/indicators', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName.trim(), pillarId: newPillar, type: newType, targetValue: newTarget ? parseFloat(newTarget) : undefined, currentValue: 0, frequency: newFrequency, history: [] }) });
      setNewName(''); setNewTarget(''); setIsDialogOpen(false); toast.success('Indicador criado!'); await refreshIndicators();
    } catch (error) { toast.error(showError(error)); }
    finally { setIsMutating(false); }
  }

  function openEdit(indicator: Indicator) {
    setEditingIndicator(indicator); setEditName(indicator.name); setEditPillar(indicator.pillarId); setEditType(indicator.type);
    setEditTarget(indicator.targetValue?.toString() || ''); setEditFrequency(normalizeFrequency(indicator.frequency)); setEditValue(indicator.currentValue?.toString() || '0'); setIsEditOpen(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingIndicator || !editName.trim() || isMutating) return;
    setIsMutating(true);
    const newValue = parseFloat(editValue) || 0;
    try {
      await apiFetch(`/api/indicators/${editingIndicator.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editName.trim(), pillarId: editPillar, type: editType, targetValue: editTarget ? parseFloat(editTarget) : undefined, currentValue: newValue, frequency: editFrequency, history: [...(editingIndicator.history || []), newValue].slice(-12) }) });
      setIsEditOpen(false); toast.success('Indicador atualizado!'); await refreshIndicators();
    } catch (error) { toast.error(showError(error)); }
    finally { setIsMutating(false); }
  }

  async function handleDelete(id: string) {
    if (isMutating) return;
    setIsMutating(true);
    try { await apiFetch(`/api/indicators/${id}`, { method: 'DELETE' }); setIsEditOpen(false); toast.success('Indicador excluído!'); await refreshIndicators(); }
    catch (error) { toast.error(showError(error)); }
    finally { setIsMutating(false); }
  }

  async function handleIncrement(indicator: Indicator, delta: number) {
    if (isMutating) return;
    setIsMutating(true);
    const newValue = Math.max(0, (indicator.currentValue || 0) + delta);
    try { await apiFetch(`/api/indicators/${indicator.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentValue: newValue, history: [...(indicator.history || []), newValue].slice(-12) }) }); await refreshIndicators(); }
    catch (error) { toast.error(showError(error)); }
    finally { setIsMutating(false); }
  }

  return <motion.div className="work-page work-goals p-4 lg:p-8" initial="initial" animate="animate">
    <WorkspaceHeading eyebrow="Cultivar · progresso" title="Metas" description="Transforme a direção de cada pilar em pequenos sinais de avanço. Registre, acompanhe e ajuste o que importa." actions={<>
      <Link className="work-action-link" href="/visao?tab=pilares"><Layers className="h-4 w-4" /> Pilares</Link>
      <Button className="min-h-11" onClick={() => openCreate()} disabled={isLoading || !!loadError || pillars.length === 0}><Plus className="mr-2 h-4 w-4" /> Nova Meta</Button>
    </>}><div className="work-metrics"><WorkspaceMetric label="Metas em acompanhamento" value={isLoading || loadError ? '—' : indicators.length} /><WorkspaceMetric label="Alvos atingidos" value={isLoading || loadError ? '—' : reached} tone="primary" detail="Metas com valor de referência" /><WorkspaceMetric label="Pilares com metas" value={isLoading || loadError ? '—' : `${covered}/${pillars.length}`} /></div></WorkspaceHeading>

    {!isLoading && !loadError && pillars.length > 0 && <nav aria-label="Filtrar metas por pilar" className="mb-6 flex flex-wrap gap-2"><Link href="/indicadores" className={cn('flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors', !activePillar ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40')} aria-current={!activePillar ? 'page' : undefined}>Todos os pilares</Link>{pillars.map(p => <Link key={p.id} href={`/indicadores?pillar=${encodeURIComponent(p.id)}`} aria-current={activePillar?.id === p.id ? 'page' : undefined} className={cn('flex min-h-11 max-w-full items-center gap-2 rounded-full border px-4 text-sm transition-colors', activePillar?.id === p.id ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40')}><span aria-hidden="true">{p.icon}</span><span className="truncate">{p.name}</span></Link>)}</nav>}

    {loadError ? <div role="alert" className="work-empty"><BarChart3 className="h-8 w-8 text-muted-foreground" /><p>Não foi possível carregar suas metas.</p><span>{loadError}</span><Button variant="outline" className="min-h-11" onClick={() => void loadData()}>Tentar novamente</Button></div> : isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Carregando metas">{Array.from({ length: 6 }).map((_, i) => <Card key={i}><CardContent className="space-y-5 p-5"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-10 w-1/2" /><Skeleton className="h-2 w-full" /></CardContent></Card>)}</div> : pillars.length === 0 ? <div className="work-empty"><Layers className="h-8 w-8 text-primary" /><h2 className="font-display text-2xl">Dê uma direção às suas metas</h2><span>Organize as áreas da sua vida para vincular a primeira meta.</span><Link href="/visao?tab=pilares" className="work-action-link">Conhecer meus pilares <ArrowUpRight className="h-4 w-4" /></Link></div> : <div className="space-y-8">{visiblePillars.map(pillar => {
      const pillarIndicators = indicators.filter(i => i.pillarId === pillar.id);
      return <motion.section key={pillar.id} variants={fade} aria-labelledby={`goals-${pillar.id}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border bg-card text-xl" aria-hidden="true">{pillar.icon}</span><div><p className="mb-1 text-[10px] uppercase tracking-[.16em] text-muted-foreground">{pillarIndicators.length} {pillarIndicators.length === 1 ? 'meta' : 'metas'}</p><h2 id={`goals-${pillar.id}`} className="font-display text-2xl leading-tight">{pillar.name}</h2></div></div><Button variant="ghost" className="min-h-11 text-primary" aria-label={`Criar meta para ${pillar.name}`} onClick={() => openCreate(pillar.id)}><Plus className="mr-2 h-4 w-4" /> Criar meta</Button></div>
        {pillarIndicators.length === 0 ? <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed bg-card/40 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">Um pequeno avanço já conta.</p><p className="mt-1 text-sm text-muted-foreground">Escolha um hábito ou resultado para acompanhar neste pilar.</p></div><Button variant="outline" className="min-h-11 shrink-0" onClick={() => openCreate(pillar.id)}>Definir primeira meta <ArrowUpRight className="ml-2 h-4 w-4" /></Button></div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{pillarIndicators.map(indicator => {
          const value = indicator.currentValue || 0;
          const hasTarget = (indicator.targetValue || 0) > 0;
          const progress = hasTarget ? (value / indicator.targetValue!) * 100 : 0;
          const history = indicator.history || [];
          const change = history.length >= 2 ? history[history.length - 1] - history[history.length - 2] : null;
          return <Card key={indicator.id} className="overflow-hidden rounded-2xl transition-colors hover:border-primary/40"><CardContent className="p-5">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><Badge variant="outline" className="mb-3 text-[10px] font-normal">{frequencyLabel(indicator.frequency)}</Badge><button className="flex min-h-11 w-full items-start gap-2 text-left text-base font-medium leading-snug hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded" onClick={() => openEdit(indicator)} aria-label={`Editar meta ${indicator.name}`}><span className="break-words">{indicator.name}</span><Edit2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /></button></div><Target className="mt-1 h-4 w-4 shrink-0 text-primary/60" aria-hidden="true" /></div>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-3"><div className="min-w-0"><p className="break-words font-display text-3xl tracking-tight">{formatValue(value, indicator.type)}</p><p className="mt-1 text-xs text-muted-foreground">{hasTarget ? `Alvo: ${formatValue(indicator.targetValue!, indicator.type)}` : 'Sem alvo definido'}</p></div><div className="flex gap-1 rounded-xl border bg-background/50 p-1"><Button variant="ghost" size="icon" className="h-10 w-10" disabled={isMutating || value <= 0} aria-label={`Diminuir ${indicator.name}`} onClick={() => void handleIncrement(indicator, -1)}><Minus className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-10 w-10" disabled={isMutating} aria-label={`Aumentar ${indicator.name}`} onClick={() => void handleIncrement(indicator, 1)}><Plus className="h-4 w-4" /></Button></div></div>
            {hasTarget && <div className="mt-5"><div className="mb-2 flex items-center justify-between text-xs"><span className="text-muted-foreground">{progress >= 100 ? 'Meta atingida' : 'Avanço até o alvo'}</span><span className={cn('font-medium tabular-nums', progress >= 100 && 'text-money')}>{Math.round(progress)}%</span></div><Progress value={Math.min(100, Math.max(0, progress))} className="h-1.5" aria-label={`Progresso de ${indicator.name}`} /></div>}
            {history.length >= 2 && <div className="mt-5 border-t pt-3"><Sparkline data={history} /><p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">{change! > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : change! < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}{change! > 0 ? 'Valor aumentou' : change! < 0 ? 'Valor diminuiu' : 'Valor estável'} desde o último registro</p></div>}
          </CardContent></Card>;
        })}</div>}
      </motion.section>;
    })}</div>}

    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-5"><p className="text-sm text-muted-foreground">Os números ganham contexto na reflexão.</p><Link href="/diario" className="work-action-link"><BookOpen className="h-4 w-4" /> Registrar no diário <ArrowUpRight className="h-3.5 w-3.5" /></Link></div>
    <Dialog open={isDialogOpen} onOpenChange={open => { if (!isMutating) setIsDialogOpen(open); }}><DialogContent className="max-h-[85dvh] overflow-y-auto"><form onSubmit={handleCreate}><DialogHeader><DialogTitle>Nova Meta</DialogTitle><DialogDescription>Escolha um sinal de progresso e o pilar que ele fortalece.</DialogDescription></DialogHeader><IndicatorFields disabled={isMutating} prefix="new-goal" pillars={pillars} name={newName} setName={setNewName} pillar={newPillar} setPillar={setNewPillar} type={newType} setType={setNewType} target={newTarget} setTarget={setNewTarget} frequency={newFrequency} setFrequency={setNewFrequency} /><DialogFooter><Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isMutating} className="min-h-11">Cancelar</Button><Button type="submit" disabled={!newName.trim() || !newPillar || isMutating} className="min-h-11">{isMutating ? 'Criando...' : 'Criar'}</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={isEditOpen} onOpenChange={open => { if (!isMutating) setIsEditOpen(open); }}><DialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto"><form onSubmit={handleSaveEdit}><DialogHeader><DialogTitle>Editar Meta</DialogTitle><DialogDescription>Atualize o valor ou ajuste a meta ao seu momento.</DialogDescription></DialogHeader><IndicatorFields disabled={isMutating} prefix="edit-goal" pillars={pillars} name={editName} setName={setEditName} pillar={editPillar} setPillar={setEditPillar} type={editType} setType={setEditType} target={editTarget} setTarget={setEditTarget} frequency={editFrequency} setFrequency={setEditFrequency} value={editValue} setValue={setEditValue} /><DialogFooter className="gap-2">{editingIndicator && <Button type="button" variant="ghost" className="min-h-11 text-destructive sm:mr-auto" disabled={isMutating} onClick={() => void handleDelete(editingIndicator.id)}><Trash2 className="mr-2 h-4 w-4" /> Excluir</Button>}<Button type="button" variant="outline" className="min-h-11" disabled={isMutating} onClick={() => setIsEditOpen(false)}>Cancelar</Button><Button type="submit" className="min-h-11" disabled={isMutating || !editName.trim()}>{isMutating ? 'Salvando...' : 'Salvar'}</Button></DialogFooter></form></DialogContent></Dialog>
  </motion.div>;
}

export default function IndicadoresPage() {
  return <Suspense fallback={<div className="p-4 lg:p-8"><Skeleton className="h-48 w-full rounded-3xl" /></div>}><IndicadoresWorkspace /></Suspense>;
}
