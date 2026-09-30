'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, ArrowRight, Check, ChevronRight, Clock3, Droplets, HeartPulse, MoonStar, Plus, Scale, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import { WorkspaceHeading, WorkspaceMetric } from '@/components/workspace/workspace-heading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { HealthObservation, HealthProposal } from '@/lib/health/schemas';

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
function proposalDetails(data: HealthProposal['input']['observation']) {
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

export default function HealthPage() {
  const [items, setItems] = useState<HealthObservation[]>([]);
  const [proposals, setProposals] = useState<HealthProposal[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
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
      const [observations, pending, overview] = await Promise.all([
        apiFetch<{ items: HealthObservation[] }>('/api/health?view=observations&limit=30'),
        apiFetch<{ items: HealthProposal[] }>('/api/health?view=proposals'),
        apiFetch<Summary>(`/api/health?view=summary&from=${dates.from}&to=${dates.to}`),
      ]);
      setItems(observations.items); setProposals(pending.items); setSummary(overview);
    } catch (error) { toast.error(showError(error)); }
    finally { setLoading(false); }
  // Period is fixed for this mount; refresh on mutation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { const handle = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(handle); }, [load]);

  function openNew() {
    setEditor('new'); setType('water'); setObservedAt(''); setValue(''); setStartedAt(''); setEndedAt(''); setReason(''); retry.current = null;
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

  return <div className="mx-auto w-full max-w-[1480px] space-y-8 px-4 pb-20 pt-5 sm:px-7 lg:px-10">
    <WorkspaceHeading eyebrow="CULTIVAR · SEU HISTÓRICO" title="Corpo & saúde" description="Registre o que aconteceu de verdade. Lacunas continuam lacunas; seus relatos não viram diagnóstico." actions={<Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" />Registrar observação</Button>}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <WorkspaceMetric label="Relatos · 7 dias" value={summary?.observations ?? '—'} detail="Apenas o que foi informado" />
        <WorkspaceMetric label="Dias com registro" value={summary?.coverage.observedDays ?? '—'} detail="Dias sem registro são desconhecidos" />
        <WorkspaceMetric label="Água informada" value={summary ? `${summary.waterMl} ml` : '—'} detail="Eventos relatados" tone="primary" />
        <WorkspaceMetric label="Sono informado" value={summary ? `${Math.round(summary.sleepMinutes / 60 * 10) / 10} h` : '—'} detail="Somente intervalos completos" />
      </div>
    </WorkspaceHeading>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.9fr)]">
      <section className="min-w-0 rounded-2xl border border-border bg-card/60 p-4 sm:p-6" aria-label="Histórico de saúde">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">LINHA DO TEMPO</p><h2 className="mt-1 font-display text-2xl">O que você observou</h2></div><span className="text-xs text-muted-foreground">Mais recentes primeiro</span></div>
        {loading ? <p className="text-sm text-muted-foreground">Carregando histórico…</p> : items.length === 0 ? <div className="rounded-xl border border-dashed border-border p-8 text-center"><HeartPulse className="mx-auto mb-3 h-8 w-8 text-primary" /><h3 className="font-semibold">O primeiro registro começa com você</h3><p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Escolha algo que observou e informe quando aconteceu. Não existe uma meta para preencher esta tela.</p><Button variant="outline" className="mt-4" onClick={openNew}>Registrar observação</Button></div> : <div className="space-y-2">{items.map(item => { const Icon = icons[item.data.type] || Activity; return <article key={item.id} className="group flex min-w-0 items-center gap-3 rounded-xl border border-border/80 bg-background/50 p-3 transition-colors hover:border-primary/40 sm:p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2"><strong className="text-sm">{labels[item.data.type]}</strong><span className="text-xs text-muted-foreground">{displayDate(item.observedAt)}</span></div><p className="mt-0.5 truncate text-sm text-foreground/85">{details(item)}</p>{item.revision > 1 && <span className="text-xs text-muted-foreground">Corrigido · versão {item.revision}</span>}</div><button type="button" onClick={() => openCorrection(item)} className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10" aria-label={`Corrigir ${labels[item.data.type]}`}>Corrigir <ChevronRight className="inline h-3.5 w-3.5" /></button></article>; })}</div>}
      </section>
      <div className="space-y-6">
        <section className="rounded-2xl border border-border bg-card/60 p-5" aria-label="Revisões do Orion"><div className="flex items-center gap-2 text-primary"><ShieldCheck className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-[0.18em]">CONTROLE SEU</span></div><h2 className="mt-2 font-display text-2xl">Antes de registrar</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">O Órion pode preparar um registro. Só a sua aprovação nesta tela autoriza aplicar aquela proposta exata.</p>{proposals.length === 0 ? <p className="mt-5 rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">Nenhuma proposta esperando sua revisão.</p> : <div className="mt-4 space-y-3">{proposals.map(proposal => <div key={proposal.id} className="rounded-xl border border-border bg-background/60 p-4"><p className="text-xs uppercase tracking-wide text-primary">{proposal.input.operation === 'record' ? 'Novo relato' : 'Correção proposta'}</p><strong className="mt-1 block text-sm">{labels[proposal.input.observation.type]}</strong><p className="mt-1 text-sm text-foreground/85">{proposalDetails(proposal.input.observation)}</p><p className="mt-1 text-xs text-muted-foreground">Observado em {displayDate(proposal.input.observation.observedAt)} · {proposal.input.observation.timezone}</p>{proposal.input.operation === 'correct' && <p className="mt-2 text-xs text-muted-foreground">Alvo {proposal.input.observationId} · revisão {proposal.input.expectedRevision} · motivo: {proposal.input.reason}</p>}{proposal.input.observation.sourceRef && <p className="mt-1 text-xs text-muted-foreground">Fonte: {proposal.input.observation.sourceRef}</p>}<p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">Hash {proposal.hash.slice(0, 16)}… · expira {displayDate(proposal.expiresAt)}</p>{proposal.approvedAt ? <p className="mt-3 flex items-center gap-1 text-xs text-emerald-400"><Check className="h-3.5 w-3.5" />Aprovada · aguardando aplicação</p> : <Button size="sm" className="mt-3 w-full" disabled={busy} onClick={() => approve(proposal)}>Aprovar esta proposta <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>}</div>)}</div>}</section>
        <section className="rounded-2xl border border-border bg-card/60 p-5"><div className="flex items-center gap-2 text-primary"><Clock3 className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-[0.18em]">CUIDADO COM OS DADOS</span></div><h2 className="mt-2 font-display text-xl">Seu ritmo é contexto</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Horários de sono, peso e hábitos só entram com data informada. Uma tarefa ou evento futuro não é prova de que você fez algo.</p></section>
      </div>
    </div>
    <Dialog open={Boolean(editor)} onOpenChange={open => { if (!open) setEditor(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{editor === 'new' ? 'Registrar observação' : 'Corrigir observação'}</DialogTitle><DialogDescription>Informe apenas o que você sabe. A correção conserva a versão anterior.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label htmlFor="health-type">O que você observou?</Label><select id="health-type" value={type} disabled={editor !== 'new'} onChange={event => { setType(event.target.value); setValue(''); }} className="h-11 rounded-md border border-input bg-background px-3 text-sm">{types.map(entry => <option key={entry} value={entry}>{labels[entry]}</option>)}</select></div><div className="grid gap-2"><Label htmlFor="health-observed">Quando você observou?</Label><Input id="health-observed" type="datetime-local" value={observedAt} onChange={event => setObservedAt(event.target.value)} required /><p className="text-xs text-muted-foreground">Obrigatório inclusive para peso. Use a data real da observação.</p></div>{type === 'sleep' ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="health-start">Início do sono</Label><Input id="health-start" type="datetime-local" value={startedAt} onChange={event => setStartedAt(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="health-end">Fim do sono</Label><Input id="health-end" type="datetime-local" value={endedAt} onChange={event => setEndedAt(event.target.value)} /></div></div> : <div className="grid gap-2"><Label htmlFor="health-value">{type === 'water' ? 'Quantidade (ml)' : type === 'weight' ? 'Peso (kg)' : type === 'energy' || type === 'stress' ? 'Escala percebida (0–10)' : type === 'meal' ? 'Refeição relatada' : 'Movimento realizado'}</Label>{type === 'meal' || type === 'movement' ? <Textarea id="health-value" value={value} onChange={event => setValue(event.target.value)} maxLength={type === 'meal' ? 500 : 120} /> : <Input id="health-value" type="number" step={type === 'water' ? '1' : '0.1'} min="0" value={value} onChange={event => setValue(event.target.value)} required />}</div>}{editor && editor !== 'new' && <div className="grid gap-2"><Label htmlFor="health-reason">Motivo da correção</Label><Textarea id="health-reason" value={reason} onChange={event => setReason(event.target.value)} minLength={3} required /></div>}</div><DialogFooter><Button variant="outline" onClick={() => setEditor(null)}>Cancelar</Button><Button onClick={save} disabled={busy}>{busy ? 'Salvando…' : editor === 'new' ? 'Salvar registro' : 'Salvar correção'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
