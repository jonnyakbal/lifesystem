'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Award, Edit2, ExternalLink, Trash2, Calendar, Landmark, Sparkles, Loader2, SlidersHorizontal, Radar, CheckSquare, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { runStageTrigger } from '@/lib/edital-triggers';
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
    if (!title.trim()) return;
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
    try {
      if (editing) {
        const stageChanged = editStage !== editing.stage;
        await apiFetch(`/api/editais/${editing.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, stage: editStage }),
        });
        if (stageChanged) {
          const stageDef = stages.find(s => s.id === editStage);
          if (stageDef?.trigger) {
            await runStageTrigger(stageDef.trigger, { ...editing, ...payload, stage: editStage });
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
        await runStageTrigger(stageDef.trigger, { ...edital, stage: newStage });
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
    const fontes = (settings?.fontes || []).slice(0, 6);
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

  return (
    <motion.div className="p-4 lg:p-8" variants={stagger} initial="initial" animate="animate">
      <motion.div variants={fade} className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight">
            <Award className="h-7 w-7 text-primary" /> Editais Culturais
          </h1>
          <p className="text-muted-foreground">Radar de oportunidades — descubra, analise, inscreva-se.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      </motion.div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64 w-full" />)}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stages.map(stage => (
            <div
              key={stage.id}
              className="space-y-3"
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                const edital = editais.find(x => x.id === id);
                if (edital) moveEdital(edital, stage.id);
                setDraggedId(null);
              }}
            >
              <div className="flex items-center gap-2 px-1">
                <span className={cn('h-2 w-2 rounded-full', stage.dot)} />
                <h3 className="text-sm font-medium">{stage.label}</h3>
                <Badge variant="outline" className="ml-auto text-xs">{editais.filter(e => e.stage === stage.id).length}</Badge>
              </div>
              <div className="space-y-2">
                {editais.filter(e => e.stage === stage.id).map(edital => (
                  <Card
                    key={edital.id}
                    draggable
                    onDragStart={(e) => { setDraggedId(edital.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', edital.id); }}
                    onDragEnd={() => setDraggedId(null)}
                    onClick={() => openEdit(edital)}
                    className={cn('cursor-pointer transition-opacity hover:shadow-md', draggedId === edital.id && 'opacity-50')}
                  >
                    <CardContent className="space-y-2 p-3">
                      <p className="text-sm font-medium leading-tight">{edital.title}</p>
                      {edital.orgao && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground"><Landmark className="h-3 w-3" /> {edital.orgao}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {formatMoney(edital.valor) && <Badge variant="secondary" className="text-xs">{formatMoney(edital.valor)}</Badge>}
                        {edital.prazoInscricao && (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Calendar className="h-3 w-3" /> {new Date(edital.prazoInscricao + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </Badge>
                        )}
                        {pillarOf(edital.pillarId) && <span className="text-xs">{pillarOf(edital.pillarId)!.icon}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {editais.filter(e => e.stage === stage.id).length === 0 && (
                  <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">Solte aqui</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-lg flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editing ? 'Editar Edital' : 'Novo Edital'}</DialogTitle>
            <DialogDescription>{editing ? 'Altere os detalhes do edital' : 'Adicione uma oportunidade ao radar'}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 space-y-4 overflow-y-auto py-2">
            <div className="grid gap-2">
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do edital" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Órgão/Instituição</Label>
                <Input value={orgao} onChange={(e) => setOrgao(e.target.value)} placeholder="Ex: Prefeitura, Ministério" />
              </div>
              <div className="grid gap-2">
                <Label>Valor (R$)</Label>
                <Input type="number" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Prazo de inscrição</Label>
                <Input type="date" value={prazoInscricao} onChange={(e) => setPrazoInscricao(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Pilar</Label>
                <Select value={pillarId} onValueChange={setPillarId}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {pillars.map(p => <SelectItem key={p.id} value={p.id}><span className="flex items-center gap-2">{p.icon} {p.name}</span></SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Link do edital</Label>
              <div className="flex gap-2">
                <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
                {link && (
                  <Button variant="outline" size="icon" asChild>
                    <a href={link} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                  </Button>
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Do que se trata..." />
            </div>
            <div className="grid gap-2">
              <Label>Notas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anotações livres..." />
            </div>
            {editing && (
              <div className="grid gap-2">
                <Label>Etapa</Label>
                <Select value={editStage} onValueChange={setEditStage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Também dá pra arrastar o card entre colunas no quadro.</p>
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t pt-4">
            {editing && <Button variant="destructive" onClick={() => handleDelete(editing.id)}><Trash2 className="mr-2 h-4 w-4" /> Excluir</Button>}
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!title.trim()}>
              {editing ? 'Salvar' : 'Adicionar'}
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
