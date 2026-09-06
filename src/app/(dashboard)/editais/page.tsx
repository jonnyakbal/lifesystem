'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Award, Edit2, ExternalLink, Trash2, Calendar, Landmark } from 'lucide-react';
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
import type { Edital, StageDef } from '@/types';

interface Pillar { id: string; name: string; icon: string; }

const fade = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };
const stagger = { animate: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } } };

function formatMoney(v?: number) {
  if (v === undefined || v === null) return null;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

  return (
    <motion.div className="p-4 lg:p-8" variants={stagger} initial="initial" animate="animate">
      <motion.div variants={fade} className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight">
            <Award className="h-7 w-7 text-primary" /> Editais Culturais
          </h1>
          <p className="text-muted-foreground">Radar de oportunidades — descubra, analise, inscreva-se.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setStageDialogOpen(true)} title="Editar etapas">
            <Edit2 className="h-4 w-4" />
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
