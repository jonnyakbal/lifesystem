'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Trash2, FileText, Link as LinkIcon, Image, Mic, Inbox as InboxIcon,
  Search, X, ChevronLeft, Sparkles, BookOpen, Briefcase, Home, GraduationCap,
  Tag, MoreHorizontal, Copy, Archive, PanelRight, Square, Maximize2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import { NotionEditor } from '@/components/notion-editor';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface Capture {
  id: string;
  content: string;
  type: 'text' | 'link' | 'image' | 'audio';
  category?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

const CATEGORIES = [
  { id: 'all', label: 'Todos', icon: InboxIcon },
  { id: 'estudos', label: 'Estudos', icon: GraduationCap, color: '#8b5cf6' },
  { id: 'work', label: 'Work notes', icon: Briefcase, color: '#3b82f6' },
  { id: 'home', label: 'Home notes', icon: Home, color: '#22c55e' },
  { id: 'ideias', label: 'Ideias', icon: Sparkles, color: '#f59e0b' },
  { id: 'projetos', label: 'Projetos', icon: BookOpen, color: '#ef4444' },
];

const COVER_COLORS = [
  'from-purple-500/30 to-blue-500/10',
  'from-blue-500/30 to-cyan-500/10',
  'from-green-500/30 to-emerald-500/10',
  'from-orange-500/30 to-red-500/10',
  'from-pink-500/30 to-rose-500/10',
  'from-yellow-500/30 to-amber-500/10',
  'from-teal-500/30 to-green-500/10',
  'from-indigo-500/30 to-purple-500/10',
];

function getCoverColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) { hash = ((hash << 5) - hash) + id.charCodeAt(i); hash |= 0; }
  return COVER_COLORS[Math.abs(hash) % COVER_COLORS.length];
}

function getTitle(content: string): string {
  const text = content.replace(/<[^>]*>/g, '').trim();
  const firstLine = text.split('\n')[0].slice(0, 60);
  return firstLine || 'Nova página';
}

function stripLeadingTitle(content: string): string {
  // handleSaveEditor() re-prepends `<h2>${editorTitle}</h2>` on every save.
  // If we don't strip the previous one here, editing a capture repeatedly
  // duplicates the title heading on each save.
  return content.replace(/^\s*<h2>[\s\S]*?<\/h2>\s*\n?/, '');
}

function getPreview(content: string): string {
  const text = content.replace(/<[^>]*>/g, '').trim();
  const lines = text.split('\n').slice(1, 4);
  return lines.join(' ').slice(0, 120);
}

const fade = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };
const stagger = { animate: { transition: { staggerChildren: 0.04, delayChildren: 0.04 } } };

type ViewMode = 'gallery' | 'list';

// How the capture editor opens — a per-user preference, persisted so the
// last choice becomes the default next time (not just for this session).
type EditorLayout = 'corner' | 'center' | 'fullscreen';
const EDITOR_LAYOUT_KEY = 'lifesystem-capture-editor-layout';

const LAYOUT_OPTIONS: { id: EditorLayout; label: string; icon: typeof PanelRight }[] = [
  { id: 'corner', label: 'Canto', icon: PanelRight },
  { id: 'center', label: 'Centralizado', icon: Square },
  { id: 'fullscreen', label: 'Tela cheia', icon: Maximize2 },
];

const LAYOUT_CONFIG: Record<EditorLayout, {
  panelClassName: string;
  motionProps: { initial: Record<string, any>; animate: Record<string, any>; exit: Record<string, any> };
}> = {
  corner: {
    panelClassName: 'fixed right-0 top-0 z-[101] h-screen w-full max-w-3xl bg-background border-l border-border flex flex-col',
    motionProps: {
      initial: { x: '100%', opacity: 0 },
      animate: { x: 0, opacity: 1 },
      exit: { x: '100%', opacity: 0 },
    },
  },
  center: {
    panelClassName: 'fixed left-1/2 top-1/2 z-[101] h-[85vh] w-full max-w-3xl bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden',
    motionProps: {
      // x/y (not Tailwind's translate classes) so Framer Motion's own
      // transform composition doesn't clobber the centering offset.
      initial: { x: '-50%', y: '-50%', opacity: 0, scale: 0.96 },
      animate: { x: '-50%', y: '-50%', opacity: 1, scale: 1 },
      exit: { x: '-50%', y: '-50%', opacity: 0, scale: 0.96 },
    },
  },
  fullscreen: {
    panelClassName: 'fixed inset-0 z-[101] bg-background flex flex-col',
    motionProps: {
      initial: { opacity: 0, scale: 0.98 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.98 },
    },
  },
};

export default function InboxPage() {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('gallery');

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorLayout, setEditorLayoutState] = useState<EditorLayout>('corner');
  const [editingCapture, setEditingCapture] = useState<Capture | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorCategory, setEditorCategory] = useState('ideias');
  const [editorCoverUrl, setEditorCoverUrl] = useState('');
  const [newCaptureTitle, setNewCaptureTitle] = useState('');
  // Guards the backdrop's close-on-click against the same click gesture that
  // opened the panel: a fast click can dispatch mousedown/mouseup far enough
  // apart that React mounts the full-viewport backdrop under the cursor
  // between them, so mouseup lands on the backdrop and closes the panel
  // it just opened.
  const editorOpenedAtRef = useRef(0);

  useEffect(() => { loadCaptures(); }, []);

  useEffect(() => {
    const stored = localStorage.getItem(EDITOR_LAYOUT_KEY) as EditorLayout | null;
    if (stored && LAYOUT_CONFIG[stored]) setEditorLayoutState(stored);
  }, []);

  function setEditorLayout(mode: EditorLayout) {
    setEditorLayoutState(mode);
    localStorage.setItem(EDITOR_LAYOUT_KEY, mode);
  }

  async function loadCaptures() {
    try {
      const data = await apiFetch<Capture[]>('/api/captures');
      setCaptures(data);
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateQuick() {
    if (!newCaptureTitle.trim()) return;
    try {
      await apiFetch('/api/captures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newCaptureTitle, type: 'text', category: editorCategory }),
      });
      setNewCaptureTitle('');
      loadCaptures();
      toast.success('Captura criada!');
    } catch (err) {
      toast.error(showError(err));
    }
  }

  function openCreateNew() {
    setEditingCapture(null);
    setEditorTitle('');
    setEditorContent('');
    setEditorCategory('ideias');
    setEditorCoverUrl('');
    editorOpenedAtRef.current = Date.now();
    setEditorOpen(true);
  }

  function openEdit(capture: Capture) {
    setEditingCapture(capture);
    setEditorTitle(getTitle(capture.content));
    setEditorContent(stripLeadingTitle(capture.content));
    setEditorCategory(capture.category || 'ideias');
    setEditorCoverUrl((capture as any).coverUrl || '');
    editorOpenedAtRef.current = Date.now();
    setEditorOpen(true);
  }

  function closeEditorFromBackdrop() {
    if (Date.now() - editorOpenedAtRef.current < 250) return;
    setEditorOpen(false);
  }

  async function handleSaveEditor() {
    const fullContent = editorTitle
      ? `<h2>${editorTitle}</h2>\n${editorContent}`
      : editorContent;

    try {
      if (editingCapture) {
        await apiFetch(`/api/captures/${editingCapture.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: fullContent, category: editorCategory, coverUrl: editorCoverUrl }),
        });
        toast.success('Captura atualizada!');
      } else {
        await apiFetch('/api/captures', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: fullContent, type: 'text', category: editorCategory, coverUrl: editorCoverUrl }),
        });
        toast.success('Captura criada!');
      }
      setEditorOpen(false);
      loadCaptures();
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function handleDelete(id: string) {
    try {
      const capture = captures.find(c => c.id === id);
      await apiFetch(`/api/captures/${id}`, { method: 'DELETE' });
      loadCaptures();
      toast('Captura excluída', {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            if (capture) {
              try {
                await apiFetch('/api/captures', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ content: capture.content, type: capture.type, category: capture.category }),
                });
                loadCaptures();
                toast.success('Restaurada!');
              } catch (err) { toast.error(showError(err)); }
            }
          },
        },
      });
    } catch (err) { toast.error(showError(err)); }
  }

  async function handleDuplicate(capture: Capture) {
    try {
      await apiFetch('/api/captures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: capture.content + ' (cópia)', type: capture.type, category: capture.category }),
      });
      loadCaptures();
      toast.success('Duplicada!');
    } catch (err) { toast.error(showError(err)); }
  }

  const filtered = useMemo(() => {
    return captures.filter(c => {
      if (activeCategory !== 'all' && c.category !== activeCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        return c.content.toLowerCase().includes(q);
      }
      return true;
    });
  }, [captures, activeCategory, search]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: captures.length };
    captures.forEach(c => {
      const cat = c.category || 'ideias';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [captures]);

  return (
    <motion.div className="p-4 lg:p-8" variants={stagger} initial="initial" animate="animate">
      {/* Header */}
      <motion.div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between" variants={fade}>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-3">
            <span className="text-2xl">✏️</span> Capture | Escritos
          </h1>
          <p className="text-muted-foreground">Seu segundo cérebro — capture qualquer ideia</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 lg:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar capturas..." className="pl-9 h-9" />
          </div>
          <div className="flex items-center gap-0.5 rounded-lg border bg-muted/30 p-0.5">
            <Button variant={view === 'gallery' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2 text-xs" onClick={() => setView('gallery')}>
              <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" /><rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" /></svg>
            </Button>
            <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2 text-xs" onClick={() => setView('list')}>
              <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="2.5" rx="1" /><rect x="1" y="6.75" width="14" height="2.5" rx="1" /><rect x="1" y="11.5" width="14" height="2.5" rx="1" /></svg>
            </Button>
          </div>
          <Button size="sm" onClick={openCreateNew} className="gap-1.5">
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>
      </motion.div>

      {/* Category Tabs */}
      <motion.div className="flex flex-wrap gap-1.5 mb-6" variants={fade}>
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all border',
                isActive
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'border-border/50 text-muted-foreground hover:bg-muted/50'
              )}
            >
              <Icon className="h-3.5 w-3.5" style={cat.color ? { color: cat.color } : undefined} />
              {cat.label}
              <Badge variant="secondary" className="text-xs px-1.5 py-0 ml-0.5">
                {categoryCounts[cat.id] || 0}
              </Badge>
            </button>
          );
        })}
      </motion.div>

      {/* Content */}
      {isLoading ? (
        <div className={cn(view === 'gallery' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'space-y-2')}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              {view === 'gallery' && <Skeleton className="h-24 w-full rounded-t-xl" />}
              <CardContent className="p-4">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-full mb-1" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <motion.div
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50"
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <InboxIcon className="h-8 w-8 text-muted-foreground" />
            </motion.div>
            <p className="mt-4 text-lg font-medium">Nenhuma captura ainda</p>
            <p className="text-sm text-muted-foreground mb-4">Comece a capturar ideias, pensamentos e referências</p>
            <Button onClick={openCreateNew} className="gap-1.5">
              <Plus className="h-4 w-4" /> Criar Primeira Captura
            </Button>
          </CardContent>
        </Card>
      ) : view === 'gallery' ? (
        /* Gallery View */
        <motion.div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" variants={stagger}>
          <AnimatePresence>
            {/* New Page Card */}
            <motion.div variants={fade} layout>
              <Card
                className="group cursor-pointer border-dashed border-2 hover:border-primary/50 hover:bg-muted/30 transition-all min-h-[200px] flex items-center justify-center"
                onClick={openCreateNew}
              >
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Plus className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">New page</span>
                </CardContent>
              </Card>
            </motion.div>

            {filtered.map(capture => {
              const title = getTitle(capture.content);
              const preview = getPreview(capture.content);
              const coverClass = getCoverColor(capture.id);
              const cat = CATEGORIES.find(c => c.id === (capture.category || 'ideias'));

              return (
                <motion.div key={capture.id} variants={fade} layout exit={{ opacity: 0, scale: 0.95 }}>
                  <Card
                    className="group cursor-pointer hover:shadow-lg hover:shadow-primary/5 hover:border-primary/50 transition-all overflow-hidden min-h-[200px]"
                    onClick={() => openEdit(capture)}
                  >
                    {/* Cover */}
                    <div className={cn('h-24 w-full bg-gradient-to-br relative', coverClass)}>
                      {(capture as any).coverUrl ? (
                        <img
                          src={(capture as any).coverUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center opacity-20">
                          {cat?.icon && <cat.icon className="h-12 w-12" style={{ color: cat?.color }} />}
                        </div>
                      )}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur-sm" onClick={e => e.stopPropagation()}>
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => handleDuplicate(capture)}>
                              <Copy className="mr-2 h-4 w-4" /> Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(capture.id)} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <CardContent className="p-4">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {cat && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0 gap-1" style={{ borderColor: cat.color + '40', color: cat.color }}>
                            {cat.label}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-medium text-sm leading-snug line-clamp-2 mb-1">{title}</h3>
                      {preview && (
                        <p className="text-xs text-muted-foreground line-clamp-3">{preview}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(capture.createdAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      ) : (
        /* List View */
        <motion.div className="space-y-1" variants={stagger}>
          <AnimatePresence>
            {filtered.map(capture => {
              const title = getTitle(capture.content);
              const cat = CATEGORIES.find(c => c.id === (capture.category || 'ideias'));
              return (
                <motion.div key={capture.id} variants={fade} layout exit={{ opacity: 0, x: -20 }}>
                  <Card
                    className="group cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => openEdit(capture)}
                  >
                    <CardContent className="flex items-center gap-3 p-3">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br shrink-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${cat?.color || '#64748b'}30, ${cat?.color || '#64748b'}10)` }}>
                        {cat?.icon ? <cat.icon className="h-4 w-4" style={{ color: cat.color }} /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{title}</p>
                        <p className="text-xs text-muted-foreground">
                          {cat?.label} · {new Date(capture.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={e => e.stopPropagation()}>
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => handleDuplicate(capture)}>
                            <Copy className="mr-2 h-4 w-4" /> Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(capture.id)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Full-Page Editor — portaled to <body> so `fixed` positioning is relative to the
          real viewport, not the ReactLenis smooth-scroll wrapper's transformed box */}
      {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {editorOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm"
              onClick={closeEditorFromBackdrop}
            />
            <motion.div
              key={editorLayout}
              {...LAYOUT_CONFIG[editorLayout].motionProps}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className={LAYOUT_CONFIG[editorLayout].panelClassName}
            >
              {/* Editor Header */}
              <div className="flex flex-wrap items-center justify-between gap-y-2 px-4 py-3 border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditorOpen(false)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {editingCapture ? 'Editando' : 'Nova captura'}
                  </span>
                  <div className="flex items-center gap-0.5 rounded-lg border border-border/60 p-0.5 ml-1">
                    {LAYOUT_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        title={opt.label}
                        onClick={() => setEditorLayout(opt.id)}
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded transition-colors',
                          editorLayout === opt.id
                            ? 'bg-primary/20 text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <opt.icon className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {CATEGORIES.filter(c => c.id !== 'all').map(cat => {
                      const Icon = cat.icon;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setEditorCategory(cat.id)}
                          className={cn(
                            'flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-all border',
                            editorCategory === cat.id
                              ? 'border-current shadow-sm'
                              : 'border-transparent text-muted-foreground hover:bg-muted/50'
                          )}
                          style={editorCategory === cat.id ? { color: cat.color, borderColor: cat.color, backgroundColor: cat.color + '15' } : undefined}
                        >
                          <Icon className="h-3 w-3" />
                          <span className="hidden sm:inline">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <Button size="sm" onClick={handleSaveEditor} disabled={!editorContent.trim()} className="gap-1.5 shrink-0">
                    <Sparkles className="h-3.5 w-3.5" /> Salvar
                  </Button>
                </div>
              </div>

              {/* Editor Body */}
              <div className="flex-1 overflow-y-auto">
                {/* Cover Image */}
                <div className="relative h-40 bg-gradient-to-br from-muted/30 to-muted/10">
                  {(editingCapture as any)?.coverUrl || editorCoverUrl ? (
                    <div className="relative w-full h-full">
                      <img 
                        src={editorCoverUrl || (editingCapture as any)?.coverUrl} 
                        alt="" 
                        className="w-full h-full object-cover" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
                      <button
                        type="button"
                        onClick={() => setEditorCoverUrl('')}
                        className="absolute top-3 right-3 h-7 w-7 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-muted/10 transition-colors">
                      <Plus className="h-5 w-5 text-muted-foreground mb-1" />
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
                              setEditorCoverUrl(data.url);
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
                <div className="p-8 max-w-2xl mx-auto">
                  <input
                    value={editorTitle}
                    onChange={e => setEditorTitle(e.target.value)}
                    placeholder="Sem título"
                    className="w-full text-3xl font-bold bg-transparent outline-none placeholder:text-muted-foreground/40 mb-6"
                    autoFocus
                  />
                  <NotionEditor
                    content={editorContent}
                    onChange={setEditorContent}
                    placeholder="Comece a escrever..."
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>,
      document.body
      )}
    </motion.div>
  );
}
