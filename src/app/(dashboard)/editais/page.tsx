'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Plus, Edit2, ExternalLink, Trash2, Calendar, Landmark, Sparkles, Loader2, SlidersHorizontal, Radar, CheckSquare, Square, Search, List, Columns3, ArrowRight, FolderKanban } from 'lucide-react';
import { addDays, cn, todayStr } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import { StageConfigDialog } from '@/components/stage-config-dialog';
import { WorkspaceHeading, WorkspaceMetric } from '@/components/workspace/workspace-heading';
import type { Edital, EditalSettings, StageDef } from '@/types';

interface Pillar { id: string; name: string; icon: string; }

const fade = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };
const stagger = { animate: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } } };

function formatMoney(v?: number) {
  if (v === undefined || v === null) return null;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface Candidato {
  titulo: string;
  orgao: string | null;
  prazoInscricao: string | null;
  valor: number | null;
  resumo: string;
  nota: number;
  justificativa: string;
  fonte: string;
}

interface EditalAnalysis {
  titulo: string;
  orgao: string | null;
  descricao: string;
  valor: number | null;
  prazoInscricao: string | null;
  aderencia: { nota: number; justificativa: string };
  documentos: string[];
}

export default function EditaisPage() {
  const [editais, setEditais] = useState<Edital[]>([]);
  const [stages, setStages] = useState<StageDef[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Edital | null>(null);
  const [title, setTitle] = useState('');
  const [orgao, setOrgao] = useState('');
  const [description, setDescription] = useState('');
  const [valor, setValor] = useState('');
  const [prazoInscricao, setPrazoInscricao] = useState('');
  const [link, setLink] = useState('');
  const [pillarId, setPillarId] = useState('');
  const [notes, setNotes] = useState('');
  const [editStage, setEditStage] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<EditalAnalysis | null>(null);
  const [cockpitOpen, setCockpitOpen] = useState(false);
  const [buscaOpen, setBuscaOpen] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null);
  const [errosBusca, setErrosBusca] = useState<{ fonte: string; erro: string }[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [progresso, setProgresso] = useState<{ atual: number; total: number } | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [settings, setSettings] = useState<EditalSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'board'>('list');
  const [filterStage, setFilterStage] = useState('all');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [e, s, p] = await Promise.all([
        apiFetch<Edital[]>('/api/editais'),
        apiFetch<{ stages: StageDef[] }>('/api/stage-configs/editais'),
        apiFetch<Pillar[]>('/api/pillars'),
      ]);
      setEditais(e);
      setStages(s.stages);
      setPillars(p);
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setIsLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setTitle(''); setOrgao(''); setDescription(''); setValor(''); setPrazoInscricao(''); setLink(''); setPillarId(''); setNotes('');
    setIsDialogOpen(true);
  }

  function openEdit(edital: Edital) {
    setEditing(edital);
    setTitle(edital.title);
    setOrgao(edital.orgao || '');
    setDescription(edital.description || '');
    setValor(edital.valor !== undefined ? String(edital.valor) : '');
    setPrazoInscricao(edital.prazoInscricao || '');
    setLink(edital.link || '');
    setPillarId(edital.pillarId || '');
    setNotes(edital.notes || '');
    setEditStage(edital.stage);
    setIsDialogOpen(true);
  }

  async function handleSave() {
    if (!title.trim() || saving) return;
    const payload = {
      title: title.trim(),
      orgao: orgao || undefined,
      description: description || undefined,
      valor: valor ? Number(valor) : undefined,
      prazoInscricao: prazoInscricao || undefined,
      link: link || undefined,
      pillarId: pillarId || undefined,
      notes: notes || undefined,
    };
    setSaving(true);
    try {
      if (editing) {
        const stageChanged = editStage !== editing.stage;
        await apiFetch(`/api/editais/${editing.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, stage: editStage }),
        });
        if (stageChanged) {
          const stageDef = stages.find(s => s.id === editStage);
          if (stageDef?.trigger) {
            toast.success(stageDef.trigger.action === 'create_project' ? 'Projeto criado a partir do edital!' : 'Tarefa de lembrete criada!');
          }
        }
        toast.success('Edital atualizado!');
      } else {
        await apiFetch('/api/editais', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, stage: stages[0]?.id || 'radar' }),
        });
        toast.success('Edital adicionado ao radar!');
      }
      setIsDialogOpen(false);
      loadAll();
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/editais/${id}`, { method: 'DELETE' });
      setIsDialogOpen(false);
      loadAll();
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function moveEdital(edital: Edital, newStage: string) {
    if (edital.stage === newStage) return;
    try {
      await apiFetch(`/api/editais/${edital.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: newStage }),
      });
      const stageDef = stages.find(s => s.id === newStage);
      if (stageDef?.trigger) {
        toast.success(stageDef.trigger.action === 'create_project' ? 'Projeto criado a partir do edital!' : 'Tarefa de lembrete criada!');
      }
      loadAll();
    } catch (err) {
      toast.error(showError(err));
    }
  }

  function countUsage(stageId: string) {
    return editais.filter(e => e.stage === stageId).length;
  }

  function pillarOf(id?: string) {
    return pillars.find(p => p.id === id);
  }

  async function openCockpit() {
    setCockpitOpen(true);
    if (settings) return;
    try {
      setSettings(await apiFetch<EditalSettings>('/api/edital-settings'));
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function saveSettings() {
    if (!settings) return;
    setSavingSettings(true);
    try {
      const saved = await apiFetch<EditalSettings>('/api/edital-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setSettings(saved);
      setCockpitOpen(false);
      toast.success('Cockpit atualizado!');
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setSavingSettings(false);
    }
  }

  async function buscarEditais() {
    setBuscaOpen(true);
    setBuscando(true);
    setCandidatos(null);
    setErrosBusca([]);
    setSelecionados(new Set());
    let activeSettings = settings;
    if (!activeSettings) {
      try {
        activeSettings = await apiFetch<EditalSettings>('/api/edital-settings');
        setSettings(activeSettings);
      } catch (err) {
        toast.error(showError(err));
        setBuscando(false);
        setBuscaOpen(false);
        return;
      }
    }
    const fontes = activeSettings.fontes.slice(0, 6);
    if (fontes.length === 0) {
      toast.error('Cadastre pelo menos uma fonte no cockpit.');
      setBuscando(false);
      setBuscaOpen(false);
      return;
    }
    const achados: Candidato[] = [];
    const falhas: { fonte: string; erro: string }[] = [];
    try {
      // One request per source: a single free-tier model call already runs
      // close to a minute, so sweeping them all in one request would hit
      // proxy timeouts in production.
      for (let i = 0; i < fontes.length; i++) {
        setProgresso({ atual: i + 1, total: fontes.length });
        try {
          const r = await apiFetch<{ candidatos: Candidato[]; erros: { fonte: string; erro: string }[] }>(
            '/api/editais/descobrir',
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fonte: fontes[i] }) }
          );
          // Each source is its own request, so the server can only dedupe
          // against the board — two sources listing the same edital would
          // otherwise collide on the title used as React key and as the
          // selection id.
          for (const c of r.candidatos) {
            if (achados.some(a => a.titulo === c.titulo)) continue;
            achados.push(c);
          }
          falhas.push(...r.erros);
        } catch (err) {
          falhas.push({ fonte: fontes[i], erro: showError(err) });
        }
        setCandidatos([...achados]);
        setErrosBusca([...falhas]);
      }
      setSelecionados(new Set(achados.map(c => c.titulo)));
    } finally {
      setBuscando(false);
      setProgresso(null);
    }
  }

  async function adicionarSelecionados() {
    if (!candidatos) return;
    const escolhidos = candidatos.filter(c => selecionados.has(c.titulo));
    if (escolhidos.length === 0) return;
    setAdicionando(true);
    try {
      for (const c of escolhidos) {
        await apiFetch('/api/editais', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: c.titulo,
            orgao: c.orgao || undefined,
            description: c.resumo || undefined,
            valor: c.valor ?? undefined,
            prazoInscricao: c.prazoInscricao || undefined,
            link: c.fonte,
            stage: stages[0]?.id || 'radar',
            notes: `Aderência ${c.nota}/10 — ${c.justificativa}`,
          }),
        });
      }
      setBuscaOpen(false);
      loadAll();
      toast.success(`${escolhidos.length} edital(is) no Radar!`);
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setAdicionando(false);
    }
  }

  function toggleCandidato(titulo: string) {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(titulo)) next.delete(titulo); else next.add(titulo);
      return next;
    });
  }

  async function analisar() {
    const input = aiInput.trim();
    if (!input) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const isUrl = /^https?:\/\//i.test(input);
      const result = await apiFetch<EditalAnalysis>('/api/editais/analisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isUrl ? { url: input } : { text: input }),
      });
      setAiResult(result);
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setAiLoading(false);
    }
  }

  async function criarDaAnalise(comTarefas: boolean) {
    if (!aiResult) return;
    const input = aiInput.trim();
    try {
      await apiFetch('/api/editais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: aiResult.titulo,
          orgao: aiResult.orgao || undefined,
          description: aiResult.descricao || undefined,
          valor: aiResult.valor ?? undefined,
          prazoInscricao: aiResult.prazoInscricao || undefined,
          link: /^https?:\/\//i.test(input) ? input : undefined,
          stage: stages[0]?.id || 'radar',
        }),
      });
      if (comTarefas) {
        for (const doc of aiResult.documentos) {
          await apiFetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: `${doc} — ${aiResult.titulo}`,
              dueDate: aiResult.prazoInscricao || undefined,
              tags: ['Edital'],
            }),
          });
        }
      }
      setAiOpen(false);
      setAiInput('');
      setAiResult(null);
      loadAll();
      toast.success(comTarefas ? 'Edital e tarefas criados!' : 'Edital criado no Radar!');
    } catch (err) {
      toast.error(showError(err));
    }
  }

  const knownStages = useMemo(() => new Set(stages.map(stage => stage.id)), [stages]);
  const hasUnmapped = editais.some(edital => !knownStages.has(edital.stage));
  const displayStages: (StageDef & { unmapped?: boolean })[] = hasUnmapped ? [...stages, { id: '__unmapped', label: 'Etapa anterior', dot: 'bg-muted-foreground', color: 'text-muted-foreground', unmapped: true }] : stages;
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return editais.filter(edital => (filterStage === 'all' || (filterStage === '__unmapped' ? !knownStages.has(edital.stage) : edital.stage === filterStage)) && (!query || `${edital.title} ${edital.orgao ?? ''} ${edital.description ?? ''}`.toLocaleLowerCase('pt-BR').includes(query)));
  }, [editais, search, filterStage, knownStages]);
  const today = todayStr();
  const closingSoon = editais.filter(edital => edital.prazoInscricao && edital.prazoInscricao >= today && edital.prazoInscricao <= addDays(today, 14) && !stages.find(stage => stage.id === edital.stage)?.isTerminal).length;

  function renderEditalCard(edital: Edital) {
    const stage = stages.find(stage => stage.id === edital.stage);
    const pillar = pillarOf(edital.pillarId);
    const deadline = edital.prazoInscricao;
    const overdue = Boolean(deadline && deadline < today && !stage?.isTerminal);
    const soon = Boolean(deadline && deadline >= today && deadline <= addDays(today, 14) && !stage?.isTerminal);
    return <Card key={edital.id} draggable={view === 'board'} onDragStart={event => { setDraggedId(edital.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', edital.id); }} onDragEnd={() => setDraggedId(null)} onClick={() => openEdit(edital)} className={cn('work-item-card group cursor-pointer transition-colors hover:border-primary/40', draggedId === edital.id && 'opacity-50')}>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className={cn('h-1.5 w-1.5 rounded-full', stage?.dot ?? 'bg-muted-foreground')} />{stage?.label ?? 'Etapa anterior'}</span>
          {pillar && <span className="truncate">{pillar.icon} {pillar.name}</span>}
        </div>
        <h3 className="font-display text-xl leading-snug"><button type="button" aria-label={`Abrir edital ${edital.title}`} onClick={event => { event.stopPropagation(); openEdit(edital); }} className="work-card-title line-clamp-2 w-full text-left focus-visible:outline-2 focus-visible:outline-primary">{edital.title}</button></h3>
        {edital.orgao && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Landmark className="h-3.5 w-3.5 shrink-0" />{edital.orgao}</p>}
        {edital.description && <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{edital.description}</p>}
        <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
          {formatMoney(edital.valor) && <Badge variant="secondary" className="text-xs">{formatMoney(edital.valor)}</Badge>}
          {deadline && <span className={cn('inline-flex items-center gap-1.5 text-xs', overdue ? 'text-destructive' : soon ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}><Calendar className="h-3.5 w-3.5" />{new Date(deadline + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}{overdue ? ' · Encerrado' : soon ? ' · Em breve' : ''}</span>}
          {edital.projectId && <Link href={`/projetos?open=${encodeURIComponent(edital.projectId)}`} onClick={event => event.stopPropagation()} className="ml-auto inline-flex min-h-8 items-center gap-1 text-xs text-primary hover:underline"><FolderKanban className="h-3.5 w-3.5" /> Projeto <ArrowRight className="h-3 w-3" /></Link>}
        </div>
      </CardContent>
    </Card>;
  }

  return (
    <motion.div className="work-page p-4 lg:p-8" variants={stagger} initial="initial" animate="animate">
      <WorkspaceHeading eyebrow="Oportunidades em movimento" title="Editais Culturais" description="Encontre oportunidades que combinam com sua trajetória. Acompanhe os prazos e transforme uma boa inscrição no seu próximo projeto." actions={<>
          <Button variant="outline" size="icon" onClick={openCockpit} title="Cockpit da automação" aria-label="Cockpit da automação">
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setStageDialogOpen(true)} title="Editar etapas" aria-label="Editar etapas">
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={buscarEditais} className="gap-1.5">
            <Radar className="h-4 w-4" /> Buscar editais
          </Button>
          <Button variant="outline" onClick={() => { setAiResult(null); setAiInput(''); setAiOpen(true); }} className="gap-1.5">
            <Sparkles className="h-4 w-4" /> Analisar com IA
          </Button>
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" /> Novo edital
          </Button>
      </>}>
        <div className="work-metrics">
          <WorkspaceMetric label="No radar" value={isLoading ? '—' : editais.length} detail="Oportunidades em todas as etapas" tone="primary" />
          <WorkspaceMetric label="Nos próximos 14 dias" value={isLoading ? '—' : closingSoon} detail="Inscrições abertas perto do prazo" tone={closingSoon ? 'warning' : 'default'} />
          <WorkspaceMetric label="Viraram projetos" value={isLoading ? '—' : editais.filter(edital => edital.projectId).length} detail="Da oportunidade para a realização" />
        </div>
      </WorkspaceHeading>

      <div className="work-project-controls">
        <div className="relative min-w-0 flex-1 sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Filtrar editais" placeholder="Filtrar por edital ou instituição..." value={search} onChange={event => setSearch(event.target.value)} className="h-11 pl-9" /></div>
        <div className="work-view-switch" role="group" aria-label="Visualização dos editais"><Button size="sm" variant={view === 'list' ? 'secondary' : 'ghost'} aria-label="Visualização: Lista" aria-pressed={view === 'list'} onClick={() => setView('list')} className="gap-1.5"><List className="h-4 w-4" />Lista</Button><Button size="sm" variant={view === 'board' ? 'secondary' : 'ghost'} aria-label="Visualização: Quadro" aria-pressed={view === 'board'} onClick={() => setView('board')} className="gap-1.5"><Columns3 className="h-4 w-4" />Quadro</Button></div>
        <Link href="/projetos" className="ml-auto inline-flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">Projetos <ArrowRight className="h-3.5 w-3.5" /></Link>
      </div>
      {editais.length > 0 && <div className="work-stage-tabs" aria-label="Filtrar editais por etapa"><button aria-pressed={filterStage === 'all'} onClick={() => setFilterStage('all')}>Todos <span>{editais.length}</span></button>{displayStages.map(stage => <button key={stage.id} aria-pressed={filterStage === stage.id} onClick={() => setFilterStage(stage.id)}><i className={stage.dot} />{stage.label}<span>{editais.filter(edital => stage.unmapped ? !knownStages.has(edital.stage) : edital.stage === stage.id).length}</span></button>)}</div>}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64 w-full" />)}</div>
      ) : editais.length === 0 ? (
        // Primeira experiência do módulo: orientar pra ação, não expor o
        // jargão de kanban ("Solte aqui") numa tela totalmente vazia.
        <motion.div variants={fade}>
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
                <Radar className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-display text-2xl">Seu próximo projeto começa aqui</p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">Cadastre uma oportunidade ou busque nas fontes que você acompanha. Organize cada passo da inscrição em um lugar só.</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <Button onClick={buscarEditais} className="gap-1.5">
                  <Radar className="h-4 w-4" /> Buscar editais com IA
                </Button>
                <Button variant="outline" onClick={openCreate} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Novo edital
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : filtered.length === 0 ? <div className="work-empty"><Search className="h-7 w-7 text-muted-foreground" /><h2 className="font-display text-2xl">Nenhum edital encontrado</h2><span>Tente outra busca ou explore todas as etapas.</span><Button variant="outline" onClick={() => { setSearch(''); setFilterStage('all'); }}>Limpar filtros</Button></div> : view === 'list' ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map(renderEditalCard)}</div> : (
        <div className="work-board" aria-label="Quadro de editais">
          {displayStages.filter(stage => filterStage === 'all' || filterStage === stage.id).map(stage => (
            <div
              key={stage.id}
              className="work-board-column"
              onDragOver={(e) => { if (!stage.unmapped) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
              onDrop={(e) => {
                e.preventDefault();
                if (stage.unmapped) return;
                const id = e.dataTransfer.getData('text/plain');
                const edital = editais.find(x => x.id === id);
                if (edital) moveEdital(edital, stage.id);
                setDraggedId(null);
              }}
            >
              <div className="flex items-center gap-2 px-1">
                <span className={cn('h-2 w-2 rounded-full', stage.dot)} />
                <h3 className="text-sm font-medium">{stage.label}</h3>
                <Badge variant="outline" className="ml-auto text-xs">{filtered.filter(e => stage.unmapped ? !knownStages.has(e.stage) : e.stage === stage.id).length}</Badge>
              </div>
              <div className="work-board-lane space-y-3" data-lenis-prevent>
                {filtered.filter(e => stage.unmapped ? !knownStages.has(e.stage) : e.stage === stage.id).map(renderEditalCard)}
                {filtered.filter(e => stage.unmapped ? !knownStages.has(e.stage) : e.stage === stage.id).length === 0 && (
                  <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">Nenhum edital nesta etapa</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="flex max-h-[90dvh] max-w-lg flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editing ? 'Editar Edital' : 'Novo Edital'}</DialogTitle>
            <DialogDescription>{editing ? 'Altere os detalhes do edital' : 'Adicione uma oportunidade ao radar'}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-2" data-lenis-prevent>
            <div className="grid gap-2">
              <Label htmlFor="edital-title">Título</Label>
              <Input id="edital-title" aria-label="Título do edital" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do edital" autoFocus />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="edital-institution">Órgão/Instituição</Label>
                <Input id="edital-institution" value={orgao} onChange={(e) => setOrgao(e.target.value)} placeholder="Ex: Prefeitura, Ministério" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edital-value">Valor (R$)</Label>
                <Input id="edital-value" type="number" min={0} value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="edital-deadline">Prazo de inscrição</Label>
                <Input id="edital-deadline" type="date" value={prazoInscricao} onChange={(e) => setPrazoInscricao(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Pilar</Label>
                <Select value={pillarId || 'none'} onValueChange={value => setPillarId(value === 'none' ? '' : value)}>
                  <SelectTrigger aria-label="Pilar do edital"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {pillars.map(p => <SelectItem key={p.id} value={p.id}><span className="flex items-center gap-2">{p.icon} {p.name}</span></SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edital-url">Link do edital</Label>
              <div className="flex gap-2">
                <Input id="edital-url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." inputMode="url" />
                {link && (
                  <Button variant="outline" size="icon" asChild>
                    <a href={link} target="_blank" rel="noopener noreferrer" aria-label="Abrir link do edital"><ExternalLink className="h-4 w-4" /></a>
                  </Button>
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edital-description">Descrição</Label>
              <Textarea id="edital-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Do que se trata..." />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edital-notes">Notas</Label>
              <Textarea id="edital-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anotações livres..." />
            </div>
            {editing && (
              <div className="grid gap-2">
                <Label>Etapa</Label>
                <Select value={editStage} onValueChange={setEditStage}>
                  <SelectTrigger aria-label="Etapa do edital"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {!knownStages.has(editStage) && editStage && <SelectItem value={editStage}>Etapa anterior</SelectItem>}
                    {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Escolha uma etapa aqui ou arraste o cartão na visualização de quadro.</p>
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t pt-4">
            {editing && <Button variant="destructive" disabled={saving} onClick={() => handleDelete(editing.id)}><Trash2 className="mr-2 h-4 w-4" /> Excluir</Button>}
            <Button variant="outline" disabled={saving} onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!title.trim() || saving}>
              {saving ? 'Salvando...' : editing ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={buscaOpen} onOpenChange={setBuscaOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2"><Radar className="h-4 w-4 text-primary" /> Buscar editais</DialogTitle>
            <DialogDescription>Varre as fontes do cockpit, descarta o que já está no quadro e o que fica abaixo da sua nota mínima.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-3 overflow-y-auto py-2">
            {buscando && (
              <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {progresso ? `Analisando fonte ${progresso.atual} de ${progresso.total}...` : 'Lendo as fontes...'}
              </div>
            )}

            {!buscando && candidatos?.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum edital novo encontrado. Se isso se repetir, troque as fontes no cockpit por páginas que listem editais abertos.
              </p>
            )}

            {!buscando && candidatos?.map((c) => {
              const on = selecionados.has(c.titulo);
              return (
                <button
                  key={c.titulo}
                  onClick={() => toggleCandidato(c.titulo)}
                  className={cn('flex w-full gap-3 rounded-lg border p-3 text-left transition-colors', on ? 'border-primary bg-primary/5' : 'hover:border-primary/40')}
                >
                  {on ? <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <Square className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{c.titulo}</p>
                    {c.orgao && <p className="text-sm text-muted-foreground">{c.orgao}</p>}
                    <p className="mt-1 text-sm">{c.resumo}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={cn(c.nota >= 7 ? 'text-money' : c.nota >= 4 ? 'text-yellow-500' : 'text-destructive')}>
                        {c.nota}/10
                      </Badge>
                      {c.valor !== null && <Badge variant="secondary">{formatMoney(c.valor)}</Badge>}
                      {c.prazoInscricao && <Badge variant="secondary" className="gap-1"><Calendar className="h-3 w-3" /> {c.prazoInscricao}</Badge>}
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">{c.justificativa}</p>
                  </div>
                </button>
              );
            })}

            {errosBusca.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive">Fontes que falharam</p>
                {errosBusca.map(e => (
                  <p key={e.fonte} className="mt-1 text-xs text-muted-foreground break-all">{e.fonte} — {e.erro}</p>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setBuscaOpen(false)}>Fechar</Button>
            <Button onClick={adicionarSelecionados} disabled={buscando || adicionando || selecionados.size === 0} className="gap-1.5">
              {adicionando
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Adicionando...</>
                : <><Plus className="h-4 w-4" /> Adicionar {selecionados.size > 0 ? selecionados.size : ''}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cockpitOpen} onOpenChange={setCockpitOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-primary" /> Cockpit da automação</DialogTitle>
            <DialogDescription>O contexto que a IA usa pra avaliar cada edital. Tudo aqui entra no prompt — quanto mais específico, melhor a nota de aderência.</DialogDescription>
          </DialogHeader>

          {!settings ? (
            <div className="space-y-3 py-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>
          ) : (
            <div className="flex-1 space-y-4 overflow-y-auto py-2">
              <div className="space-y-1.5">
                <Label>Seu perfil</Label>
                <Textarea rows={3} value={settings.perfil} onChange={(e) => setSettings({ ...settings, perfil: e.target.value })} />
                <p className="text-xs text-muted-foreground">Quem você é e no que atua. Seus Pilares e Projetos já entram automaticamente.</p>
              </div>

              <div className="space-y-1.5">
                <Label>Pré-requisitos e restrições</Label>
                <Textarea rows={3} value={settings.preRequisitos} onChange={(e) => setSettings({ ...settings, preRequisitos: e.target.value })} />
                <p className="text-xs text-muted-foreground">O que te desqualifica ou limita (CNPJ, região, tempo de atuação). A IA derruba a nota quando o edital exige algo que você não tem.</p>
              </div>

              <div className="space-y-1.5">
                <Label>Fontes monitoradas</Label>
                <Textarea
                  rows={4}
                  value={settings.fontes.join('\n')}
                  onChange={(e) => setSettings({ ...settings, fontes: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
                  placeholder="https://..."
                />
                <p className="text-xs text-muted-foreground">Uma URL por linha (máx. 6 por varredura). Páginas que listam editais abertos funcionam melhor — home de site e página de menu costumam vir vazias.</p>
              </div>

              <div className="space-y-1.5">
                <Label>Palavras-chave</Label>
                <Input
                  value={settings.palavrasChave.join(', ')}
                  onChange={(e) => setSettings({ ...settings, palavrasChave: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                />
                <p className="text-xs text-muted-foreground">Separadas por vírgula. Vão alimentar a busca automática quando ela existir.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nota mínima de aderência</Label>
                  <Input
                    type="number" min={0} max={10}
                    value={settings.notaMinima}
                    onChange={(e) => setSettings({ ...settings, notaMinima: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Modelo de IA</Label>
                  <Select value={settings.modelo || 'auto'} onValueChange={(v) => setSettings({ ...settings, modelo: v === 'auto' ? undefined : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automático (tenta todos)</SelectItem>
                      <SelectItem value="nemotron-3-ultra-free">nemotron-3-ultra-free</SelectItem>
                      <SelectItem value="big-pickle">big-pickle</SelectItem>
                      <SelectItem value="nemotron-3.5-lightning-free">nemotron-3.5-lightning-free</SelectItem>
                      <SelectItem value="mimo-v2.5-free">mimo-v2.5-free</SelectItem>
                      <SelectItem value="ling-3.0-flash-fin-free">ling-3.0-flash-fin-free</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Só modelos gratuitos. No automático, se um bater no limite ele cai pro próximo.</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="shrink-0 gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setCockpitOpen(false)}>Cancelar</Button>
            <Button onClick={saveSettings} disabled={!settings || savingSettings}>
              {savingSettings ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Analisar edital com IA</DialogTitle>
            <DialogDescription>Cole o link do edital ou o texto inteiro. A IA extrai os dados, avalia se combina com seu perfil e sugere os documentos.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto py-2">
            <Textarea
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="https://... ou cole aqui o texto do edital"
              rows={4}
            />

            {aiResult && (
              <div className="space-y-3 rounded-lg border p-4">
                <div>
                  <p className="font-medium">{aiResult.titulo}</p>
                  {aiResult.orgao && <p className="text-sm text-muted-foreground">{aiResult.orgao}</p>}
                </div>
                <p className="text-sm">{aiResult.descricao}</p>

                <div className="flex flex-wrap gap-2">
                  {aiResult.valor !== null && <Badge variant="secondary">{formatMoney(aiResult.valor)}</Badge>}
                  {aiResult.prazoInscricao && <Badge variant="secondary" className="gap-1"><Calendar className="h-3 w-3" /> {aiResult.prazoInscricao}</Badge>}
                </div>

                <div className="rounded-md bg-muted/40 p-3">
                  <p className={cn('text-sm font-medium', aiResult.aderencia.nota >= 7 ? 'text-money' : aiResult.aderencia.nota >= 4 ? 'text-yellow-500' : 'text-destructive')}>
                    Aderência ao seu perfil: {aiResult.aderencia.nota}/10
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{aiResult.aderencia.justificativa}</p>
                </div>

                {aiResult.documentos.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-sm font-medium">Documentos sugeridos</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {aiResult.documentos.map((d, i) => <li key={i}>• {d}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t pt-4">
            {!aiResult ? (
              <Button onClick={analisar} disabled={!aiInput.trim() || aiLoading} className="gap-1.5">
                {aiLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analisando...</> : <><Sparkles className="h-4 w-4" /> Analisar</>}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => criarDaAnalise(false)}>Só o edital</Button>
                <Button onClick={() => criarDaAnalise(true)} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Criar + {aiResult.documentos.length} tarefas
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StageConfigDialog
        open={stageDialogOpen}
        onOpenChange={setStageDialogOpen}
        scope="editais"
        countUsage={countUsage}
        onSaved={setStages}
      />
    </motion.div>
  );
}
