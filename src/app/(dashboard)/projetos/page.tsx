'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'motion/react';
import { Plus, FolderKanban, ExternalLink, Trash2, X, Link as LinkIcon, Edit2 } from 'lucide-react';
import Link from 'next/link';
import { Search, LayoutGrid, Layers, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import { LinkedItemsPanel } from '@/components/linked-items-panel';
import { StageConfigDialog } from '@/components/stage-config-dialog';
import type { StageDef } from '@/types';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  tags: string[];
  links: { label: string; url: string }[];
  coverUrl?: string;
  coverColor?: string;
}

interface ProjectTask { id: string; title: string; status: string; projectId?: string; priority: string; dueDate?: string; waitingFor?: string | null }
interface LinkedContent { id: string; title?: string; linkedProjectIds?: string[] }
interface LinkedCapture { id: string; title?: string; content?: string; targetType?: string; targetId?: string }

const stagger = {
  animate: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};

export default function ProjectsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeStage, setActiveStage] = useState('all');
  const [viewMode, setViewMode] = useState<'gallery' | 'board'>('gallery');
  const [projects, setProjects] = useState<Project[]>([]);
  const [linkedContent, setLinkedContent] = useState<LinkedContent[]>([]);
  const [linkedCaptures, setLinkedCaptures] = useState<LinkedCapture[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
  const [taskStages, setTaskStages] = useState<StageDef[]>([]);
  const [nextDrafts, setNextDrafts] = useState<Record<string, string>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [stages, setStages] = useState<StageDef[]>([]);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const getStage = (id: string) => stages.find(s => s.id === id);
  const getStatusLabel = (id: string) => getStage(id)?.label || id;
  const [newProject, setNewProject] = useState<{ name: string; description: string; status: Project['status'] }>({ name: '', description: '', status: 'idea' });
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<Project['status']>('idea');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagsInput, setEditTagsInput] = useState('');
  const [editLinks, setEditLinks] = useState<{ label: string; url: string }[]>([]);
  const [editLinkLabel, setEditLinkLabel] = useState('');
  const [editLinkUrl, setEditLinkUrl] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [editCoverColor, setEditCoverColor] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const dragClickRef = useRef(false);

  useEffect(() => {
    loadProjects();
    loadStages();
    fetch('/api/content').then(r => r.json()).then(setLinkedContent).catch(() => {});
    fetch('/api/captures').then(r => r.json()).then(setLinkedCaptures).catch(() => {});
  }, []);

  async function loadStages() {
    try {
      const data = await apiFetch<{ stages: StageDef[] }>('/api/stage-configs/projects');
      setStages(data.stages);
    } catch (err) {
      toast.error(showError(err));
    }
  }

  // Deep-link support: ⌘K search + the Inbox "Virou projeto" badge land here
  // with ?open=<id> so they jump straight to the project instead of the
  // general board.
  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId || projects.length === 0) return;
    const project = projects.find(p => p.id === openId);
    if (project) {
      openEdit(project);
      router.replace('/projetos');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, searchParams]);

  function getProjectBacklinks(projectId: string) {
    const fromContent = linkedContent
      .filter(c => (c.linkedProjectIds || []).includes(projectId))
      .map(c => ({ id: c.id, type: 'content' as const, title: c.title || 'Sem título' }));
    const fromCaptures = linkedCaptures
      .filter(c => c.targetType === 'project' && c.targetId === projectId)
      .map(c => ({ id: c.id, type: 'capture' as const, title: (c.title || c.content?.replace(/<[^>]*>/g, '').slice(0, 60)) || 'Sem título' }));
    return [...fromContent, ...fromCaptures];
  }

  async function loadProjects() {
    try {
      const data = await apiFetch<Project[]>('/api/projects');
      setProjects(data);
      void apiFetch<ProjectTask[]>('/api/tasks').then(setProjectTasks).catch(() => {});
      void apiFetch<{ stages: StageDef[] }>('/api/stage-configs/tasks').then(config => setTaskStages(config.stages || [])).catch(() => {});
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newProject.name.trim()) return;
    try {
      await apiFetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject),
      });
      setNewProject({ name: '', description: '', status: 'idea' });
      setIsDialogOpen(false);
      loadProjects();
      toast.success('Projeto criado!');
    } catch (err) {
      toast.error(showError(err));
    }
  }

  function openEdit(project: Project) {
    setEditingProject(project);
    setEditName(project.name);
    setEditDescription(project.description);
    setEditStatus(project.status);
    setEditTags([...project.tags]);
    setEditLinks([...project.links]);
    setEditCoverUrl(project.coverUrl || '');
    setEditCoverColor(project.coverColor || '');
    setIsEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!editingProject) return;
    try {
      await apiFetch(`/api/projects/${editingProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: editName, 
          description: editDescription, 
          status: editStatus, 
          tags: editTags, 
          links: editLinks,
          coverUrl: editCoverUrl,
          coverColor: editCoverColor,
        }),
      });
      setIsEditOpen(false);
      loadProjects();
      toast.success('Projeto atualizado!');
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function handleDeleteProject(id: string) {
    try {
      const project = projects.find(p => p.id === id);
      await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
      setIsEditOpen(false);
      loadProjects();
      toast('Projeto excluído', {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            if (project) {
              try {
                await apiFetch('/api/projects', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(project),
                });
                loadProjects();
                toast.success('Projeto restaurado!');
              } catch (err) {
                toast.error(showError(err));
              }
            }
          },
        },
      });
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function handleMoveProject(projectId: string, newStatus: Project['status']) {
    try {
      await apiFetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      loadProjects();
    } catch (err) {
      toast.error(showError(err));
    }
  }

  function addTag() {
    const tag = editTagsInput.trim();
    if (tag && !editTags.includes(tag)) {
      setEditTags([...editTags, tag]);
      setEditTagsInput('');
    }
  }

  function removeTag(tag: string) {
    setEditTags(editTags.filter(t => t !== tag));
  }

  function addLink() {
    if (editLinkLabel.trim() && editLinkUrl.trim()) {
      setEditLinks([...editLinks, { label: editLinkLabel, url: editLinkUrl }]);
      setEditLinkLabel('');
      setEditLinkUrl('');
    }
  }

  function removeLink(index: number) {
    setEditLinks(editLinks.filter((_, i) => i !== index));
  }

  function handleDragStart(e: React.DragEvent, projectId: string) {
    dragClickRef.current = true;
    setDraggedId(projectId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', projectId);
  }

  function handleDragEnd() {
    setTimeout(() => {
      setDraggedId(null);
      dragClickRef.current = false;
    }, 100);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e: React.DragEvent, targetStatus: Project['status']) {
    e.preventDefault();
    const projectId = e.dataTransfer.getData('text/plain');
    if (projectId) {
      handleMoveProject(projectId, targetStatus);
    }
    setDraggedId(null);
  }

  const visibleProjects = projects.filter(project => (activeStage === 'all' || project.status === activeStage) && `${project.name} ${project.description} ${project.tags.join(' ')}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));

  // GTD: projeto ativo sem tarefa aberta (que dependa de mim) está parado.
  const activeStatuses = new Set(['active', 'development']);
  const terminalTaskIds = new Set(taskStages.filter(stage => stage.isTerminal).map(stage => stage.id).concat(taskStages.length ? [] : ['done']));
  const priorityRank: Record<string, number> = { urgent: 0, important: 1, normal: 2 };
  function projectWork(projectId: string) {
    const items = projectTasks.filter(task => task.projectId === projectId);
    const open = items.filter(task => !terminalTaskIds.has(task.status));
    const mine = open.filter(task => !task.waitingFor).sort((a, b) => (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
    return { total: items.length, done: items.length - open.length, next: mine[0], waiting: open.length - mine.length };
  }
  const stalled = projects.filter(project => activeStatuses.has(project.status) && !projectWork(project.id).next);

  async function addNextAction(project: Project) {
    const title = (nextDrafts[project.id] || '').trim();
    if (!title) return;
    try {
      const created = await apiFetch<ProjectTask>('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, projectId: project.id, status: taskStages.find(stage => !stage.isTerminal)?.id || 'todo', priority: 'normal' }) });
      setProjectTasks(current => [...current, created]);
      setNextDrafts(current => ({ ...current, [project.id]: '' }));
      toast.success('Próxima ação definida.');
    } catch (error) { toast.error(showError(error)); }
  }

  function projectCard(project: Project) {
    const work = projectWork(project.id);
    const isActive = activeStatuses.has(project.status);
    return <article key={project.id} draggable onDragStart={event => handleDragStart(event, project.id)} onDragEnd={handleDragEnd} className={cn('work-project-card project-card', draggedId === project.id && 'opacity-50', isActive && !work.next && 'is-stalled')}>
      {(project.coverUrl || project.coverColor) && <div className="project-card-band" aria-hidden="true">{project.coverUrl ? <Image src={project.coverUrl} alt="" fill unoptimized sizes="(max-width: 768px) 100vw, 33vw" /> : <div className={cn('h-full w-full bg-gradient-to-br', project.coverColor)} />}</div>}
      <div className="project-card-body">
        <div className="project-card-top"><span className="project-card-status"><span className={cn('h-1.5 w-1.5 rounded-full', getStage(project.status)?.dot)} />{getStatusLabel(project.status)}</span>{work.total > 0 && <span className="project-card-count">{work.done}/{work.total}</span>}</div>
        <button aria-label={`Abrir projeto ${project.name}`} onClick={() => { if (!dragClickRef.current) openEdit(project); }} className="project-card-title"><span>{project.name}</span><ArrowUpRight className="h-4 w-4 shrink-0" /></button>
        {project.description && <p className="project-card-desc">{project.description}</p>}
        {work.total > 0 && <div className="project-card-bar" aria-hidden="true"><i style={{ width: `${work.done / work.total * 100}%` }} /></div>}
        {work.next ? <Link href={`/tarefas?open=${encodeURIComponent(work.next.id)}`} className="project-next"><span>Próxima ação</span><strong>{work.next.title}</strong></Link>
          : isActive ? <form className="project-next is-missing" onSubmit={event => { event.preventDefault(); void addNextAction(project); }}>
            <span>Sem próxima ação</span>
            <input aria-label={`Próxima ação de ${project.name}`} value={nextDrafts[project.id] || ''} onChange={event => setNextDrafts(current => ({ ...current, [project.id]: event.target.value }))} placeholder="Qual o próximo passo? Enter" onPointerDown={event => event.stopPropagation()} />
          </form> : null}
        {work.waiting > 0 && <p className="project-card-waiting">{work.waiting} aguardando outras pessoas</p>}
        {project.tags.length > 0 && <div className="project-card-tags">{project.tags.slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}{project.tags.length > 3 && <span>+{project.tags.length - 3}</span>}</div>}
        {project.links.length > 0 && <div className="project-card-links">{project.links.slice(0, 2).map(link => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" />{link.label}</a>)}</div>}
      </div>
    </article>;
  }

  return (
    <motion.div
      className="work-page work-projects p-4 lg:p-8"
      variants={stagger}
      initial="initial"
      animate="animate"
    >
      <header className="today-head">
        <h1 className="font-display">Projetos</h1>
        {stalled.length > 0 && <button type="button" className="today-inbox today-review" onClick={() => { setActiveStage('active'); }}>{stalled.length} sem próxima ação</button>}
        <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setStageDialogOpen(true)} title="Editar etapas" aria-label="Editar etapas">
          <Edit2 className="h-4 w-4" />
        </Button>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Projeto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Novo Projeto</DialogTitle>
                <DialogDescription>Crie um novo projeto para acompanhar seu progresso.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Nome</Label>
                  <Input value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} placeholder="Nome do projeto" />
                </div>
                <div className="grid gap-2">
                  <Label>Descrição</Label>
                  <Textarea value={newProject.description} onChange={(e) => setNewProject({ ...newProject, description: e.target.value })} placeholder="Descrição do projeto" rows={3} />
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={newProject.status} onValueChange={(value) => setNewProject({ ...newProject, status: value as Project['status'] })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger>
                    <SelectContent>
                      {stages.map(s => <SelectItem key={s.id} value={s.id}>{getStatusLabel(s.id)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={!newProject.name.trim()}>Criar Projeto</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </header>
      <div className="work-project-controls">
        <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar projetos" placeholder="Encontre um projeto…" value={search} onChange={event => setSearch(event.target.value)} className="h-11 pl-10" /></div>
        <div className="work-view-switch" aria-label="Visualização de projetos"><Button variant={viewMode === 'gallery' ? 'secondary' : 'ghost'} aria-pressed={viewMode === 'gallery'} onClick={() => setViewMode('gallery')}><LayoutGrid className="mr-2 h-4 w-4" />Galeria</Button><Button variant={viewMode === 'board' ? 'secondary' : 'ghost'} aria-pressed={viewMode === 'board'} onClick={() => setViewMode('board')}><Layers className="mr-2 h-4 w-4" />Quadro</Button></div>
      </div>
      <nav aria-label="Etapas dos projetos" className="work-stage-tabs"><button aria-pressed={activeStage === 'all'} onClick={() => setActiveStage('all')}>Todos <span>{projects.length}</span></button>{stages.map(stage => <button key={stage.id} aria-label={stage.label} aria-pressed={activeStage === stage.id} onClick={() => setActiveStage(stage.id)}><i className={stage.dot} />{stage.label}<span>{projects.filter(project => project.status === stage.id).length}</span></button>)}</nav>

      {isLoading ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map(index => <Skeleton key={index} className="h-80 rounded-2xl" />)}</div> : viewMode === 'gallery' ? <motion.div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3" variants={stagger}>{visibleProjects.map(project => projectCard(project))}</motion.div> : <div className="work-board">{stages.map(stage => <section key={stage.id} className="work-board-column" onDragOver={handleDragOver} onDrop={event => handleDrop(event, stage.id)}><div className="mb-4 flex items-center gap-2"><span className={cn('h-2 w-2 rounded-full', stage.dot)} /><h2 className="text-sm font-semibold">{stage.label}</h2><Badge variant="secondary" className="ml-auto">{visibleProjects.filter(project => project.status === stage.id).length}</Badge></div><div className="work-board-lane space-y-4">{visibleProjects.filter(project => project.status === stage.id).map(project => projectCard(project))}</div></section>)}</div>}
      {!isLoading && visibleProjects.length === 0 && <div className="work-empty"><FolderKanban className="h-7 w-7 text-primary" /><p>Nenhum projeto nesta seleção</p><span>Experimente outra busca ou escolha uma etapa diferente.</span><Button variant="outline" onClick={() => { setSearch(''); setActiveStage('all'); }}>Limpar filtros</Button></div>}

      {/* Edit Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Projeto</DialogTitle>
            <DialogDescription>Altere as informações do projeto</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Cover Image */}
            <div className="grid gap-2">
              <Label>Imagem de Capa</Label>
              <div className="relative h-32 rounded-lg overflow-hidden border border-border">
                {editCoverUrl ? (
                  <div className="relative w-full h-full">
                    <Image src={editCoverUrl} alt="" fill unoptimized sizes="(max-width: 768px) 100vw, 512px" className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
                    <button
                      type="button"
                      onClick={() => setEditCoverUrl('')}
                      className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/80 flex items-center justify-center hover:bg-background"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-muted/30 transition-colors">
                    <Plus className="h-6 w-6 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground">Adicionar capa</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) {
                          toast.error('Imagem muito grande. Máximo 2MB.');
                          return;
                        }
                        const formData = new FormData();
                        formData.append('file', file);
                        try {
                          const res = await fetch('/api/upload', { method: 'POST', body: formData });
                          const data = await res.json();
                          if (data.url) {
                            setEditCoverUrl(data.url);
                            toast.success('Capa adicionada!');
                          } else {
                            toast.error(data.error || 'Falha no upload');
                          }
                        } catch {
                          toast.error('Erro ao enviar imagem');
                        }
                      }}
                    />
                  </label>
                )}
              </div>
              {/* Cover Color Picker */}
              <div className="flex gap-1.5 mt-1">
                {[
                  'from-primary/20 to-primary/5',
                  'from-blue-500/20 to-blue-500/5',
                  'from-green-500/20 to-green-500/5',
                  'from-orange-500/20 to-orange-500/5',
                  'from-purple-500/20 to-purple-500/5',
                  'from-pink-500/20 to-pink-500/5',
                  'from-yellow-500/20 to-yellow-500/5',
                  'from-cyan-500/20 to-cyan-500/5',
                ].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => { setEditCoverColor(color); setEditCoverUrl(''); }}
                    className={cn(
                      'w-6 h-6 rounded-full bg-gradient-to-br border transition-all',
                      color,
                      editCoverColor === color && !editCoverUrl ? 'border-primary ring-2 ring-primary/30 scale-110' : 'border-border/50 hover:scale-105'
                    )}
                  />
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome do projeto" />
            </div>
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Descrição do projeto" rows={3} />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as Project['status'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stages.map(s => <SelectItem key={s.id} value={s.id}>{getStatusLabel(s.id)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {editTags.map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={editTagsInput} onChange={(e) => setEditTagsInput(e.target.value)} placeholder="Ex: urgente"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} />
                <Button type="button" variant="outline" size="sm" onClick={addTag}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Links</Label>
              <div className="space-y-2 mb-2">
                {editLinks.map((link, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <LinkIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-sm flex-1 truncate">{link.label}: {link.url}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeLink(i)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={editLinkLabel} onChange={(e) => setEditLinkLabel(e.target.value)} placeholder="Label" className="w-1/3" />
                <Input value={editLinkUrl} onChange={(e) => setEditLinkUrl(e.target.value)} placeholder="URL" className="flex-1" />
                <Button type="button" variant="outline" size="sm" onClick={addLink}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            {editingProject && (
              <div className="grid gap-2">
                <Label>Vínculos</Label>
                <LinkedItemsPanel
                  readOnly
                  linkableTypes={[]}
                  linkedIds={{}}
                  onChange={() => {}}
                  backlinks={getProjectBacklinks(editingProject.id)}
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            {editingProject && (
              <Button variant="destructive" onClick={() => handleDeleteProject(editingProject.id)}>
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={!editName.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StageConfigDialog
        open={stageDialogOpen}
        onOpenChange={setStageDialogOpen}
        scope="projects"
        countUsage={(stageId) => projects.filter(p => p.status === stageId).length}
        onSaved={setStages}
      />
    </motion.div>
  );
}
