'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, ArrowRight, Check, ChevronRight, Droplets, HeartPulse, MoonStar, Plus, Scale, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import { WorkspaceHeading, WorkspaceMetric } from '@/components/workspace/workspace-heading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { HealthContext, HealthContextData, HealthObservation, HealthProposal } from '@/lib/health/schemas';
import type { Pillar } from '@/types';

type Summary = { observations: number; counts: Record<string, number>; waterMl: number; sleepMinutes: number; averageEnergy: number | null; averageStress: number | null; averageWeightKg: number | null; coverage: { observedDays: number; missingMeansUnknown: boolean } };
const labels: Record<string, string> = { water: 'Água', weight: 'Peso', sleep: 'Sono', meal: 'Refeição', movement: 'Movimento', energy: 'Energia', stress: 'Estresse' };
const icons: Record<string, typeof Droplets> = { water: Droplets, weight: Scale, sleep: MoonStar, meal: Sparkles, movement: Activity, energy: HeartPulse, stress: Activity };
const types = Object.keys(labels);

function period() {
  const now = new Date(); const start = new Date(now); start.setDate(now.getDate() - 6);
  const localDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { from: localDay(start), to: localDay(now) };
}
function displayDate(value: string) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
function details(item: HealthObservation) {
  const data = item.data;
  switch (data.type) {
    case 'water': return `${data.ml} ml`;
    case 'weight': return `${data.kg.toLocaleString('pt-BR')} kg`;
    case 'sleep': return item.durationMinutes === null ? 'Horário parcial' : `${Math.floor(item.durationMinutes / 60)}h ${item.durationMinutes % 60}min`;
    case 'meal': return data.description;
    case 'movement': return `${data.activity}${data.durationMinutes ? ` · ${data.durationMinutes} min` : ''}`;
    case 'energy': case 'stress': return `${data.score}/10 · autorrelato`;
  }
}
function proposalDetails(data: Extract<HealthProposal['input'], { operation: 'record' }>['observation']) {
  switch (data.type) {
    case 'water': return `${data.ml} ml consumidos`;
    case 'weight': return `${data.kg} kg medidos`;
    case 'sleep': return `Início: ${data.startedAt ? displayDate(data.startedAt) : 'não informado'} · Fim: ${data.endedAt ? displayDate(data.endedAt) : 'não informado'}`;
    case 'meal': return data.description;
    case 'movement': return `${data.activity} · realização relatada${data.durationMinutes ? ` · ${data.durationMinutes} min` : ''}`;
    case 'energy': case 'stress': return `${data.score}/10 · percepção relatada`;
  }
}
function localValue(value: string) { return value.slice(0, 16); }
function nowLocal() { const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); return now.toISOString().slice(0, 16); }
function dayKey(value: string) { return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)); }
/** 7 dias de sono e água; dia sem registro fica vazio (desconhecido), nunca zero. */
function weekBars(items: HealthObservation[], from: string) {
  const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(`${from}T12:00:00`); date.setDate(date.getDate() + index); return dayKey(date.toISOString()); });
  return days.map(day => {
    const ofDay = items.filter(item => dayKey(item.observedAt) === day);
    const sleep = ofDay.filter(item => item.data.type === 'sleep' && item.durationMinutes !== null);
    const water = ofDay.filter(item => item.data.type === 'water');
    return {
      day, label: new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(new Date(`${day}T12:00:00`)).replace('.', ''),
      sleepMinutes: sleep.length ? sleep.reduce((sum, item) => sum + (item.durationMinutes || 0), 0) : null,
      waterMl: water.length ? water.reduce((sum, item) => sum + (item.data.type === 'water' ? item.data.ml : 0), 0) : null,
    };
  });
}
const emptyContext: HealthContextData = { profile: null, objectives: [], preferences: [], routines: [], limitations: null, equipment: null, healthPillarIds: [] };
function lines(value: string) { return value.split('\n').map(item => item.trim()).filter(Boolean); }

function ProposalPreview({ proposal }: { proposal: HealthProposal }) {
  const input = proposal.input;
  if (input.operation === 'context') return <div className="space-y-2 text-sm">
    <strong>Contexto e objetivos · revisão {input.expectedRevision}</strong>
    <p>Objetivos: {input.context.objectives.join(' · ') || 'não informados'}</p>
    <p>Preferências: {input.context.preferences.join(' · ') || 'não informadas'}</p>
    <p>Rotinas: {input.context.routines.map(item => `${item.dayType}: ${item.description}`).join(' · ') || 'não informadas'}</p>
    <p>Perfil: {input.context.profile ?? 'desconhecido'} · Limitações: {input.context.limitations ?? 'desconhecidas'} · Equipamento: {input.context.equipment ?? 'desconhecido'}</p>
    <p className="break-all text-xs text-muted-foreground">Pilares autorizados: {input.context.healthPillarIds.join(', ') || 'nenhum'}</p>
  </div>;
  if (input.operation === 'task_create') return <div className="space-y-1 text-sm"><strong>Criar tarefa: {input.task.title}</strong><p>Prioridade {input.task.priority} · prazo {input.task.dueDate || 'sem data'}</p><p>{input.task.description || 'Sem descrição'}</p><p className="break-all text-xs text-muted-foreground">Pilar {input.task.pillarId} · contexto revisão {input.expectedContextRevision}</p></div>;
  if (input.operation === 'task_plan') return <div className="space-y-1 text-sm"><strong>Reservar bloco para {input.expectedTitle}</strong><p>{input.planning.date} · {input.planning.startAt || 'sem horário'} até {input.planning.endAt || 'sem horário'} · {input.planning.timeZone}</p><p>{input.planning.syncToGoogle ? 'Espelhar no Google Agenda' : 'Somente no LifeSystem'}</p><p className="break-all text-xs text-muted-foreground">Tarefa {input.taskId} · revisão {input.expectedUpdatedAt} · contexto {input.expectedContextRevision}</p></div>;
  return <div className="space-y-1"><strong className="block text-sm">{labels[input.observation.type]}</strong><p className="text-sm text-foreground/85">{proposalDetails(input.observation)}</p><p className="text-xs text-muted-foreground">Observado em {displayDate(input.observation.observedAt)} · {input.observation.timezone}</p>{input.operation === 'correct' && <p className="text-xs text-muted-foreground">Alvo {input.observationId} · revisão {input.expectedRevision} · motivo: {input.reason}</p>}{input.observation.sourceRef && <p className="text-xs text-muted-foreground">Fonte: {input.observation.sourceRef}</p>}{(input.observation.pillarId || input.observation.indicatorId) && <p className="break-all text-xs text-muted-foreground">Pilar {input.observation.pillarId || 'não associado'} · indicador {input.observation.indicatorId || 'não associado'}</p>}</div>;
}

export default function HealthPage() {
  const [items, setItems] = useState<HealthObservation[]>([]);
  const [week, setWeek] = useState<HealthObservation[]>([]);
  const [proposals, setProposals] = useState<HealthProposal[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [context, setContext] = useState<HealthContext | null>(null);
  const [contextDraft, setContextDraft] = useState<HealthContextData>(emptyContext);
  const [contextOpen, setContextOpen] = useState(false);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<HealthObservation | 'new' | null>(null);
  const [type, setType] = useState('water');
  const [observedAt, setObservedAt] = useState('');
  const [value, setValue] = useState('');
  const [startedAt, setStartedAt] = useState('');
  const [endedAt, setEndedAt] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const retry = useRef<{ payload: string; key: string } | null>(null);
  const dates = period();

  const load = useCallback(async () => {
    try {
      const [observations, weekItems, pending, overview, currentContext, allPillars] = await Promise.all([
        apiFetch<{ items: HealthObservation[] }>('/api/health?view=observations&limit=30'),
        apiFetch<{ items: HealthObservation[] }>(`/api/health?view=observations&from=${dates.from}&to=${dates.to}&limit=100`),
        apiFetch<{ items: HealthProposal[] }>('/api/health?view=proposals'),
        apiFetch<Summary>(`/api/health?view=summary&from=${dates.from}&to=${dates.to}`),
        apiFetch<HealthContext>('/api/health?view=context'),
        apiFetch<Pillar[]>('/api/pillars'),
      ]);
      setItems(observations.items); setWeek(weekItems.items); setProposals(pending.items); setSummary(overview); setContext(currentContext); setPillars(allPillars);
    } catch (error) { toast.error(showError(error)); }
    finally { setLoading(false); }
  // Period is fixed for this mount; refresh on mutation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { const handle = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(handle); }, [load]);

  // "Quando" vem preenchido com agora, visível e editável: é você confirmando, não o sistema inventando.
  function openNew(kind = 'water') {
    setEditor('new'); setType(kind); setObservedAt(nowLocal()); setValue(''); setStartedAt(''); setEndedAt(''); setReason(''); retry.current = null;
  }
  function openCorrection(item: HealthObservation) {
    setEditor(item); setType(item.data.type); setObservedAt(localValue(item.data.observedAt));
    const data = item.data;
    setValue(data.type === 'water' ? String(data.ml) : data.type === 'weight' ? String(data.kg) : data.type === 'energy' || data.type === 'stress' ? String(data.score) : data.type === 'meal' ? data.description : data.type === 'movement' ? data.activity : '');
    setStartedAt(data.type === 'sleep' && data.startedAt ? localValue(data.startedAt) : '');
    setEndedAt(data.type === 'sleep' && data.endedAt ? localValue(data.endedAt) : '');
    setReason(''); retry.current = null;
  }
  async function save() {
    if (!editor) return;
    try {
      if (!observedAt) throw new Error('Informe quando você observou. Não vamos inventar a data.');
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
      const common = { type, observedAt: new Date(observedAt).toISOString(), timezone };
      const observation = type === 'water' ? { ...common, ml: Number(value) }
        : type === 'weight' ? { ...common, kg: Number(value) }
        : type === 'energy' || type === 'stress' ? { ...common, score: Number(value) }
        : type === 'meal' ? { ...common, description: value }
        : type === 'movement' ? { ...common, activity: value, completed: true }
        : { ...common, startedAt: startedAt ? new Date(startedAt).toISOString() : undefined, endedAt: endedAt ? new Date(endedAt).toISOString() : undefined };
      const payload = editor === 'new' ? { action: 'record', observation } : { action: 'correct', id: editor.id, expectedRevision: editor.revision, observation, reason };
      const serialized = JSON.stringify(payload);
      if (retry.current?.payload !== serialized) retry.current = { payload: serialized, key: crypto.randomUUID() };
      setBusy(true);
      await apiFetch('/api/health', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, idempotencyKey: retry.current.key }) });
      toast.success(editor === 'new' ? 'Observação registrada' : 'Correção registrada com histórico');
      setEditor(null); retry.current = null; await load();
    } catch (error) { toast.error(showError(error)); }
    finally { setBusy(false); }
  }
  async function approve(proposal: HealthProposal) {
    try {
      setBusy(true);
      await apiFetch('/api/health/approval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proposalId: proposal.id, revision: proposal.revision, hash: proposal.hash }) });
      toast.success('Proposta aprovada. O agente pode aplicar esta intenção exata.'); await load();
    } catch (error) { toast.error(showError(error)); }
    finally { setBusy(false); }
  }
  function editContext() { setContextDraft(structuredClone(context?.data || emptyContext)); setContextOpen(true); retry.current = null; }
  async function saveContext() {
    try {
      const payload = { action: 'context', context: contextDraft, expectedRevision: context?.revision || 0 };
      const serialized = JSON.stringify(payload);
      if (retry.current?.payload !== serialized) retry.current = { payload: serialized, key: crypto.randomUUID() };
      setBusy(true);
      await apiFetch('/api/health', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, idempotencyKey: retry.current.key }) });
      toast.success('Contexto atualizado'); setContextOpen(false); retry.current = null; await load();
    } catch (error) { toast.error(showError(error)); }
    finally { setBusy(false); }
  }

  // A API lista na ordem de registro (contrato do Órion); a linha do tempo mostra pela hora do fato.
  const timeline = [...items].sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
  const bars = weekBars(week, dates.from);
  const maxSleep = Math.max(480, ...bars.map(bar => bar.sleepMinutes || 0));
  const maxWater = Math.max(2000, ...bars.map(bar => bar.waterMl || 0));

  return <div className="mx-auto w-full max-w-[1180px] space-y-7 px-4 pb-20 pt-5 sm:px-7 lg:px-10">
    <WorkspaceHeading eyebrow="CULTIVAR · SEU HISTÓRICO" title="Corpo & saúde" description="Registre o que aconteceu de verdade. Lacunas continuam lacunas; seus relatos não viram diagnóstico." actions={<Button onClick={() => openNew()} className="gap-2"><Plus className="h-4 w-4" />Registrar observação</Button>}>
      <WorkspaceMetric label="relatos · 7 dias" value={summary?.observations ?? '—'} detail="Apenas o que foi informado" />
      <WorkspaceMetric label="dias com registro" value={summary?.coverage.observedDays ?? '—'} detail="Dias sem registro são desconhecidos" />
    </WorkspaceHeading>

    {proposals.length > 0 && <section aria-label="Revisões do Orion" className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <p className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-4 w-4 text-primary" />Órion propôs {proposals.length === 1 ? '1 registro' : `${proposals.length} registros`} · revise antes de aplicar</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">{proposals.map(proposal => <div key={proposal.id} className="rounded-lg bg-background/60 p-3">
        <p className="mb-1 text-xs uppercase tracking-wide text-primary">{proposal.input.operation === 'context' ? 'Novo contexto' : proposal.input.operation === 'record' ? 'Novo relato' : proposal.input.operation === 'correct' ? 'Correção proposta' : proposal.input.operation === 'task_create' ? 'Nova tarefa' : 'Bloco de horário'}</p>
        <ProposalPreview proposal={proposal} />
        <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">Ver dados completos</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-background p-2">{JSON.stringify(proposal.input, null, 2)}</pre><p className="mt-1 break-all font-mono text-[10px]">Hash {proposal.hash.slice(0, 16)}… · expira {displayDate(proposal.expiresAt)}</p></details>
        {proposal.approvedAt ? <p className="mt-3 flex items-center gap-1 text-xs text-emerald-400"><Check className="h-3.5 w-3.5" />Aprovada · aguardando aplicação</p> : <Button size="sm" className="mt-3" disabled={busy} onClick={() => approve(proposal)}>Aprovar esta proposta <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>}
      </div>)}</div>
    </section>}

    <nav aria-label="Registro rápido" className="flex flex-wrap gap-2">
      {types.map(kind => { const Icon = icons[kind] || Activity; return <Button key={kind} variant="outline" size="sm" className="gap-1.5" onClick={() => openNew(kind)}><Icon className="h-4 w-4 text-primary" />{labels[kind]}</Button>; })}
    </nav>

    <section aria-label="Semana" className="grid grid-cols-7 gap-2">
      {bars.map(bar => <div key={bar.day} className="flex flex-col items-center gap-1.5 text-xs">
        <div className="flex h-24 w-full items-end justify-center gap-1" title={`${bar.day}: sono ${bar.sleepMinutes === null ? 'sem registro' : `${Math.round(bar.sleepMinutes / 6) / 10} h`} · água ${bar.waterMl === null ? 'sem registro' : `${bar.waterMl} ml`}`}>
          <span className={`w-2.5 rounded-t ${bar.sleepMinutes === null ? 'h-1 bg-muted' : 'bg-violet-400/80'}`} style={bar.sleepMinutes === null ? undefined : { height: `${Math.max(6, (bar.sleepMinutes / maxSleep) * 100)}%` }} />
          <span className={`w-2.5 rounded-t ${bar.waterMl === null ? 'h-1 bg-muted' : 'bg-sky-400/80'}`} style={bar.waterMl === null ? undefined : { height: `${Math.max(6, (bar.waterMl / maxWater) * 100)}%` }} />
        </div>
        <span className="text-muted-foreground">{bar.label}</span>
      </div>)}
      <p className="col-span-7 flex flex-wrap justify-center gap-4 text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-violet-400/80" />Sono {summary ? `${Math.round(summary.sleepMinutes / 6) / 10} h` : '—'}</span><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-sky-400/80" />Água {summary ? `${summary.waterMl} ml` : '—'}</span><span>dia sem barra = sem registro</span></p>
    </section>

    <section className="min-w-0" aria-label="Histórico de saúde">
      <h2 className="mb-2 text-base font-semibold">O que você observou</h2>
      {loading ? <p className="text-sm text-muted-foreground">Carregando histórico…</p> : timeline.length === 0 ? <div className="py-10 text-center"><HeartPulse className="mx-auto mb-3 h-8 w-8 text-primary" /><p className="text-sm text-muted-foreground">Nenhum registro ainda.</p><Button variant="outline" className="mt-4" onClick={() => openNew()}>Registrar observação</Button></div> : <ul className="divide-y divide-border/60">{timeline.map(item => { const Icon = icons[item.data.type] || Activity; return <li key={item.id} className="group flex min-h-14 min-w-0 items-center gap-3 px-1 py-2">
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1"><p className="truncate text-sm"><strong className="font-medium">{labels[item.data.type]}</strong> · {details(item)}</p><p className="text-xs text-muted-foreground">{displayDate(item.observedAt)}{item.revision > 1 && ` · corrigido (versão ${item.revision})`}</p></div>
        <button type="button" onClick={() => openCorrection(item)} className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-primary transition-opacity hover:bg-primary/10 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100" aria-label={`Corrigir ${labels[item.data.type]}`}>Corrigir <ChevronRight className="inline h-3.5 w-3.5" /></button>
      </li>; })}</ul>}
    </section>

    <section aria-label="Contexto de saúde" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-4 text-sm">
      <span><strong className="font-medium">Objetivos:</strong> {context?.data.objectives.join(' · ') || 'não informados'}</span>
      <span><strong className="font-medium">Rotinas:</strong> {context?.data.routines.map(item => `${item.dayType === 'work' ? 'trabalho' : item.dayType === 'off' ? 'folga' : 'social'}: ${item.description}`).join(' · ') || 'não informadas'}</span>
      <span><strong className="font-medium">Pilares:</strong> {context?.data.healthPillarIds.length ? pillars.filter(item => context.data.healthPillarIds.includes(item.id)).map(item => item.name).join(' · ') : 'nenhum'}</span>
      <Button variant="ghost" size="sm" onClick={editContext}>Editar contexto</Button>
    </section>
    <Dialog open={Boolean(editor)} onOpenChange={open => { if (!open) setEditor(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{editor === 'new' ? 'Registrar observação' : 'Corrigir observação'}</DialogTitle><DialogDescription className="sr-only">Informe apenas o que você sabe. A correção conserva a versão anterior.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label htmlFor="health-type">O que você observou?</Label><select id="health-type" value={type} disabled={editor !== 'new'} onChange={event => { setType(event.target.value); setValue(''); }} className="h-11 rounded-md border border-input bg-background px-3 text-sm">{types.map(entry => <option key={entry} value={entry}>{labels[entry]}</option>)}</select></div><div className="grid gap-2"><Label htmlFor="health-observed">Quando você observou?</Label><Input id="health-observed" type="datetime-local" value={observedAt} onChange={event => setObservedAt(event.target.value)} required /></div>{type === 'sleep' ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="health-start">Início do sono</Label><Input id="health-start" type="datetime-local" value={startedAt} onChange={event => setStartedAt(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="health-end">Fim do sono</Label><Input id="health-end" type="datetime-local" value={endedAt} onChange={event => setEndedAt(event.target.value)} /></div></div> : <div className="grid gap-2"><Label htmlFor="health-value">{type === 'water' ? 'Quantidade (ml)' : type === 'weight' ? 'Peso (kg)' : type === 'energy' || type === 'stress' ? 'Escala percebida (0–10)' : type === 'meal' ? 'Refeição relatada' : 'Movimento realizado'}</Label>{type === 'meal' || type === 'movement' ? <Textarea id="health-value" value={value} onChange={event => setValue(event.target.value)} maxLength={type === 'meal' ? 500 : 120} /> : <Input id="health-value" type="number" step={type === 'water' ? '1' : '0.1'} min="0" value={value} onChange={event => setValue(event.target.value)} required autoFocus />}</div>}{editor && editor !== 'new' && <div className="grid gap-2"><Label htmlFor="health-reason">Motivo da correção</Label><Textarea id="health-reason" value={reason} onChange={event => setReason(event.target.value)} minLength={3} required /></div>}</div><DialogFooter><Button variant="outline" onClick={() => setEditor(null)}>Cancelar</Button><Button onClick={save} disabled={busy}>{busy ? 'Salvando…' : editor === 'new' ? 'Salvar registro' : 'Salvar correção'}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={contextOpen} onOpenChange={setContextOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Contexto de corpo & saúde</DialogTitle><DialogDescription className="sr-only">Somente o que você declarar será usado no resumo do Órion.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label htmlFor="health-profile">Perfil resumido</Label><Textarea id="health-profile" value={contextDraft.profile || ''} onChange={event => setContextDraft(current => ({ ...current, profile: event.target.value || null }))} maxLength={500} /></div><div className="grid gap-2"><Label htmlFor="health-objectives">Objetivos · um por linha</Label><Textarea id="health-objectives" value={contextDraft.objectives.join('\n')} onChange={event => setContextDraft(current => ({ ...current, objectives: lines(event.target.value) }))} /></div><div className="grid gap-2"><Label htmlFor="health-preferences">Preferências · uma por linha</Label><Textarea id="health-preferences" value={contextDraft.preferences.join('\n')} onChange={event => setContextDraft(current => ({ ...current, preferences: lines(event.target.value) }))} /></div><div className="grid gap-2"><Label htmlFor="health-limitations">Limitações relatadas</Label><Textarea id="health-limitations" value={contextDraft.limitations || ''} onChange={event => setContextDraft(current => ({ ...current, limitations: event.target.value || null }))} placeholder="Vazio = desconhecido" /></div><div className="grid gap-2"><Label htmlFor="health-equipment">Acesso ou equipamento informado</Label><Textarea id="health-equipment" value={contextDraft.equipment || ''} onChange={event => setContextDraft(current => ({ ...current, equipment: event.target.value || null }))} /></div><fieldset className="space-y-2"><legend className="text-sm font-medium">Pilares cujas tarefas entram no resumo diário</legend>{pillars.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum pilar cadastrado.</p> : pillars.map(pillar => <label key={pillar.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"><input type="checkbox" checked={contextDraft.healthPillarIds.includes(pillar.id)} onChange={event => setContextDraft(current => ({ ...current, healthPillarIds: event.target.checked ? [...current.healthPillarIds, pillar.id] : current.healthPillarIds.filter(id => id !== pillar.id) }))} />{pillar.name}</label>)}</fieldset><fieldset className="grid gap-3"><legend className="text-sm font-medium">Rotina por tipo de dia</legend>{(['work', 'off', 'social'] as const).map(dayType => <div key={dayType} className="grid gap-1"><Label htmlFor={`routine-${dayType}`}>{dayType === 'work' ? 'Dia de trabalho' : dayType === 'off' ? 'Dia de folga' : 'Saída social'}</Label><Input id={`routine-${dayType}`} value={contextDraft.routines.find(item => item.dayType === dayType)?.description || ''} onChange={event => setContextDraft(current => ({ ...current, routines: [...current.routines.filter(item => item.dayType !== dayType), ...(event.target.value ? [{ dayType, description: event.target.value }] : [])] }))} /></div>)}</fieldset></div><DialogFooter><Button variant="outline" onClick={() => setContextOpen(false)}>Cancelar</Button><Button disabled={busy} onClick={saveContext}>{busy ? 'Salvando…' : 'Salvar contexto'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
