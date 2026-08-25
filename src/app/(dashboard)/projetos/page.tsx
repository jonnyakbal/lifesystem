'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, FolderKanban, ExternalLink, MoreHorizontal, Trash2, GripVertical, X, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import { LinkedItemsPanel } from '@/components/linked-items-panel';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'development' | 'paused' | 'idea';
  stack: string[];
  links: { label: string; url: string }[];
}

const statusConfig = {
  active: { label: 'Ativo', color: 'text-money', dotColor: 'bg-money' },
  development: { label: 'Desenvolvimento', color: 'text-primary', dotColor: 'bg-primary' },
  paused: { label: 'Parado', color: 'text-critical', dotColor: 'bg-critical' },
  idea: { label: 'Ideia', color: 'text-muted-foreground', dotColor: 'bg-muted-foreground' },
};

const columns = ['idea', 'development', 'active', 'paused'] as const;

const fade = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};

export default function ProjectsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [linkedContent, setLinkedContent] = useState<any[]>([]);
  const [linkedCaptures, setLinkedCaptures] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', status: 'idea' as Project['status'] });
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<Project['status']>('idea');
  const [editStack, setEditStack] = useState<string[]>([]);
  const [editStackInput, setEditStackInput] = useState('');
  const [editLinks, setEditLinks] = useState<{ label: string; url: string }[]>([]);
  const [editLinkLabel, setEditLinkLabel] = useState('');
  const [editLinkUrl, setEditLinkUrl] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [editCoverColor, setEditCoverColor] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const dragClickRef = useRef(false);

  useEffect(() => {
    loadProjects();
    fetch('/api/content').then(r => r.json()).then(setLinkedContent).catch(() => {});
    fetch('/api/captures').then(r => r.json()).then(setLinkedCaptures).catch(() => {});
  }, []);

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
      .filter((c: any) => (c.linkedProjectIds || []).includes(projectId))
      .map((c: any) => ({ id: c.id, type: 'content' as const, title: c.title || 'Sem título' }));
    const fromCaptures = linkedCaptures
      .filter((c: any) => c.targetType === 'project' && c.targetId === projectId)
      .map((c: any) => ({ id: c.id, type: 'capture' as const, title: (c.title || (c.content as string)?.replace(/<[^>]*>/g, '').slice(0, 60)) || 'Sem título' }));
    return [...fromContent, ...fromCaptures];
  }

  async function loadProjects() {
    try {
      const data = await apiFetch<Project[]>('/api/projects');
      setProjects(data);
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
    setEditStack([...project.stack]);
    setEditLinks([...project.links]);
    setEditCoverUrl((project as any).coverUrl || '');
    setEditCoverColor((project as any).coverColor || '');
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
          stack: editStack, 
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

  function addStackTag() {
    const tag = editStackInput.trim();
    if (tag && !editStack.includes(tag)) {
      setEditStack([...editStack, tag]);
      setEditStackInput('');
    }
  }

  function removeStackTag(tag: string) {
    setEditStack(editStack.filter(t => t !== tag));
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

  return (
    <motion.div
      className="p-8"
      variants={stagger}
      initial="initial"
      animate="animate"
    >
      <motion.div className="mb-8 flex items-center justify-between" variants={fade}>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Projetos</h1>
          <p className="text-muted-foreground">{projects.length} projetos no sistema</p>
        </div>
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
                      <SelectItem value="idea">Ideia</SelectItem>
                      <SelectItem value="development">Desenvolvimento</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="paused">Parado</SelectItem>
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
      </motion.div>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="mb-4 flex items-center gap-2">
                <Skeleton className="h-2 w-2 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, j) => (
                  <Card key={j}><CardContent className="p-4"><Skeleton className="h-4 w-3/4 mb-2" /><Skeleton className="h-3 w-full" /></CardContent></Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <motion.div className="grid gap-4 lg:grid-cols-4" variants={stagger}>
          {columns.map((status) => {
            const columnProjects = projects.filter(p => p.status === status);
            const config = statusConfig[status];
            return (
              <motion.div
                key={status}
                variants={fade}
                className="rounded-lg border border-border bg-muted/30 p-4"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, status)}
              >
                <div className="mb-4 flex items-center gap-2">
                  <div className={cn('h-2 w-2 rounded-full', config.dotColor)} />
                  <h3 className="font-medium text-sm">{config.label}</h3>
                  <Badge variant="secondary" className="ml-auto">{columnProjects.length}</Badge>
                </div>
                <div className="space-y-3 min-h-[100px]">
                  <AnimatePresence>
                    {columnProjects.map((project) => (
                       <motion.div
                         key={project.id}
                         initial={{ opacity: 0, scale: 0.95 }}
                         animate={{ opacity: 1, scale: 1 }}
                         exit={{ opacity: 0, scale: 0.95 }}
                         transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                       >
                        <Card
                           draggable
                           onDragStart={(e) => handleDragStart(e, project.id)}
                           onDragEnd={handleDragEnd}
                           className={cn(
                             'group cursor-grab transition-all hover:border-primary/50 hover:shadow-md hover:shadow-primary/5 active:cursor-grabbing overflow-hidden project-card',
                             draggedId === project.id && 'opacity-50 scale-95'
                           )}
                           onClick={() => {
                             if (dragClickRef.current) {
                               dragClickRef.current = false;
                               return;
                             }
                             openEdit(project);
                           }}
                         >
                          {/* Cover Image */}
                          {(project as any).coverUrl ? (
                            <div className="relative h-28 overflow-hidden">
                              <img
                                src={(project as any).coverUrl}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                            </div>
                          ) : (
                            <div className={cn(
                              'h-28 bg-gradient-to-br',
                              (project as any).coverColor || 'from-primary/20 to-primary/5'
                            )} />
                          )}
                          <CardContent className="p-4 -mt-6 relative">
                            <div className="flex items-start justify-between">
                              <h4 className="font-medium">{project.name}</h4>
                              <GripVertical className="h-4 w-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 shrink-0" />
                            </div>
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
                            {project.stack.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1">
                                {project.stack.slice(0, 3).map((tech) => (
                                  <Badge key={tech} variant="outline" className="text-xs">{tech}</Badge>
                                ))}
                                {project.stack.length > 3 && (
                                  <Badge variant="secondary" className="text-xs">+{project.stack.length - 3}</Badge>
                                )}
                              </div>
                            )}
                            {project.links.length > 0 && (
                              <div className="mt-3 flex gap-2">
                                {project.links.slice(0, 2).map((link) => (
                                  <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="h-3 w-3" /> {link.label}
                                  </a>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

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
                    <img src={editCoverUrl} alt="" className="w-full h-full object-cover" />
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
                  <SelectItem value="idea">Ideia</SelectItem>
                  <SelectItem value="development">Desenvolvimento</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="paused">Parado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Stack / Tecnologias</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {editStack.map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button onClick={() => removeStackTag(tag)} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={editStackInput} onChange={(e) => setEditStackInput(e.target.value)} placeholder="Ex: Next.js"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addStackTag())} />
                <Button type="button" variant="outline" size="sm" onClick={addStackTag}><Plus className="h-4 w-4" /></Button>
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
    </motion.div>
  );
}
