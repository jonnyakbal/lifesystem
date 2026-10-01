'use client';

// The deep, permanent knowledge hub — split out from /inbox (which stays
// the fast, transient triage queue). Anything opened and edited here counts
// as "processed": autoSave promotes status 'inbox' -> 'noted' the moment it
// saves, no separate "turn into a note" button, per how Jonny wants this to
// work. Categories are backed by WikiCollection (src/types/index.ts) — a
// full CRUD entity + API that already existed in the codebase and was never
// wired into a real page until now.
import { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import NextLink from 'next/link';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence, type MotionProps } from 'motion/react';
import {
  Plus, Trash2, FileText, Search, X, ChevronLeft, PanelRight, Square, Maximize2,
  ArrowRight, Check, Settings2, NotebookText,
  MoreHorizontal, Copy, Type, Inbox, Rss, Network, LayoutGrid, List,
} from 'lucide-react';
import { cn, escapeHtml } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import { CaptureConversionDialog } from '@/components/capture-conversion-dialog';
import { NotionEditor } from '@/components/notion-editor';
import { LinkedItemsPanel } from '@/components/linked-items-panel';
import { CategoryEditorDialog, type WikiCollectionItem } from '@/components/category-editor-dialog';
import { WorkspaceHeading, WorkspaceMetric } from '@/components/workspace/workspace-heading';
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
  targetType?: 'task' | 'project';
  targetId?: string;
  linkedCaptureIds?: string[];
  coverUrl?: string;
}

interface NoteDraft {
  title: string;
  content: string;
  category: string;
  coverUrl: string;
  linkedCaptureIds: string[];
}

interface NoteEditorSession {
  token: number;
  captureId: string | null;
  captureStatus: string;
  latestDraft: NoteDraft;
  savedDraftKey: string | null;
  saving: boolean;
  queued: boolean;
}

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

const TITLE_ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#039;': "'" };

function getCoverColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) { hash = ((hash << 5) - hash) + id.charCodeAt(i); hash |= 0; }
  return COVER_COLORS[Math.abs(hash) % COVER_COLORS.length];
}

function getTitle(content: string): string {
  const heading = content.match(/^\s*<h2(?:\s[^>]*)?>([\s\S]*?)<\/h2>/i)?.[1];
  const text = (heading ?? content.replace(/<\/(?:p|div|h[1-6])>/gi, '\n')).replace(/<[^>]*>/g, '').trim();
  const firstLine = text.split('\n')[0].replace(/&(amp|lt|gt|quot|#039);/g, entity => TITLE_ENTITIES[entity] ?? entity);
  return firstLine || 'Nova página';
}

function stripLeadingTitle(content: string): string {
  return content.replace(/^\s*<h2(?:\s[^>]*)?>[\s\S]*?<\/h2>\s*\n?/i, '');
}

function getPreview(content: string): string {
  return stripLeadingTitle(content).replace(/<\/(?:p|div|li|h[1-6])>|<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

const fade = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };
const stagger = { animate: { transition: { staggerChildren: 0.04, delayChildren: 0.04 } } };

type ViewMode = 'gallery' | 'list';
type EditorLayout = 'corner' | 'center' | 'fullscreen';
const EDITOR_LAYOUT_KEY = 'lifesystem-notas-editor-layout';

// Same 3-way choice Notion gives you for reading/writing a page — reuses
// the three font families already loaded site-wide (src/app/layout.tsx)
// instead of pulling in new ones just for this.
type NoteFont = 'sans' | 'serif' | 'mono';
const NOTE_FONT_KEY = 'lifesystem-notas-font';
const NOTE_FONT_OPTIONS: { id: NoteFont; label: string; family: string }[] = [
  { id: 'sans', label: 'Padrão', family: 'var(--font-sans)' },
  { id: 'serif', label: 'Serif', family: 'var(--font-display)' },
  { id: 'mono', label: 'Mono', family: 'var(--font-mono)' },
];

const LAYOUT_OPTIONS: { id: EditorLayout; label: string; icon: typeof PanelRight }[] = [
  { id: 'corner', label: 'Canto', icon: PanelRight },
  { id: 'center', label: 'Centralizado', icon: Square },
  { id: 'fullscreen', label: 'Tela cheia', icon: Maximize2 },
];

const LAYOUT_CONFIG: Record<EditorLayout, {
  panelClassName: string;
  motionProps: Pick<MotionProps, 'initial' | 'animate' | 'exit'>;
}> = {
  corner: {
    panelClassName: 'fixed right-0 top-0 z-[101] h-dvh w-full max-w-3xl bg-background border-l border-border shadow-2xl flex flex-col',
    motionProps: { initial: { x: '100%', opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: '100%', opacity: 0 } },
  },
  center: {
    panelClassName: 'fixed left-1/2 top-1/2 z-[101] h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden',
    motionProps: {
      initial: { x: '-50%', y: '-50%', opacity: 0, scale: 0.96 },
      animate: { x: '-50%', y: '-50%', opacity: 1, scale: 1 },
      exit: { x: '-50%', y: '-50%', opacity: 0, scale: 0.96 },
    },
  },
  fullscreen: {
    panelClassName: 'fixed inset-0 z-[101] bg-background flex flex-col',
    motionProps: { initial: { opacity: 0, scale: 0.98 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.98 } },
  },
};

export default function NotasPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [converting, setConverting] = useState<Capture | null>(null);
  const [categories, setCategories] = useState<WikiCollectionItem[]>([]);
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('gallery');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorLayout, setEditorLayoutState] = useState<EditorLayout>('corner');
  const [noteFont, setNoteFontState] = useState<NoteFont>('sans');
  const [editingCapture, setEditingCapture] = useState<Capture | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorLinkedCaptureIds, setEditorLinkedCaptureIds] = useState<string[]>([]);
  const [editorCategory, setEditorCategory] = useState('ideias');
  const [editorCoverUrl, setEditorCoverUrl] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const editorOpenedAtRef = useRef(0);
  const skipNextAutosaveRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorSessionRef = useRef<NoteEditorSession | null>(null);
  const editorSessionSequenceRef = useRef(0);
  const autosaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => { loadCaptures(); loadCategories(); }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(EDITOR_LAYOUT_KEY) as EditorLayout | null;
      const storedFont = localStorage.getItem(NOTE_FONT_KEY) as NoteFont | null;
      queueMicrotask(() => {
        if (stored && LAYOUT_CONFIG[stored]) setEditorLayoutState(stored);
        if (storedFont && NOTE_FONT_OPTIONS.some(f => f.id === storedFont)) setNoteFontState(storedFont);
      });
    } catch { /* Keep the default editor layout and font when storage is blocked. */ }
  }, []);

  // Deep-link support: the Inbox page (and ⌘K) send you here with
  // ?open=<id> for a specific capture — including ones still status:'inbox',
  // since opening them here is exactly what promotes them to a note.
  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId || captures.length === 0) return;
    const capture = captures.find(c => c.id === openId);
    if (capture) {
      openEdit(capture);
      router.replace('/notas');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captures, searchParams]);

  function setEditorLayout(mode: EditorLayout) {
    setEditorLayoutState(mode);
    try { localStorage.setItem(EDITOR_LAYOUT_KEY, mode); } catch { /* Keep the choice for this session. */ }
  }

  function setNoteFont(font: NoteFont) {
    setNoteFontState(font);
    try { localStorage.setItem(NOTE_FONT_KEY, font); } catch { /* Keep the choice for this session. */ }
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

  async function loadCategories() {
    try {
      const data = await apiFetch<WikiCollectionItem[]>('/api/wiki-collections');
      setCategories(data);
    } catch (err) {
      toast.error(showError(err));
    }
  }

  function openCreateNew() {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const initialDraft: NoteDraft = { title: '', content: '', category: categories[0]?.id || 'ideias', coverUrl: '', linkedCaptureIds: [] };
    beginEditorSession(null, initialDraft);
    setEditingCapture(null);
    setEditorTitle('');
    setEditorContent('');
    setEditorCategory(categories[0]?.id || 'ideias');
    setEditorCoverUrl('');
    setEditorLinkedCaptureIds([]);
    editorOpenedAtRef.current = Date.now();
    skipNextAutosaveRef.current = true;
    setSaveStatus('idle');
    setEditorOpen(true);
  }

  function openEdit(capture: Capture) {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const initialDraft: NoteDraft = { title: getTitle(capture.content), content: stripLeadingTitle(capture.content), category: capture.category || categories[0]?.id || 'ideias', coverUrl: capture.coverUrl || '', linkedCaptureIds: [...(capture.linkedCaptureIds || [])] };
    beginEditorSession(capture, initialDraft);
    setEditingCapture(capture);
    setEditorTitle(getTitle(capture.content));
    setEditorContent(stripLeadingTitle(capture.content));
    setEditorCategory(capture.category || categories[0]?.id || 'ideias');
    setEditorCoverUrl(capture.coverUrl || '');
    setEditorLinkedCaptureIds(capture.linkedCaptureIds || []);
    editorOpenedAtRef.current = Date.now();
    skipNextAutosaveRef.current = true;
    setSaveStatus('idle');
    setEditorOpen(true);
  }

  function beginEditorSession(capture: Capture | null, initialDraft: NoteDraft) {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = null;
    const previous = editorSessionRef.current;
    if (previous) void autoSave(previous);
    editorSessionRef.current = {
      token: ++editorSessionSequenceRef.current,
      captureId: capture?.id || null,
      captureStatus: capture?.status || 'noted',
      latestDraft: initialDraft,
      savedDraftKey: capture ? JSON.stringify(initialDraft) : null,
      saving: false,
      queued: false,
    };
  }

  function isCurrentSession(session: NoteEditorSession) {
    return editorSessionRef.current?.token === session.token;
  }

  function closeEditor() {
    const session = editorSessionRef.current;
    if (session) session.latestDraft = { title: editorTitle, content: editorContent, category: editorCategory, coverUrl: editorCoverUrl, linkedCaptureIds: [...editorLinkedCaptureIds] };
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    if (session) void autoSave(session);
    editorSessionRef.current = null;
    setEditorOpen(false);
    if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
    loadCaptures();
  }

  function closeEditorFromBackdrop() {
    if (Date.now() - editorOpenedAtRef.current < 250) return;
    closeEditor();
  }

  // Autosave promotes 'inbox' -> 'noted' the moment it saves — that IS the
  // "processing" step, no extra button. Never demotes an already-'organized'
  // (converted to Task/Project) capture back to 'noted'.
  async function autoSave(session = editorSessionRef.current) {
    if (!session) return;
    session.queued = true;
    if (session.saving) return;
    if ((!session.latestDraft.title.trim() && !session.latestDraft.content.trim()) || JSON.stringify(session.latestDraft) === session.savedDraftKey) {
      session.queued = false;
      return;
    }
    session.saving = true;
    if (isCurrentSession(session)) setSaveStatus('saving');
    try {
      // Reserve the whole session drain before another editor can write.
      // A reopened note must follow this session's final pending change.
      const write = autosaveQueueRef.current.then(async () => {
        while (session.queued) {
          session.queued = false;
          const draft = session.latestDraft;
          const draftKey = JSON.stringify(draft);
          if ((!draft.title.trim() && !draft.content.trim()) || draftKey === session.savedDraftKey) continue;
          const content = draft.title ? `<h2>${escapeHtml(draft.title)}</h2>\n${draft.content}` : draft.content;
          const nextStatus = session.captureStatus === 'organized' ? 'organized' : 'noted';
          if (session.captureId) {
            await apiFetch(`/api/captures/${session.captureId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content, category: draft.category, coverUrl: draft.coverUrl, linkedCaptureIds: draft.linkedCaptureIds, status: nextStatus }),
            });
          } else {
            const created = await apiFetch<Capture>('/api/captures', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content, type: 'text', category: draft.category, coverUrl: draft.coverUrl, status: nextStatus }),
            });
            session.captureId = created.id;
            if (isCurrentSession(session)) setEditingCapture(created);
          }
          session.captureStatus = nextStatus;
          session.savedDraftKey = draftKey;
        }
      });
      autosaveQueueRef.current = write.then(() => {}, () => {});
      await write;
      if (isCurrentSession(session)) setSaveStatus(JSON.stringify(session.latestDraft) === session.savedDraftKey ? 'saved' : 'idle');
      void loadCaptures();
    } catch (err) {
      session.queued = false;
      if (isCurrentSession(session)) setSaveStatus('idle');
      toast.error(showError(err));
    } finally {
      session.saving = false;
    }
  }

  useEffect(() => {
    const session = editorSessionRef.current;
    if (!editorOpen || !session) return;
    session.latestDraft = { title: editorTitle, content: editorContent, category: editorCategory, coverUrl: editorCoverUrl, linkedCaptureIds: [...editorLinkedCaptureIds] };
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => { autosaveTimerRef.current = null; void autoSave(session); }, 900);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorTitle, editorContent, editorCategory, editorCoverUrl, editorLinkedCaptureIds, editorOpen]);

  async function handleDelete(id: string) {
    try {
      const capture = captures.find(c => c.id === id);
      await apiFetch(`/api/captures/${id}`, { method: 'DELETE' });
      loadCaptures();
      toast('Nota excluída', {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            if (capture) {
              try {
                await apiFetch('/api/captures', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ content: capture.content, type: capture.type, category: capture.category, status: capture.status }),
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
        body: JSON.stringify({ content: capture.content + ' (cópia)', type: capture.type, category: capture.category, status: 'noted' }),
      });
      loadCaptures();
      toast.success('Duplicada!');
    } catch (err) { toast.error(showError(err)); }
  }



  // Inclusive on purpose: any capture that ISN'T sitting fresh in the Inbox
  // queue or converted into a Task/Project belongs here. Older captures from
  // before this 'noted' status existed (or with a legacy 'classified' value,
  // or no status field at all) would otherwise vanish from both pages — this
  // treats "not inbox, not organized" as "it's a note" rather than requiring
  // the exact string 'noted'.
  const notes = useMemo(() => captures.filter(c => c.status !== 'inbox' && c.status !== 'organized'), [captures]);

  const filtered = useMemo(() => {
    return notes.filter(c => {
      if (activeCategory !== 'all' && c.category !== activeCategory) return false;
      if (search.trim()) return c.content.toLowerCase().includes(search.trim().toLowerCase());
      return true;
    });
  }, [notes, activeCategory, search]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: notes.length };
    notes.forEach(c => {
      const cat = c.category || 'ideias';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [notes]);

  const sortedCategories = useMemo(() => [...categories].sort((a, b) => a.sortOrder - b.sortOrder), [categories]);

  function getCategory(id?: string) {
    return sortedCategories.find(c => c.id === id);
  }

  return (
    <motion.div className="work-page p-4 lg:p-8" variants={stagger} initial="initial" animate="animate">
      <CaptureConversionDialog key={converting?.id || "closed"} capture={converting} onClose={() => setConverting(null)} onConverted={loadCaptures} />
      <WorkspaceHeading eyebrow="Sua biblioteca viva" title="Notas" description="Dê espaço às ideias que merecem ficar. Reúna referências, desenvolva pensamentos e conecte o conhecimento ao que você está construindo." actions={<>
        <NextLink href="/inbox" className="work-action-link"><Inbox className="h-4 w-4" /> INBOX</NextLink>
        <Button onClick={openCreateNew} className="gap-2"><Plus className="h-4 w-4" /> Nova nota</Button>
      </>}>
        <div className="work-metrics">
          <WorkspaceMetric label="Na biblioteca" value={isLoading ? '—' : notes.length} detail="Ideias que já ganharam um lugar" tone="primary" />
          <WorkspaceMetric label="Coleções" value={sortedCategories.length} detail="Temas para encontrar o que importa" />
          <WorkspaceMetric label="Notas conectadas" value={isLoading ? '—' : notes.filter(note => note.linkedCaptureIds?.length || note.targetId).length} detail="Conhecimento que conversa entre si" />
        </div>
      </WorkspaceHeading>
      <motion.div className="work-project-controls" variants={fade}>
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input aria-label="Buscar notas" value={search} onChange={e => setSearch(e.target.value)} placeholder="Encontrar uma ideia..." className="pl-9 h-11" />
          </div>
          <div className="work-view-switch" role="group" aria-label="Visualização das notas">
            <Button aria-label="Visualização: Galeria" aria-pressed={view === 'gallery'} variant={view === 'gallery' ? 'secondary' : 'ghost'} size="sm" className="gap-1.5" onClick={() => setView('gallery')}>
              <LayoutGrid className="h-4 w-4" /><span className="hidden sm:inline">Galeria</span>
            </Button>
            <Button aria-label="Visualização: Lista" aria-pressed={view === 'list'} variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" className="gap-1.5" onClick={() => setView('list')}>
              <List className="h-4 w-4" /><span className="hidden sm:inline">Lista</span>
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCategoryEditorOpen(true)} className="min-h-11 gap-1.5">
            <Settings2 className="h-3.5 w-3.5" /> Categorias
          </Button>
          <NextLink href="/content-hub" className="ml-auto inline-flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"><Rss className="h-3.5 w-3.5" /> Fontes & Refs <ArrowRight className="h-3 w-3" /></NextLink>
      </motion.div>

      {/* Category Tabs */}
      <motion.div className="work-stage-tabs" variants={fade} aria-label="Categorias de notas">
        <button
          onClick={() => setActiveCategory('all')}
          aria-pressed={activeCategory === 'all'}
          className={cn('flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all border',
            activeCategory === 'all' ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border/50 text-muted-foreground hover:bg-muted/50')}
        >
          <NotebookText className="h-3.5 w-3.5" /> Todas
          <Badge variant="secondary" className="text-xs px-1.5 py-0 ml-0.5">{categoryCounts.all || 0}</Badge>
        </button>
        {sortedCategories.map(cat => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              aria-pressed={isActive}
              className={cn('flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all border',
                isActive ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border/50 text-muted-foreground hover:bg-muted/50')}
            >
              <span>{cat.icon}</span>
              {cat.name}
              <Badge variant="secondary" className="text-xs px-1.5 py-0 ml-0.5">{categoryCounts[cat.id] || 0}</Badge>
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
              <NotebookText className="h-8 w-8 text-muted-foreground" />
            </motion.div>
            <p className="mt-4 font-display text-2xl">{notes.length === 0 ? 'Um lugar para suas ideias' : 'Nenhuma nota encontrada'}</p>
            <p className="mb-5 mt-2 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">{notes.length === 0 ? 'Escreva uma ideia aqui ou desenvolva uma captura do INBOX. Aos poucos, sua biblioteca ganha forma.' : 'Tente outra busca ou explore todas as categorias.'}</p>
            {notes.length === 0 ? <div className="flex flex-wrap justify-center gap-2"><Button onClick={openCreateNew} className="gap-1.5"><Plus className="h-4 w-4" /> Criar primeira nota</Button><Button asChild variant="outline"><NextLink href="/inbox">Explorar INBOX <ArrowRight className="ml-2 h-4 w-4" /></NextLink></Button></div> : <Button variant="outline" onClick={() => { setSearch(''); setActiveCategory('all'); }}>Limpar filtros</Button>}
          </CardContent>
        </Card>
      ) : view === 'gallery' ? (
        <motion.div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" variants={stagger}>
          <AnimatePresence>
            <motion.div variants={fade} layout className="hidden sm:block">
              <button
                type="button"
                className="group flex min-h-[260px] w-full items-center justify-center rounded-2xl border border-dashed border-border bg-card/20 transition-colors hover:border-primary/50 hover:bg-card/60 focus-visible:outline-2 focus-visible:outline-primary"
                onClick={openCreateNew}
              >
                <span className="flex flex-col items-center justify-center py-8">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Plus className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">Nova nota</span>
                </span>
              </button>
            </motion.div>

            {filtered.map(capture => {
              const title = getTitle(capture.content);
              const preview = getPreview(capture.content);
              const coverClass = getCoverColor(capture.id);
              const cat = getCategory(capture.category);

              return (
                <motion.div key={capture.id} variants={fade} layout exit={{ opacity: 0, scale: 0.95 }}>
                  <Card
                    className="work-item-card group cursor-pointer hover:shadow-lg hover:shadow-primary/5 hover:border-primary/50 transition-all overflow-hidden min-h-[260px]"
                    onClick={() => openEdit(capture)}
                  >
                    <div className={cn('h-28 w-full bg-gradient-to-br relative', coverClass)}>
                      {capture.coverUrl ? (
                        <Image src={capture.coverUrl} alt="" fill unoptimized sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-20">
                          {cat?.icon || '📝'}
                        </div>
                      )}
                      <div className="absolute top-2 right-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-label={`Opções da nota ${title}`} variant="ghost" size="icon" className="h-10 w-10 bg-background/80 backdrop-blur-sm" onClick={e => e.stopPropagation()}>
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => handleDuplicate(capture)}>
                              <Copy className="mr-2 h-4 w-4" /> Duplicar
                            </DropdownMenuItem>
                            {!capture.targetId && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setConverting(capture)}>
                            <ArrowRight className="mr-2 h-4 w-4" /> Converter captura…
                          </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(capture.id)} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <CardContent className="p-5">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {cat && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0 gap-1" style={{ borderColor: cat.color + '40', color: cat.color }}>
                            {cat.icon} {cat.name}
                          </Badge>
                        )}
                      </div>
                      <h3 className="mb-2 font-display text-xl leading-snug"><button type="button" aria-label={`Abrir nota ${title}`} className="work-card-title line-clamp-2 w-full text-left focus-visible:outline-2 focus-visible:outline-primary" onClick={event => { event.stopPropagation(); openEdit(capture); }}>{title}</button></h3>
                      {preview && <p className="text-xs text-muted-foreground line-clamp-3">{preview}</p>}
                      {capture.targetId && (
                        <NextLink
                          href={capture.targetType === 'project' ? `/projetos?open=${capture.targetId}` : `/tarefas?open=${capture.targetId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-2 inline-flex items-center gap-1 rounded-md bg-money/10 px-1.5 py-0.5 text-[11px] font-medium text-money hover:bg-money/20"
                        >
                          <ArrowRight className="h-3 w-3" /> Virou {capture.targetType === 'project' ? 'projeto' : 'tarefa'}
                        </NextLink>
                      )}
                      <p className="mt-4 flex items-center justify-between gap-2 border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
                        {new Date(capture.createdAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                        {!!capture.linkedCaptureIds?.length && <span className="inline-flex items-center gap-1 text-primary"><Network className="h-3 w-3" /> {capture.linkedCaptureIds.length}</span>}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div className="space-y-1" variants={stagger}>
          <AnimatePresence>
            {filtered.map(capture => {
              const title = getTitle(capture.content);
              const cat = getCategory(capture.category);
              return (
                <motion.div key={capture.id} variants={fade} layout exit={{ opacity: 0, x: -20 }}>
                  <Card className="work-item-card group cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => openEdit(capture)}>
                    <CardContent className="flex items-center gap-3 p-3">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br shrink-0 flex items-center justify-center text-base" style={{ background: `linear-gradient(135deg, ${cat?.color || '#64748b'}30, ${cat?.color || '#64748b'}10)` }}>
                        {cat?.icon || <FileText className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <button type="button" aria-label={`Abrir nota ${title}`} className="min-h-8 w-full truncate text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary" onClick={event => { event.stopPropagation(); openEdit(capture); }}>{title}</button>
                        <p className="text-xs text-muted-foreground">
                          {cat?.name} · {new Date(capture.createdAt).toLocaleDateString('pt-BR')}
                          {capture.targetId && (
                            <>
                              {' · '}
                              <NextLink
                                href={capture.targetType === 'project' ? `/projetos?open=${capture.targetId}` : `/tarefas?open=${capture.targetId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-money hover:underline"
                              >
                                Virou {capture.targetType === 'project' ? 'projeto' : 'tarefa'}
                              </NextLink>
                            </>
                          )}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button aria-label={`Opções da nota ${title}`} variant="ghost" size="icon" className="h-11 w-11 opacity-100 sm:opacity-60 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" onClick={e => e.stopPropagation()}>
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => handleDuplicate(capture)}>
                            <Copy className="mr-2 h-4 w-4" /> Duplicar
                          </DropdownMenuItem>
                          {!capture.targetId && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setConverting(capture)}>
                            <ArrowRight className="mr-2 h-4 w-4" /> Converter captura…
                          </DropdownMenuItem>
                            </>
                          )}
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

      <CategoryEditorDialog
        open={categoryEditorOpen}
        onOpenChange={setCategoryEditorOpen}
        categories={categories}
        onChanged={loadCategories}
      />

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
              role="dialog"
              aria-label={editingCapture ? 'Editar nota' : 'Nova nota'}
              aria-modal="true"
              onKeyDown={event => {
                if (event.key === 'Escape') { event.stopPropagation(); closeEditor(); }
                if (event.key !== 'Tab') return;
                const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex="0"], [contenteditable="true"]')).filter(element => element.getClientRects().length > 0);
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-y-2 px-4 py-3 border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                  <Button aria-label="Fechar nota" variant="ghost" size="icon" className="h-11 w-11" onClick={closeEditor}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {editingCapture ? 'Editando' : 'Nova nota'}
                  </span>
                  <div className="flex items-center gap-0.5 rounded-lg border border-border/60 p-0.5 ml-1">
                    {LAYOUT_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        title={opt.label}
                        aria-label={`Editor: ${opt.label}`}
                        aria-pressed={editorLayout === opt.id}
                        onClick={() => setEditorLayout(opt.id)}
                        className={cn('flex h-10 w-10 items-center justify-center rounded transition-colors',
                          editorLayout === opt.id ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
                      >
                        <opt.icon className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex max-w-full flex-wrap gap-1">
                    {sortedCategories.map(cat => (
                      <button
                        key={cat.id}
                        aria-label={`Categoria: ${cat.name}`}
                        aria-pressed={editorCategory === cat.id}
                        onClick={() => setEditorCategory(cat.id)}
                        className={cn('flex min-h-10 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-all border',
                          editorCategory === cat.id ? 'border-current shadow-sm' : 'border-transparent text-muted-foreground hover:bg-muted/50')}
                        style={editorCategory === cat.id ? { color: cat.color, borderColor: cat.color, backgroundColor: cat.color + '15' } : undefined}
                      >
                        <span>{cat.icon}</span>
                        <span className="hidden sm:inline">{cat.name}</span>
                      </button>
                    ))}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-label="Fonte da nota" variant="ghost" size="icon" className="h-10 w-10 shrink-0" title="Fonte da nota">
                        <Type className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {NOTE_FONT_OPTIONS.map(opt => (
                        <DropdownMenuItem key={opt.id} onClick={() => setNoteFont(opt.id)} style={{ fontFamily: opt.family }}>
                          {noteFont === opt.id && <Check className="mr-2 h-3.5 w-3.5" />}
                          Aa {opt.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <span aria-live="polite" className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 w-16 justify-end">
                    {saveStatus === 'saving' && <>Salvando...</>}
                    {saveStatus === 'saved' && <><Check className="h-3 w-3 text-money" /> Salvo</>}
                  </span>
                </div>
              </div>

              {/* data-lenis-prevent: the app-wide ReactLenis smooth-scroll
                  wrapper (src/components/layout/app-shell.tsx) hijacks wheel
                  events globally by default — without this attribute Lenis
                  intercepts scrolling over this portaled editor body and
                  nothing happens, which is the "sem scroll" bug reported on
                  long notes. */}
              <div className="flex-1 overflow-y-auto" data-lenis-prevent>
                <div className="relative h-40 bg-gradient-to-br from-muted/30 to-muted/10">
                  {editorCoverUrl ? (
                    <div className="relative w-full h-full">
                      <Image src={editorCoverUrl} alt="" fill unoptimized sizes="(max-width: 768px) 100vw, 720px" className="object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
                      <button
                        type="button"
                        aria-label="Remover capa"
                        onClick={() => setEditorCoverUrl('')}
                        className="absolute top-3 right-3 h-11 w-11 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
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
                <div className="p-5 sm:p-8 max-w-2xl mx-auto" style={{ fontFamily: NOTE_FONT_OPTIONS.find(f => f.id === noteFont)?.family }}>
                  <input
                    value={editorTitle}
                    aria-label="Título da nota"
                    onChange={e => setEditorTitle(e.target.value)}
                    placeholder="Sem título"
                    className="w-full text-3xl font-bold bg-transparent outline-none placeholder:text-muted-foreground/40 mb-6"
                    style={{ fontFamily: 'inherit' }}
                    autoFocus
                  />
                  <NotionEditor
                    content={editorContent}
                    onChange={setEditorContent}
                    placeholder="Comece a escrever..."
                  />
                  {editingCapture && (
                    <div className="mt-8 border-t border-border pt-4">
                      <LinkedItemsPanel
                        linkableTypes={['capture']}
                        excludeId={editingCapture.id}
                        linkedIds={{ capture: editorLinkedCaptureIds }}
                        onChange={(next) => setEditorLinkedCaptureIds(next.capture || [])}
                      />
                    </div>
                  )}
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
