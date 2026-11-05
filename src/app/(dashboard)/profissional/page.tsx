'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Archive, ArrowUpRight, Bot, Check, CircleCheck, GitBranch, Orbit, Pencil, Plus, Scale, Search, ShieldCheck, User, Workflow } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { WorkspaceHeading } from '@/components/workspace/workspace-heading';
import { apiFetch, showError } from '@/lib/api';
import { CampaignEditor } from '@/components/professional/campaign-editor';
import { BRANDS, type Kind, type ProfessionalRecord, type Proposal, type ExternalJob } from '@/lib/professional/schemas';

type ProjectSummary = { id: string; name: string; status: string; context: ProfessionalRecord; gaps: string[]; hasNextAction: boolean; openTasks: number; openWorks: number };
type LegacyKind = 'contact' | 'opportunity' | 'campaign' | 'content';
type Overview = { projects: { items: ProjectSummary[]; nextCursor?: string }; counts: { projects: number; works: number; opportunities: number; awaitingReview: number; ownerQueue?: number; legacy?: Record<LegacyKind, number> } };
type Goals = { gross: number; invest: number; months: number; revision: number };
type Row = ProfessionalRecord & { approvedRevision?: number | null };
type PendingProposal = Proposal & { approval?: unknown };
const ARCO_LEADS = 'https://arco.oj0nny.com/';
const titles: Record<Kind, string> = { content: 'Pauta de conteúdo', context: 'Projeto profissional', work: 'Próximo passo', contact: 'Empresa ou contato', opportunity: 'Oportunidade', campaign: 'Lista de prospecção', deliverable: 'Entrega para revisão' };
// Três áreas em torno de decisões; o CRM vive no Arco Leads. Registros antigos
// de contato, oportunidade, prospecção e pauta ficam legíveis, nunca apagados.
const tabs = [
  { id: 'context', label: 'Visão geral', short: 'Visão', icon: Orbit },
  { id: 'work', label: 'Próximos passos', short: 'Passos', icon: Workflow },
  { id: 'review', label: 'Aguardando você', short: 'Aguardando', icon: ShieldCheck },
  { id: 'legacy', label: 'Registros antigos', short: 'Antigos', icon: Archive },
] as const;
type Tab = typeof tabs[number]['id'];
const legacyNames: Record<LegacyKind, string> = { contact: 'Contatos', opportunity: 'Oportunidades', campaign: 'Prospecção', content: 'Pautas' };
const stageNames: Record<string, string> = { lead: 'Lead', qualified: 'Qualificado', proposed: 'Proposta enviada', contracted: 'Contratado', invoiced: 'Faturado', received: 'Recebido', lost: 'Perdido' };
const approvalNames: Record<string, string> = { work_scope: 'Escopo de trabalho', record_change: 'Alteração de registro', deliverable: 'Entrega', external_action: 'Ação externa' };
const executionNames: Record<string, string> = { queued: 'na fila', running: 'em execução', blocked: 'bloqueado', failed: 'falhou', review: 'pronto para revisão' };
const artifactNames: Record<string, string> = { prospect_list: 'Lista de prospecção', script: 'Roteiro', message_draft: 'Rascunho de mensagem', proposal: 'Proposta', research: 'Pesquisa', content_brief: 'Brief de conteúdo', experiment: 'Experimento' };
const gapNames: Record<string, string> = { objective: 'objetivo', audience: 'público', responsible: 'responsável', expectedOutcome: 'resultado esperado', milestone: 'próximo marco' };
const workTypes: Record<string, { label: string; icon: typeof User }> = { human: { label: 'Você', icon: User }, agent: { label: 'Agente', icon: Bot }, decision: { label: 'Decisão', icon: Scale }, dependency: { label: 'Dependência', icon: GitBranch } };
// Nomes legíveis dos campos na revisão de uma proposta (as chaves seguem no contrato).
const fieldLabels: Record<string, string> = {
  title: 'Título', name: 'Nome', projectId: 'Projeto', brandId: 'Marca', workType: 'Quem executa', responsible: 'Responsável', milestone: 'Marco', nextAction: 'Próxima ação', priority: 'Prioridade',
  dueDate: 'Prazo', effortMinutes: 'Esforço (minutos)', brief: 'Briefing', inputs: 'Insumos', acceptanceCriteria: 'Critérios de aceite', dependencies: 'Dependências', expectedResult: 'Resultado esperado',
  linkedTaskId: 'Tarefa vinculada', origin: 'Origem', status: 'Situação', artifactKinds: 'O agente pode produzir', objective: 'Objetivo', audience: 'Público', type: 'Tipo', body: 'Conteúdo',
  fileUrl: 'Arquivo', sources: 'Fontes', verificationSummary: 'Verificação', comments: 'Comentários', problem: 'Problema', currentState: 'Situação atual', maturity: 'Maturidade',
  expectedOutcome: 'Resultado esperado', successCriteria: 'Critérios de sucesso', milestoneDate: 'Prazo do marco', priorityReason: 'Motivo da prioridade', offer: 'Oferta', valueProposition: 'Proposta de valor',
  facts: 'Fatos', hypotheses: 'Hipóteses', unknowns: 'O que não sabemos', restrictions: 'Restrições', decisions: 'Decisões pendentes', blockers: 'Bloqueios', resources: 'Recursos', materials: 'Materiais',
};
const valueNames: Record<string, Record<string, string>> = {
  workType: Object.fromEntries(Object.entries(workTypes).map(([key, value]) => [key, value.label])), status: { open: 'Aberto', blocked: 'Bloqueado', done: 'Concluído' },
  priority: { urgent: 'Urgente', important: 'Importante', normal: 'Normal', cash: 'Caixa com serviços', product: 'Produto', maintenance: 'Manutenção' }, origin: { user: 'Você', agent: 'Agente', integration: 'Integração' }, type: artifactNames,
};
const currency = (amount: unknown) => typeof amount === 'number' ? amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Não informado';
const brandOf = (id: unknown) => BRANDS.find(brand => brand.id === id);
const brandLine = (id: unknown) => { const brand = brandOf(id); return brand ? [brand.name, brand.handle].filter(Boolean).join(' · ') : ''; };
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const shortDate = (date: string) => { const [y, m, d] = date.split('-'); return y === today().slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${y}`; };
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export default function ProfessionalPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [tab, setTab] = useState<Tab>('context');
  const [records, setRecords] = useState<Row[]>([]);
  const [proposals, setProposals] = useState<PendingProposal[]>([]);
  const [jobs, setJobs] = useState<ExternalJob[]>([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<{ kind: Kind; record?: ProfessionalRecord } | null>(null);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [review, setReview] = useState<PendingProposal | null>(null);
  const [reviewCurrent, setReviewCurrent] = useState<Record<string, unknown> | null>(null);
  const [cursor, setCursor] = useState('0');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [trail, setTrail] = useState<string[]>([]);
  const [legacyKind, setLegacyKind] = useState<LegacyKind>('contact');
  const [goals, setGoals] = useState<Goals | null>(null);
  const [goalDraft, setGoalDraft] = useState<{ gross: string; invest: string; months: string } | null>(null);
  const [showDone, setShowDone] = useState(false);

  const viewKey = [tab, filterProject, search, cursor, legacyKind].join('|');
  const loaded = loadedKey === viewKey;
  async function load() {
    const key = viewKey;
    try {
      const params = new URLSearchParams({ view: 'overview', ...(tab === 'context' ? { cursor, ...(search ? { search } : {}) } : {}), ...(filterProject ? { projectId: filterProject } : {}) });
      const [summary, allProjects] = await Promise.all([apiFetch<Overview>(`/api/professional?${params}`), apiFetch<{ id: string; name: string }[]>('/api/projects')]);
      setOverview(summary); setProjects(allProjects); if (tab === 'context') setNextCursor(summary.projects.nextCursor || null); setError('');
      const base = { ...(filterProject ? { projectId: filterProject } : {}), ...(search ? { search } : {}), cursor };
      if (tab !== 'context') {
        const result = await apiFetch<{ items: Row[]; nextCursor: string | null }>(`/api/professional?${new URLSearchParams({ view: 'records', ...base, kind: tab === 'review' ? 'deliverable' : tab === 'legacy' ? legacyKind : tab })}`);
        setRecords(result.items); setNextCursor(result.nextCursor);
      }
      if (tab === 'review' || tab === 'work') {
        const [p, j] = await Promise.all([apiFetch<{ items: PendingProposal[] }>(`/api/professional?${new URLSearchParams({ view: 'proposal', ...base })}`), apiFetch<{ items: ExternalJob[] }>(`/api/professional?${new URLSearchParams({ view: 'jobs', ...base })}`)]);
        setProposals(p.items); setJobs(j.items);
      }
      setLoadedKey(key);
    } catch (failure) { setError(showError(failure)); setLoadedKey(key); }
  }
  useEffect(() => { void load(); /* Consulta filtrada e paginada no servidor. */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filterProject, search, cursor, legacyKind]);
  useEffect(() => { apiFetch<Goals>('/api/professional/goals').then(setGoals, () => undefined); }, []);
  async function saveGoals() {
    if (!goals || !goalDraft || busy) return; setBusy(true);
    try {
      const next = await apiFetch<Goals>('/api/professional/goals', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gross: Number(goalDraft.gross) || 0, invest: Number(goalDraft.invest) || 0, months: Number(goalDraft.months) || 6, expectedRevision: goals.revision }) });
      setGoals(next); setGoalDraft(null); toast.success('Metas atualizadas.');
    } catch (failure) { toast.error(showError(failure)); } finally { setBusy(false); }
  }
  const legacyTotal = Object.values(overview?.counts.legacy || {}).reduce((sum, value) => sum + value, 0);
  const visibleTabs = tabs.filter(item => item.id !== 'legacy' || legacyTotal > 0 || tab === 'legacy');
  const tabCount = (id: Tab) => !overview ? null : id === 'work' ? overview.counts.works : id === 'review' ? overview.counts.ownerQueue ?? overview.counts.awaitingReview : id === 'legacy' ? legacyTotal : null;
  const money = (value: number) => value >= 1000 ? `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : currency(value);
  const projectName = (id: unknown) => projects.find(project => project.id === id)?.name || overview?.projects.items.find(project => project.id === id)?.name || 'Projeto';
  const pendingProposals = proposals.filter(item => !item.resultId && Date.parse(item.expiresAt) > Date.now());

  async function openEditor(kind: Kind, record?: ProfessionalRecord, preset: Record<string, unknown> = {}) {
    if (record) {
      try { const detail = await apiFetch<{ items: ProfessionalRecord[] }>(`/api/professional?${new URLSearchParams({ view: 'records', id: record.id, projectId: String(record.data.projectId), kind })}`); record = detail.items[0]; if (!record) throw new Error('Registro não encontrado.'); } catch (failure) { toast.error(showError(failure)); return; }
    }
    const projectId = String(preset.projectId || filterProject);
    setEditor({ kind, record }); setData(record ? structuredClone(record.data) : { projectId, brandId: overview?.projects.items.find(project => project.id === projectId)?.context.data.brandId || 'arco-labs', ...preset });
  }
  const set = (key: string, value: unknown) => setData(current => ({ ...current, [key]: value }));
  function field(key: string, label: string, multiline = false, type = 'text') {
    const value = data[key];
    return <div key={key} className="space-y-2"><Label htmlFor={`professional-${key}`}>{label}</Label>{multiline ? <Textarea id={`professional-${key}`} value={String(value || '')} onChange={event => set(key, event.target.value)} rows={3} /> : <Input id={`professional-${key}`} type={type} value={String(value ?? '')} onChange={event => set(key, type === 'number' ? event.target.value === '' ? undefined : Number(event.target.value) : event.target.value || undefined)} />}</div>;
  }
  function lines(key: string, label: string) { return <div key={key} className="space-y-2"><Label htmlFor={`professional-${key}`}>{label} · um por linha</Label><Textarea id={`professional-${key}`} rows={3} value={((data[key] || []) as string[]).join('\n')} onChange={event => set(key, event.target.value.split('\n').filter(Boolean))} /></div>; }
  function select(key: string, label: string, options: { value: string; label: string }[]) {
    return <div className="space-y-2"><Label htmlFor={`professional-${key}`}>{label}</Label><select id={`professional-${key}`} className="h-11 w-full rounded-lg border bg-background px-3 text-sm" value={String(data[key] || '')} onChange={event => set(key, event.target.value)}><option value="">Selecionar</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
  }
  async function saveRecord(kind: Kind, id: string | undefined, revision: number, payload: Record<string, unknown>) {
    return apiFetch<ProfessionalRecord>('/api/professional', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', kind, id, expectedRevision: revision, data: payload, idempotencyKey: crypto.randomUUID() }) });
  }
  async function save() {
    if (!editor || busy) return; setBusy(true);
    try {
      const payload = { ...data };
      if (editor.kind === 'context') payload.lastReviewedAt = today();
      await saveRecord(editor.kind, editor.record?.id, editor.record?.revision || 0, payload);
      setEditor(null); await load(); toast.success('Registro salvo com histórico de versão.');
    } catch (failure) { toast.error(showError(failure)); } finally { setBusy(false); }
  }
  async function setWorkStatus(record: Row, status: 'open' | 'done') {
    if (busy) return; setBusy(true);
    const previous = String(record.data.status || 'open') as 'open' | 'blocked' | 'done';
    setRecords(current => current.map(item => item.id === record.id ? { ...item, data: { ...item.data, status } } : item));
    try {
      const saved = await saveRecord('work', record.id, record.revision, { ...record.data, status });
      await load();
      if (status === 'done') toast.success(`“${String(record.data.title)}” concluído.`, { action: { label: 'Desfazer', onClick: () => void (async () => { try { await saveRecord('work', record.id, saved.revision, { ...saved.data, status: previous }); await load(); } catch (failure) { toast.error(showError(failure)); } })() } });
    } catch (failure) { toast.error(showError(failure)); await load(); } finally { setBusy(false); }
  }
  async function openReview(proposal: PendingProposal) {
    setReview(proposal); setReviewCurrent(null);
    if (!proposal.targetId) return;
    try { const detail = await apiFetch<{ items: ProfessionalRecord[] }>(`/api/professional?${new URLSearchParams({ view: 'records', id: proposal.targetId, projectId: String(proposal.data.projectId), kind: proposal.kind })}`); setReviewCurrent(detail.items[0]?.data || null); } catch { setReviewCurrent(null); }
  }
  async function approve(proposal: Proposal) {
    if (busy) return; setBusy(true);
    try {
      await apiFetch('/api/professional/approval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proposalId: proposal.id, revision: proposal.revision, hash: proposal.hash }) });
      await apiFetch('/api/professional', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'apply', id: proposal.id, idempotencyKey: `owner-apply-${proposal.id}` }) });
      setReview(null); await load(); toast.success('Aprovação registrada e alteração aplicada.');
    } catch (failure) { toast.error(showError(failure)); await load(); } finally { setBusy(false); }
  }
  async function proposeDelivery(record: ProfessionalRecord) {
    if (busy) return; setBusy(true);
    try { const proposal = await apiFetch<Proposal>('/api/professional', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'propose', kind: record.kind, id: record.id, expectedRevision: record.revision, approvalType: record.kind === 'work' ? 'work_scope' : 'deliverable', data: record.data, idempotencyKey: `review-${record.id}-v${record.revision}` }) }); await openReview(proposal); }
    catch (failure) { toast.error(showError(failure)); } finally { setBusy(false); }
  }
  function formatValue(key: string, value: unknown): string {
    if (value === undefined || value === null || value === '') return '';
    if (key === 'projectId') return projectName(value);
    if (key === 'brandId') return brandOf(value)?.name || String(value);
    if (Array.isArray(value)) return value.map(item => typeof item === 'object' && item ? String((item as { statement?: string }).statement || JSON.stringify(item)) : key === 'artifactKinds' ? artifactNames[String(item)] || String(item) : String(item)).filter(Boolean).join(' · ');
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return shortDate(value);
    return valueNames[key]?.[String(value)] || String(value);
  }
  const empty = (message: ReactNode, detail?: ReactNode) => <div className="rounded-2xl border border-dashed px-6 py-12 text-center"><CircleCheck className="mx-auto mb-3 h-6 w-6 text-muted-foreground" /><p className="font-medium">{message}</p>{detail && <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{detail}</p>}</div>;
  const loading = <div className="grid gap-2" aria-busy="true" aria-label="Carregando">{[0, 1, 2].map(index => <div key={index} className="h-14 animate-pulse rounded-xl bg-muted/50" />)}</div>;
  const pager = <div className="mt-6 flex gap-2">{trail.length > 0 && <Button variant="outline" onClick={() => { setCursor(trail.at(-1)!); setTrail(trail.slice(0, -1)); }}>Página anterior</Button>}{nextCursor && <Button variant="outline" onClick={() => { setTrail([...trail, cursor]); setCursor(nextCursor); }}>Próxima página</Button>}</div>;

  const open = records.filter(record => record.data.status !== 'done');
  const done = records.filter(record => record.data.status === 'done');
  const byProject = (items: Row[]) => [...new Set(items.map(item => String(item.data.projectId)))].map(id => ({ id, items: items.filter(item => item.data.projectId === id) }));
  const workRow = (record: Row) => {
    const type = workTypes[String(record.data.workType || 'human')] || workTypes.human;
    const due = record.data.dueDate ? String(record.data.dueDate) : '';
    const late = !!due && due < today() && record.data.status !== 'done';
    const isDone = record.data.status === 'done';
    return <li key={record.id} className={`group flex min-h-14 items-center gap-3 rounded-xl border bg-card/50 px-3 py-2 ${isDone ? 'opacity-60' : ''}`}>
      <button type="button" aria-label={isDone ? `Reabrir ${String(record.data.title)}` : `Concluir ${String(record.data.title)}`} disabled={busy} onClick={() => void setWorkStatus(record, isDone ? 'open' : 'done')} className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors hover:border-primary hover:text-primary ${isDone ? 'border-primary bg-primary/15 text-primary' : 'text-transparent hover:text-primary'}`}><Check className="h-3.5 w-3.5" /></button>
      <span title={type.label} className="text-muted-foreground"><type.icon className="h-4 w-4" aria-label={type.label} /></span>
      <button type="button" className={`min-w-0 flex-1 text-left ${isDone ? 'line-through' : ''}`} onClick={() => void openEditor('work', record)}>
        <span className="block truncate text-sm font-medium">{String(record.data.title)}</span>
        {(record.data.nextAction || record.data.responsible) ? <span className="block truncate text-xs text-muted-foreground">{[record.data.responsible, record.data.nextAction].filter(Boolean).map(String).join(' · ')}</span> : null}
      </button>
      {record.data.status === 'blocked' && <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">Bloqueado</span>}
      {due && <span className={`shrink-0 font-mono-num text-xs ${late ? 'font-semibold text-destructive' : 'text-muted-foreground'}`} title={late ? 'Prazo vencido' : 'Prazo'}>{shortDate(due)}</span>}
      {record.data.workType === 'agent' && !isDone && <Button size="sm" variant="ghost" className="hidden shrink-0 sm:inline-flex" disabled={busy} onClick={() => void proposeDelivery(record)}>Pedir aprovação</Button>}
    </li>;
  };

  return <main className="work-page mx-auto max-w-[1600px] px-4 pb-28 pt-6 lg:px-8">
    <WorkspaceHeading eyebrow="Profissional" title="Profissional" description="Seus negócios por marca, o que fazer a seguir e o que espera a sua aprovação. Clientes e vendas ficam no Arco Leads." actions={<><a href={ARCO_LEADS} target="_blank" rel="noreferrer" aria-label="Abrir Arco Leads (CRM)" className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:text-primary">Arco Leads<ArrowUpRight className="h-3.5 w-3.5" /></a><Button onClick={() => openEditor('context')}><Plus className="mr-2 h-4 w-4" />Adicionar projeto</Button></>} />
    {error && <div role="alert" className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm">{error}<p className="mt-2 text-muted-foreground">Esta área exige sua sessão autenticada, inclusive para aprovar. <Link href="/login" className="text-primary underline">Entrar</Link></p><Button variant="outline" className="mt-3" onClick={() => void load()}>Tentar novamente</Button></div>}

    <div className="mb-6 flex flex-wrap items-center gap-3">
      <nav aria-label="Áreas profissionais" className="flex max-w-full gap-1 rounded-xl border bg-card/40 p-1">{visibleTabs.map(item => { const count = tabCount(item.id); return <Button key={item.id} variant={tab === item.id ? 'secondary' : 'ghost'} aria-pressed={tab === item.id} className="min-h-10 shrink-0 gap-1.5 px-2.5 sm:gap-2 sm:px-3" onClick={() => { setTab(item.id); setCursor('0'); setTrail([]); setShowDone(false); }}><item.icon className="hidden h-4 w-4 sm:block" aria-hidden="true" /><span className="hidden sm:inline">{item.label}</span><span className="sm:hidden">{item.short}</span>{count ? <span className="rounded-full bg-primary/15 px-1.5 font-mono-num text-[11px] text-primary">{count}</span> : null}</Button>; })}</nav>
      <div className="flex min-w-0 flex-1 basis-full flex-wrap gap-2 sm:basis-auto">
        {(overview?.projects.items.length || 0) > 1 && <select aria-label="Filtrar por projeto" className="h-10 min-w-0 max-w-[240px] flex-1 rounded-lg border bg-card px-3 text-sm" value={filterProject} onChange={event => { setFilterProject(event.target.value); setCursor('0'); setTrail([]); }}><option value="">Todos os projetos</option>{overview?.projects.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
        <div className="relative min-w-[180px] flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar registros profissionais" className="h-10 pl-9" value={search} onChange={event => { setSearch(event.target.value); setCursor('0'); }} placeholder="Buscar…" /></div>
        {tab === 'work' && <Button variant="outline" className="h-10" onClick={() => openEditor('work')}><Plus className="mr-2 h-4 w-4" />Novo próximo passo</Button>}
      </div>
    </div>

    {tab === 'context' && <>
      <section className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-b pb-4 text-sm" aria-label="Metas do período">
        <span className="text-xs font-medium text-primary">Metas · {goals?.months || 6} meses</span>
        {goalDraft ? <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1"><Label htmlFor="goal-gross" className="text-xs">Faturamento bruto (R$)</Label><Input id="goal-gross" type="number" min="0" className="h-9 w-36" value={goalDraft.gross} onChange={event => setGoalDraft({ ...goalDraft, gross: event.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="goal-invest" className="text-xs">Líquido para investir (R$)</Label><Input id="goal-invest" type="number" min="0" className="h-9 w-36" value={goalDraft.invest} onChange={event => setGoalDraft({ ...goalDraft, invest: event.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="goal-months" className="text-xs">Meses</Label><Input id="goal-months" type="number" min="1" max="24" className="h-9 w-20" value={goalDraft.months} onChange={event => setGoalDraft({ ...goalDraft, months: event.target.value })} /></div>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setGoalDraft(null)}>Cancelar</Button><Button size="sm" disabled={busy} onClick={() => void saveGoals()}>Salvar metas</Button>
        </div> : <>
          <span title="Bússola para decidir; não entra no saldo nem no realizado."><strong className="font-mono-num">{goals ? money(goals.gross) : '—'}</strong> <span className="text-muted-foreground">bruto</span></span>
          <span title="Bússola para decidir; não entra no saldo nem no realizado."><strong className="font-mono-num">{goals ? money(goals.invest) : '—'}</strong> <span className="text-muted-foreground">para investir</span></span>
          <Button size="icon" variant="ghost" className="h-8 w-8" disabled={!goals} aria-label="Editar metas" onClick={() => goals && setGoalDraft({ gross: String(goals.gross), invest: String(goals.invest), months: String(goals.months) })}><Pencil className="h-3.5 w-3.5" /></Button>
        </>}
      </section>
      {!overview && !error ? loading : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {overview?.projects.items.filter(project => !search || project.name.toLowerCase().includes(search.toLowerCase())).map(project => {
          const gaps = project.gaps.map(gap => gapNames[gap] || gap);
          const counts = [project.openTasks ? plural(project.openTasks, 'tarefa aberta', 'tarefas abertas') : '', project.openWorks ? plural(project.openWorks, 'próximo passo', 'próximos passos') : ''].filter(Boolean);
          return <article key={project.id} className="group relative flex flex-col rounded-2xl border bg-card/60 p-5 transition-colors hover:border-primary/40">
            <div className="flex items-start justify-between gap-3"><p className="text-[11px] uppercase tracking-[.14em] text-primary">{brandLine(project.context.data.brandId)}</p><Link href={`/projetos?open=${project.id}`} aria-label={`Abrir projeto ${project.name}`} className="relative z-10 -m-1 rounded p-1 text-muted-foreground hover:text-primary"><ArrowUpRight className="h-4 w-4" /></Link></div>
            <h2 className="mt-2 font-display text-xl"><button type="button" aria-label={`Editar projeto ${project.name}`} className="text-left after:absolute after:inset-0 after:rounded-2xl" onClick={() => openEditor('context', project.context)}>{project.name}</button></h2>
            {project.context.data.objective ? <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{String(project.context.data.objective)}</p> : null}
            {gaps.length > 0 && <p className="mt-3 text-xs text-muted-foreground"><span className="text-amber-600 dark:text-amber-400">Falta:</span> {gaps.join(', ')}</p>}
            <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-4 text-xs text-muted-foreground">
              {counts.length > 0 && <span>{counts.join(' · ')}</span>}
              {!project.hasNextAction && <button type="button" className="relative z-10 inline-flex items-center gap-1 font-medium text-primary hover:underline" onClick={() => openEditor('work', undefined, { projectId: project.id, brandId: project.context.data.brandId })}><Plus className="h-3.5 w-3.5" />Definir próximo passo</button>}
            </div>
          </article>;
        })}
        {overview && !overview.projects.items.length && <div className="rounded-2xl border border-dashed p-8 md:col-span-2"><Orbit className="mb-4 h-7 w-7 text-primary" /><h2 className="font-display text-xl">Comece por um projeto</h2><p className="mt-2 max-w-lg text-sm text-muted-foreground">Escolha um projeto, a marca e o que quer alcançar. Dá para completar aos poucos.</p><Button variant="outline" className="mt-5" onClick={() => openEditor('context')}>Adicionar projeto</Button></div>}
      </div>}
      {pager}
    </>}

    {tab === 'work' && (!loaded ? loading : <>
      {jobs.length > 0 && <ul className="mb-5 grid gap-2">{jobs.map(job => <li key={job.id} className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm"><Bot className="h-4 w-4 text-primary" aria-hidden="true" /><span className="font-medium">{job.agentId}</span><span className="text-muted-foreground">{executionNames[job.execution] || job.execution}</span>{job.verifiedSummary && <span className="truncate text-xs text-muted-foreground">{job.verifiedSummary}</span>}</li>)}</ul>}
      {open.length ? <div className="space-y-6">{byProject(open).map(group => <section key={group.id} aria-label={projectName(group.id)}><h2 className="mb-2 text-xs font-medium uppercase tracking-[.14em] text-muted-foreground">{projectName(group.id)}</h2><ul className="grid gap-2">{group.items.map(workRow)}</ul></section>)}</div>
        : empty('Nenhum próximo passo em aberto', 'Crie um passo pequeno e verificável, ou peça um ao Sirius no Escritório.')}
      {done.length > 0 && <div className="mt-6"><Button variant="ghost" size="sm" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>{showDone ? 'Esconder concluídos' : `Mostrar concluídos (${done.length})`}</Button>{showDone && <ul className="mt-2 grid gap-2">{done.map(workRow)}</ul>}</div>}
      {pager}
    </>)}

    {tab === 'review' && (!loaded ? loading : (() => {
      const toReview = records.filter(record => !record.approvedRevision);
      const approved = records.filter(record => record.approvedRevision);
      return <>
        {pendingProposals.length || toReview.length ? <ul className="grid gap-2" aria-label="Aguardando sua decisão">
          {pendingProposals.map(proposal => <li key={proposal.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card/50 px-4 py-3"><ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><div className="min-w-0 flex-1"><p className="text-xs text-primary">{approvalNames[proposal.approvalType] || proposal.approvalType} · {projectName(proposal.data.projectId)}</p><p className="truncate text-sm font-medium">{String(proposal.data.title || proposal.data.name || titles[proposal.kind])}</p></div><Button size="sm" onClick={() => void openReview(proposal)}>Revisar e decidir</Button></li>)}
          {toReview.map(record => <li key={record.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card/50 px-4 py-3"><CircleCheck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /><div className="min-w-0 flex-1"><p className="text-xs text-primary">Entrega{record.data.type ? ` · ${artifactNames[String(record.data.type)] || String(record.data.type)}` : ''} · {projectName(record.data.projectId)}</p><p className="truncate text-sm font-medium">{String(record.data.title)}</p></div><Button size="sm" variant="outline" onClick={() => void openEditor('deliverable', record)}>Abrir entrega</Button><Button size="sm" disabled={busy} onClick={() => void proposeDelivery(record)}>Aprovar versão</Button></li>)}
        </ul> : empty('Nada esperando você', 'Quando o Sirius preparar algo, aparece aqui para você aprovar.')}
        {approved.length > 0 && <details className="mt-6"><summary className="cursor-pointer text-sm text-muted-foreground">Entregas já aprovadas ({approved.length})</summary><ul className="mt-2 grid gap-2">{approved.map(record => <li key={record.id} className="flex items-center gap-3 rounded-xl border px-4 py-2 text-sm"><Check className="h-4 w-4 text-primary" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{String(record.data.title)}</span><Button size="sm" variant="ghost" onClick={() => void openEditor('deliverable', record)}>Abrir</Button></li>)}</ul></details>}
        {pager}
      </>;
    })())}

    {tab === 'legacy' && <>
      <div className="mb-5 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm"><p>Clientes, oportunidades e prospecção agora ficam no <a href={ARCO_LEADS} target="_blank" rel="noreferrer" className="text-primary underline">Arco Leads</a>, e pautas na tela de <Link href="/conteudo" className="text-primary underline">Conteúdo</Link>. Nada foi apagado: estes registros ficam aqui só para consulta.</p><div className="mt-3 flex flex-wrap gap-2" aria-label="Tipo de registro antigo">{(Object.keys(legacyNames) as LegacyKind[]).map(kind => <Button key={kind} size="sm" variant={legacyKind === kind ? 'secondary' : 'outline'} aria-pressed={legacyKind === kind} onClick={() => { setLegacyKind(kind); setCursor('0'); setTrail([]); }}>{legacyNames[kind]} ({overview?.counts.legacy?.[kind] || 0})</Button>)}</div></div>
      {!loaded ? loading : records.length ? <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{records.map(record => <article key={record.id} className="min-w-0 rounded-2xl border bg-card/60 p-5"><p className="text-[11px] uppercase tracking-widest text-primary">{[brandOf(record.data.brandId)?.name, legacyNames[record.kind as LegacyKind]].filter(Boolean).join(' · ')}</p><h2 className="mt-3 break-words text-base font-semibold">{String(record.data.title || record.data.name)}</h2>{record.kind === 'opportunity' ? <><p className="mt-3 text-sm text-muted-foreground">Etapa: {stageNames[String(record.data.stage)] || String(record.data.stage)}</p><dl className="mt-4 space-y-2 text-sm"><div className="flex justify-between"><dt className="text-muted-foreground">Bruto estimado</dt><dd>{currency(record.data.grossEstimate)}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Custos estimados</dt><dd>{currency(record.data.costEstimate)}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Parcela do proprietário</dt><dd>{currency(record.data.ownerShareEstimate)}</dd></div></dl></> : record.data.objective || record.data.brief || record.data.body || record.data.fit ? <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{String(record.data.objective || record.data.brief || record.data.body || record.data.fit)}</p> : null}{record.kind === 'contact' && <p className="mt-3 text-xs text-muted-foreground">Verificação: {String(record.data.verification)}{record.data.doNotContact ? ' · Não contatar' : ''}</p>}</article>)}</section> : empty('Nenhum registro deste tipo')}
      {pager}
    </>}

    <Dialog open={Boolean(editor)} onOpenChange={open => !open && !busy && setEditor(null)}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editor && titles[editor.kind]}</DialogTitle><DialogDescription>Preencha só o que você sabe; o resto pode ficar em branco. Cada alteração guarda uma versão.</DialogDescription></DialogHeader><div className="space-y-5">
      {select('projectId', 'Projeto associado', (editor?.kind === 'context' ? projects : overview?.projects.items || []).map(project => ({ value: project.id, label: project.name })))}
      {select('brandId', 'Marca', BRANDS.map(brand => ({ value: brand.id, label: [brand.name, brand.handle].filter(Boolean).join(' ') })))}
      {editor?.kind === 'context' ? <>{field('objective', 'Objetivo', true)}{field('audience', 'Público')}{field('responsible', 'Responsável')}{field('milestone', 'Próximo marco')}{field('milestoneDate', 'Prazo do marco', false, 'date')}{lines('unknowns', 'O que ainda não sabemos')}<details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Oferta, estratégia e recursos</summary><div className="mt-5 space-y-5">{field('problem', 'Problema atendido', true)}{field('currentState', 'Situação atual', true)}{field('maturity', 'Maturidade')}{field('expectedOutcome', 'Resultado esperado', true)}{lines('successCriteria', 'Critérios de sucesso')}{field('offer', 'Oferta', true)}{field('valueProposition', 'Proposta de valor', true)}{select('priority', 'Prioridade', [{ value: 'cash', label: 'Caixa com serviços' }, { value: 'product', label: 'Produto' }, { value: 'maintenance', label: 'Manutenção' }])}{field('priorityReason', 'Motivo da prioridade', true)}{lines('hypotheses', 'Hipóteses')}{lines('blockers', 'Bloqueios')}{lines('restrictions', 'Restrições')}{lines('decisions', 'Decisões pendentes')}{lines('resources', 'Recursos')}</div></details></> : <>
      {field(editor?.kind === 'contact' ? 'name' : 'title', editor?.kind === 'contact' ? 'Empresa ou pessoa' : 'Título')}
      {editor?.kind === 'work' && <>{select('workType', 'Quem executa', [{ value: 'human', label: 'Tarefa humana' }, { value: 'agent', label: 'Trabalho de agente' }, { value: 'decision', label: 'Decisão' }, { value: 'dependency', label: 'Dependência' }])}{field('responsible', 'Responsável')}{field('nextAction', 'Próxima ação concreta', true)}{field('brief', 'Briefing de execução', true)}{field('expectedResult', 'Resultado esperado', true)}{lines('acceptanceCriteria', 'Critérios de aceite')}{field('dueDate', 'Prazo', false, 'date')}{field('effortMinutes', 'Esforço estimado · minutos', false, 'number')}{select('status', 'Situação', [{ value: 'open', label: 'Aberto' }, { value: 'blocked', label: 'Bloqueado' }, { value: 'done', label: 'Concluído por você' }])}<div><Label>O que o agente pode produzir</Label><div className="mt-3 flex flex-wrap gap-3">{['prospect_list', 'script', 'message_draft', 'proposal', 'research', 'content_brief', 'experiment'].map(kind => <label key={kind} className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" checked={((data.artifactKinds || []) as string[]).includes(kind)} onChange={event => set('artifactKinds', event.target.checked ? [...((data.artifactKinds || []) as string[]), kind] : ((data.artifactKinds || []) as string[]).filter(item => item !== kind))} />{artifactNames[kind]}</label>)}</div></div></>}
      {editor?.kind === 'contact' && <>{select('entityType', 'Tipo', [{ value: 'company', label: 'Empresa' }, { value: 'person', label: 'Pessoa' }])}{field('segment', 'Segmento')}{field('location', 'Localização')}{field('fit', 'Adequação à oferta', true)}{select('verification', 'Verificação', [{ value: 'unknown', label: 'Desconhecida' }, { value: 'researched', label: 'Pesquisada' }, { value: 'verified', label: 'Verificada' }])}{field('researchedAt', 'Data da pesquisa', false, 'date')}<label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={Boolean(data.doNotContact)} onChange={event => set('doNotContact', event.target.checked)} />Preferência de não contato</label><div><Label>Canais públicos · tipo: valor, um por linha</Label><Textarea className="mt-2" placeholder="website: https://…" value={((data.channels || []) as { type: string; value: string }[]).map(channel => `${channel.type}: ${channel.value}`).join('\n')} onChange={event => set('channels', event.target.value.split('\n').filter(Boolean).map(line => { const [type, ...value] = line.split(':'); return { type: type.trim(), value: value.join(':').trim() }; }))} /></div></>}
      {editor?.kind === 'opportunity' && <>{select('stage', 'Etapa comercial', Object.entries(stageNames).map(([value, label]) => ({ value, label })))}{field('offering', 'Serviço ou produto', true)}{field('contactId', 'ID do contato associado')}{field('grossEstimate', 'Valor bruto estimado', false, 'number')}{field('costEstimate', 'Custos estimados', false, 'number')}{field('ownerShareEstimate', 'Parcela estimada do proprietário', false, 'number')}{field('expectedCloseDate', 'Previsão de fechamento', false, 'date')}{field('expectedReceiptDate', 'Previsão de recebimento', false, 'date')}{field('nextAction', 'Próxima ação', true)}{field('followUpDate', 'Follow-up', false, 'date')}</>}
      {editor?.kind === 'campaign' && <>{field('objective', 'Objetivo', true)}{field('audience', 'Público')}{lines('selectionCriteria', 'Critérios de seleção')}<CampaignEditor data={data} original={editor.record?.data} onChange={set} /><p className="text-xs text-muted-foreground">Sirius pode preparar a lista pesquisada e as versões das mensagens para sua revisão. Preparar não autoriza envio.</p></>}
      {editor?.kind === 'content' && <>{field('body', 'Brief de conteúdo', true)}{select('channel', 'Canal', ['blog', 'youtube', 'instagram', 'tiktok'].map(value => ({ value, label: value })))}{field('format', 'Formato')}{field('editorialLine', 'Linha editorial')}{field('audience', 'Público')}{field('objective', 'Objetivo')}{field('cta', 'CTA')}{field('responsible', 'Responsável')}</>}
      {editor?.kind === 'deliverable' && <>{field('objective', 'Objetivo', true)}{field('body', 'Conteúdo da entrega', true)}{field('fileUrl', 'Referência ao arquivo')}{field('verificationSummary', 'Resumo de verificação', true)}{lines('comments', 'Comentários e pedidos de alteração')}<p className="text-xs text-muted-foreground">Salvar mudanças cria nova versão e invalida a aprovação anterior.</p></>}
      </>}
      <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Fontes e evidências</summary><p className="mt-3 text-xs text-muted-foreground">Fatos precisam de origem. URLs opcionais; o estado de verificação permanece explícito.</p>{((data[editor?.kind === 'context' ? 'facts' : 'sources'] || []) as { statement: string; url?: string; verification?: string }[]).map((source, index) => <div key={index} className="mt-4 space-y-2"><Input aria-label={`Fato ${index + 1}`} value={source.statement} onChange={event => { const key = editor?.kind === 'context' ? 'facts' : 'sources'; const entries = [...((data[key] || []) as typeof source[])]; entries[index] = { ...source, statement: event.target.value }; set(key, entries); }} /><Input aria-label={`URL da fonte ${index + 1}`} value={source.url || ''} placeholder="https://…" onChange={event => { const key = editor?.kind === 'context' ? 'facts' : 'sources'; const entries = [...((data[key] || []) as typeof source[])]; entries[index] = { ...source, url: event.target.value || undefined }; set(key, entries); }} /></div>)}{['context', 'contact', 'deliverable'].includes(editor?.kind || '') && <Button variant="outline" className="mt-4" onClick={() => { const key = editor?.kind === 'context' ? 'facts' : 'sources'; set(key, [...((data[key] || []) as unknown[]), { statement: '', verification: 'unknown' }]); }}>Adicionar evidência</Button>}</details>
    </div><DialogFooter><Button variant="outline" disabled={busy} onClick={() => setEditor(null)}>Cancelar</Button><Button disabled={busy} onClick={() => void save()}>{busy ? 'Salvando…' : 'Salvar'}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={Boolean(review)} onOpenChange={open => !open && !busy && setReview(null)}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Revise antes de aprovar</DialogTitle><DialogDescription>Esta decisão vale apenas para os campos e a versão abaixo. Não autoriza envio nem publicação.</DialogDescription></DialogHeader>{review && (() => {
      const keys = Object.keys(review.data).filter(key => key !== 'workId' && formatValue(key, review.data[key]) !== '');
      const changed = (key: string) => reviewCurrent !== null && JSON.stringify(reviewCurrent[key] ?? null) !== JSON.stringify(review.data[key] ?? null);
      const changes = reviewCurrent ? keys.filter(changed).length : null;
      return <>
        <p className="text-xs text-muted-foreground">{approvalNames[review.approvalType] || review.approvalType} · preparada por {review.author} · vale até {new Date(review.expiresAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}{changes !== null && ` · ${changes ? plural(changes, 'campo muda', 'campos mudam') : 'nenhum campo muda'}`}</p>
        <dl className="divide-y rounded-xl border">{keys.map(key => <div key={key} className={`grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-[160px_1fr] ${changed(key) ? 'bg-primary/5' : ''}`}><dt className="text-xs text-muted-foreground">{fieldLabels[key] || key}{changed(key) && <span className="ml-2 rounded bg-primary/15 px-1.5 text-[10px] font-medium uppercase text-primary">muda</span>}</dt><dd className="min-w-0 whitespace-pre-wrap break-words">{changed(key) && reviewCurrent && formatValue(key, reviewCurrent[key]) && <span className="mr-2 text-muted-foreground line-through">{formatValue(key, reviewCurrent[key])}</span>}{formatValue(key, review.data[key])}</dd></div>)}</dl>
        <p className="text-xs text-muted-foreground">Para mudar algum campo, peça uma nova proposta. Uma versão diferente exige outra aprovação.</p>
      </>;
    })()}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => setReview(null)}>Voltar</Button><Button disabled={busy || review?.approvalType === 'external_action'} onClick={() => review && void approve(review)}><ShieldCheck className="mr-2 h-4 w-4" />{busy ? 'Registrando…' : 'Aprovar estes campos'}</Button></DialogFooter></DialogContent></Dialog>
  </main>;
}
