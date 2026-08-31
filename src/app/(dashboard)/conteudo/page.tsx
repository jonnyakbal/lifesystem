'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import {
  Plus, Search, Trash2, Pin, PinOff, Tag, Calendar, Clock, Eye, MoreHorizontal, X, BookOpen,
  Globe, MonitorPlay, Camera, FileText, ArrowRight,
  Edit3, Hash, TrendingUp, BarChart3, Send, Archive, CheckCircle2, Circle, Sparkles,
  Image, Video, Type, Layers, Target, Zap, Save, SlidersHorizontal, ArrowUpDown,
  LayoutGrid, Rows3, ChevronDown, Bookmark, Copy, EyeOff, Filter, GripVertical,
  Play, Pause, CheckSquare, Square, Star, Flame, Edit2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import { loadStatusLabelOverrides } from '@/lib/status-labels';
import { StatusLabelEditorDialog } from '@/components/status-label-editor-dialog';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { ContentEditor } from '@/components/content-editor';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContentItem {
  id: string;
  title: string;
  body: string;
  channel: ContentChannel;
  stage: ContentStage;
  category: string;
  format: string;
  tags: string[];
  pinned: boolean;
  scheduledDate?: string;
  scheduledTime?: string;
  publishedUrl?: string;
  responsible?: string;
  editorialLine?: string;
  checklist?: { id: string; text: string; done: boolean }[];
  metrics?: { views?: number; likes?: number; comments?: number; shares?: number };
  linkedTaskIds?: string[];
  linkedProjectIds?: string[];
  createdAt: string;
  updatedAt: string;
}

type ContentChannel = 'blog' | 'youtube' | 'instagram' | 'tiktok';
type ContentStage = 'idea' | 'draft' | 'review' | 'scheduled' | 'published' | 'archived';
type ViewMode = 'kanban' | 'list' | 'calendar' | 'grid';
type GroupBy = 'stage' | 'channel' | 'category' | 'format' | 'line';
type ColorBy = 'channel' | 'stage' | 'category' | 'format' | 'line';
type SortBy = 'date' | 'title' | 'stage' | 'channel';
type CalendarMode = 'month' | 'week';

interface SavedView {
  id: string;
  name: string;
  view: ViewMode;
  channel: ContentChannel | 'all';
  filterStage: string;
  filterCategory: string;
  filterFormat: string;
  filterLine: string;
  search: string;
  groupBy: GroupBy;
  colorBy: ColorBy;
  sortBy: SortBy;
  dense: boolean;
  calendarMode: CalendarMode;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHANNELS: { id: ContentChannel; label: string; icon: typeof Globe; color: string; gradient: string }[] = [
  { id: 'blog', label: 'Blog', icon: Globe, color: 'text-blue-400', gradient: 'from-blue-500/20 to-blue-600/5' },
  { id: 'youtube', label: 'YouTube', icon: MonitorPlay, color: 'text-red-400', gradient: 'from-red-500/20 to-red-600/5' },
  { id: 'instagram', label: 'Instagram', icon: Camera, color: 'text-pink-400', gradient: 'from-pink-500/20 to-purple-600/5' },
  { id: 'tiktok', label: 'TikTok', icon: Video, color: 'text-cyan-400', gradient: 'from-cyan-500/20 to-teal-600/5' },
];

const STAGES: { id: ContentStage; label: string; icon: typeof Sparkles; color: string; dot: string }[] = [
  { id: 'idea', label: 'Ideia', icon: Sparkles, color: 'text-purple-400', dot: 'bg-purple-500' },
  { id: 'draft', label: 'Roteiro', icon: Edit3, color: 'text-yellow-400', dot: 'bg-yellow-500' },
  { id: 'review', label: 'Produção', icon: Eye, color: 'text-orange-400', dot: 'bg-orange-500' },
  { id: 'scheduled', label: 'Agendado', icon: Calendar, color: 'text-blue-400', dot: 'bg-blue-500' },
  { id: 'published', label: 'Publicado', icon: CheckCircle2, color: 'text-green-400', dot: 'bg-green-500' },
  { id: 'archived', label: 'Arquivado', icon: Archive, color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
];

const CHANNEL_CATEGORIES: Record<ContentChannel, string[]> = {
  blog: ['Artigo', 'Tutorial', 'Review', 'Case Study', 'Guia', 'Notícia', 'Opinião'],
  youtube: ['Vlog', 'Tutorial', 'Review', 'Entrevista', 'Short', 'Vídeo-aula', 'Timelapse'],
  instagram: ['Post', 'Reels', 'Stories', 'Carrossel', 'IGTV', 'Enquete', 'Destaques'],
  tiktok: ['Trend', 'Tutorial', 'Humor', 'Behind the scenes', 'Dica', 'Dueto', 'Stitch'],
};

const FORMATS: Record<ContentChannel, string[]> = {
  blog: ['Artigo longo', 'Listicle', 'How-to', 'Case study', 'Entrevista', 'Newsletter'],
  youtube: ['Vídeo longo', 'Short', 'Live', 'Collab', 'Compilation', 'Vlog'],
  instagram: ['Feed', 'Reels', 'Stories', 'Carrossel', 'Live', 'Guide'],
  tiktok: ['Vídeo', 'Photo', 'Duet', 'Stitch', 'Live', 'Séries'],
};

const EDITORIAL_LINES = [
  { id: 'arco-tech', label: 'ARCO Tech', color: '#3b82f6', icon: '⚡' },
  { id: 'arco-labs', label: 'ARCO Labs', color: '#8b5cf6', icon: '🔬' },
  { id: 'arco-pass', label: 'ARCO Pass', color: '#22c55e', icon: '🎫' },
  { id: 'rataria', label: 'Rataria S.A.', color: '#f59e0b', icon: '♟️' },
  { id: 'dona-maria', label: 'Dona Maria', color: '#ef4444', icon: '🍷' },
];

const DEFAULT_VIEW: SavedView = {
  id: 'default',
  name: 'Padrão',
  view: 'kanban',
  channel: 'blog',
  filterStage: 'all',
  filterCategory: 'all',
  filterFormat: 'all',
  filterLine: 'all',
  search: '',
  groupBy: 'stage',
  colorBy: 'stage',
  sortBy: 'date',
  dense: false,
  calendarMode: 'month',
};

const fade = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };
const stagger = { animate: { transition: { staggerChildren: 0.04, delayChildren: 0.04 } } };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: string) {
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-4 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-primary/30 pl-3 italic text-muted-foreground">$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n{2,}/g, '</p><p class="mb-2">')
    .replace(/\n/g, '<br/>');
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getWordEstimate(text: string, channel: ContentChannel): string {
  const words = wordCount(text);
  if (channel === 'youtube') return `~${Math.round(words / 150)}min de vídeo`;
  if (channel === 'blog') return `${words} palavras`;
  if (channel === 'instagram') return `${Math.min(words, 2200)} chars`;
  if (channel === 'tiktok') return `~${Math.min(Math.round(words / 2.5), 60)}s`;
  return `${words} palavras`;
}

function getLineColor(lineId: string): string {
  return EDITORIAL_LINES.find(l => l.id === lineId)?.color || '#64748b';
}

function getChannelData(channelId: ContentChannel) {
  return CHANNELS.find(c => c.id === channelId)!;
}

function getStageData(stageId: ContentStage) {
  return STAGES.find(s => s.id === stageId)!;
}

// ─── Filter Chip Component ────────────────────────────────────────────────────

function FilterChip({ label, value, onRemove }: { label: string; value: string; onRemove: () => void }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
    >
      <span className="text-primary/70">{label}:</span> {value}
      <button onClick={onRemove} className="ml-0.5 hover:text-primary/50 transition-colors">
        <X className="h-3 w-3" />
      </button>
    </motion.span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ConteudoPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusLabels, setStatusLabels] = useState<Record<string, string>>({});
  const [statusLabelDialogOpen, setStatusLabelDialogOpen] = useState(false);
  const getStageLabel = (id: string) => statusLabels[id] || STAGES.find(s => s.id === id)?.label || id;

  // View state
  const [view, setView] = useState<ViewMode>('kanban');
  const [activeChannel, setActiveChannel] = useState<ContentChannel | 'all'>('all');
  const [filterStage, setFilterStage] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterFormat, setFilterFormat] = useState('all');
  const [filterLine, setFilterLine] = useState('all');
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('stage');
  const [colorBy, setColorBy] = useState<ColorBy>('stage');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [dense, setDense] = useState(false);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('month');

  // Saved views
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState('default');

  // Editor
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);

  // Load
  useEffect(() => {
    setStatusLabels(loadStatusLabelOverrides('content'));
    loadItems();
    loadSavedViews();
  }, []);

  // Deep-link support: ⌘K search results for content land here with
  // ?open=<id> instead of just the bare page, so search actually jumps to
  // the item instead of just the general kanban.
  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId || items.length === 0) return;
    const item = items.find(i => i.id === openId);
    if (item) {
      openEdit(item);
      router.replace('/conteudo');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, searchParams]);

  async function loadItems() {
    try {
      const data = await apiFetch<ContentItem[]>('/api/content');
      setItems(data.map((item: ContentItem) => ({
        ...item,
        channel: item.channel || 'blog',
        stage: item.stage || 'draft',
        format: item.format || '',
        tags: item.tags || [],
        checklist: item.checklist || [],
      })));
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setIsLoading(false);
    }
  }

  function loadSavedViews() {
    try {
      const stored = localStorage.getItem('lifesystem_content_views');
      if (stored) setSavedViews(JSON.parse(stored));
    } catch {}
  }

  function saveViews(views: SavedView[]) {
    setSavedViews(views);
    localStorage.setItem('lifesystem_content_views', JSON.stringify(views));
  }

  function applyView(viewData: SavedView) {
    setActiveViewId(viewData.id);
    setView(viewData.view);
    setActiveChannel(viewData.channel);
    setFilterStage(viewData.filterStage);
    setFilterCategory(viewData.filterCategory);
    setFilterFormat(viewData.filterFormat);
    setFilterLine(viewData.filterLine);
    setSearch(viewData.search);
    setGroupBy(viewData.groupBy);
    setColorBy(viewData.colorBy);
    setSortBy(viewData.sortBy);
    setDense(viewData.dense);
    setCalendarMode(viewData.calendarMode);
  }

  function saveCurrentView(name: string) {
    const newView: SavedView = {
      id: `view_${Date.now()}`,
      name,
      view, channel: activeChannel, filterStage, filterCategory, filterFormat,
      filterLine, search, groupBy, colorBy, sortBy, dense, calendarMode,
    };
    const updated = [...savedViews, newView];
    saveViews(updated);
    setActiveViewId(newView.id);
    toast.success(`Visão "${name}" salva!`);
  }

  function deleteView(id: string) {
    const updated = savedViews.filter(v => v.id !== id);
    saveViews(updated);
    if (activeViewId === id) setActiveViewId('default');
    toast.success('Visão excluída!');
  }

  // CRUD
  function openCreate() {
    setEditingItem(null);
    setIsEditorOpen(true);
  }

  function openEdit(item: ContentItem) {
    setEditingItem(item);
    setIsEditorOpen(true);
  }

  async function handleDelete(id: string) {
    try {
      const item = items.find(i => i.id === id);
      await apiFetch(`/api/content/${id}`, { method: 'DELETE' });
      setIsEditorOpen(false);
      loadItems();
      toast('Conteúdo excluído', {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            if (item) {
              try {
                await apiFetch('/api/content', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...item, id: undefined, createdAt: undefined, updatedAt: undefined }),
                });
                loadItems();
                toast.success('Conteúdo restaurado!');
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

  async function handleStageChange(item: ContentItem, stage: ContentStage) {
    try {
      await apiFetch(`/api/content/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage }) });
      loadItems();
      if (stage === 'published') toast.success('Publicado! 🎉');
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function handleTogglePin(item: ContentItem) {
    try {
      await apiFetch(`/api/content/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pinned: !item.pinned }) });
      loadItems();
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function handleDuplicate(item: ContentItem) {
    try {
      await apiFetch('/api/content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, id: undefined, title: `${item.title} (cópia)`, stage: 'idea', pinned: false, createdAt: undefined, updatedAt: undefined }),
      });
      loadItems();
      toast.success('Conteúdo duplicado!');
    } catch (err) {
      toast.error(showError(err));
    }
  }

  // Filtered data
  const filtered = useMemo(() => {
    return items.filter(item => {
      if (activeChannel !== 'all' && item.channel !== activeChannel) return false;
      if (filterStage !== 'all' && item.stage !== filterStage) return false;
      if (filterCategory !== 'all' && item.category !== filterCategory) return false;
      if (filterFormat !== 'all' && item.format !== filterFormat) return false;
      if (filterLine !== 'all' && item.editorialLine !== filterLine) return false;
      if (search) {
        const q = search.toLowerCase();
        return item.title.toLowerCase().includes(q) || item.body.toLowerCase().includes(q) || (item.tags || []).some(t => t.toLowerCase().includes(q));
      }
      return true;
    });
  }, [items, activeChannel, filterStage, filterCategory, filterFormat, filterLine, search]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortBy === 'title') arr.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortBy === 'stage') arr.sort((a, b) => STAGES.findIndex(s => s.id === a.stage) - STAGES.findIndex(s => s.id === b.stage));
    else if (sortBy === 'channel') arr.sort((a, b) => a.channel.localeCompare(b.channel));
    else arr.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return arr;
  }, [filtered, sortBy]);

  // Active filters for chips
  const activeFilters = useMemo(() => {
    const chips: { label: string; value: string; key: string }[] = [];
    if (activeChannel !== 'all') chips.push({ label: 'Canal', value: getChannelData(activeChannel as ContentChannel)?.label || activeChannel, key: 'channel' });
    if (filterStage !== 'all') chips.push({ label: 'Estágio', value: getStageLabel(filterStage), key: 'stage' });
    if (filterCategory !== 'all') chips.push({ label: 'Categoria', value: filterCategory, key: 'category' });
    if (filterFormat !== 'all') chips.push({ label: 'Formato', value: filterFormat, key: 'format' });
    if (filterLine !== 'all') chips.push({ label: 'Linha', value: EDITORIAL_LINES.find(l => l.id === filterLine)?.label || filterLine, key: 'line' });
    return chips;
  }, [activeChannel, filterStage, filterCategory, filterFormat, filterLine]);

  function removeFilter(key: string) {
    if (key === 'channel') setActiveChannel('all');
    if (key === 'stage') setFilterStage('all');
    if (key === 'category') setFilterCategory('all');
    if (key === 'format') setFilterFormat('all');
    if (key === 'line') setFilterLine('all');
  }

  function clearAllFilters() {
    setActiveChannel('all');
    setFilterStage('all');
    setFilterCategory('all');
    setFilterFormat('all');
    setFilterLine('all');
    setSearch('');
  }

  // Pipeline stats
  const pipelineStats = useMemo(() => {
    const channelItems = activeChannel === 'all' ? items : items.filter(i => i.channel === activeChannel);
    return STAGES.map(s => ({ ...s, label: getStageLabel(s.id), count: channelItems.filter(i => i.stage === s.id).length }));
  }, [items, activeChannel, statusLabels]);

  const totalByChannel = useMemo(() => {
    return CHANNELS.map(ch => ({ ...ch, count: items.filter(i => i.channel === ch.id).length }));
  }, [items]);

  // Group items
  const grouped = useMemo(() => {
    const groups = new Map<string, ContentItem[]>();
    let groupKeys: string[] = [];

    if (groupBy === 'stage') {
      groupKeys = STAGES.map(s => s.id);
      STAGES.forEach(s => groups.set(s.id, []));
    } else if (groupBy === 'channel') {
      groupKeys = CHANNELS.map(c => c.id);
      CHANNELS.forEach(c => groups.set(c.id, []));
    } else if (groupBy === 'category') {
      const cats = [...new Set(sorted.map(i => i.category).filter(Boolean))];
      groupKeys = cats;
      cats.forEach(c => groups.set(c, []));
    } else if (groupBy === 'format') {
      const fmts = [...new Set(sorted.map(i => i.format).filter(Boolean))];
      groupKeys = fmts;
      fmts.forEach(f => groups.set(f, []));
    } else if (groupBy === 'line') {
      groupKeys = EDITORIAL_LINES.map(l => l.id);
      EDITORIAL_LINES.forEach(l => groups.set(l.id, []));
    }

    sorted.forEach(item => {
      let key = '';
      if (groupBy === 'stage') key = item.stage;
      else if (groupBy === 'channel') key = item.channel;
      else if (groupBy === 'category') key = item.category;
      else if (groupBy === 'format') key = item.format;
      else if (groupBy === 'line') key = item.editorialLine || '';
      if (groups.has(key)) groups.get(key)!.push(item);
    });

    return { groups, groupKeys };
  }, [sorted, groupBy]);

  // Calendar
  const calendarDays = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    if (calendarMode === 'week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const days: { day: number; date: string; items: ContentItem[] }[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        days.push({ day: d.getDate(), date: dateStr, items: sorted.filter(item => item.scheduledDate === dateStr) });
      }
      return days;
    }

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: { day: number; date: string; items: ContentItem[] }[] = [];
    for (let i = 0; i < firstDay; i++) days.push({ day: 0, date: '', items: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, date: dateStr, items: sorted.filter(i => i.scheduledDate === dateStr) });
    }
    return days;
  }, [sorted, calendarMode]);

  function getGroupLabel(key: string): string {
    if (groupBy === 'stage') return getStageLabel(key);
    if (groupBy === 'channel') return getChannelData(key as ContentChannel)?.label || key;
    if (groupBy === 'category') return key;
    if (groupBy === 'format') return key;
    if (groupBy === 'line') return EDITORIAL_LINES.find(l => l.id === key)?.label || key;
    return key;
  }

  function getGroupColor(key: string): string {
    if (groupBy === 'stage') return getStageData(key as ContentStage)?.dot || 'bg-muted-foreground';
    if (groupBy === 'channel') return getChannelData(key as ContentChannel)?.color || 'text-muted-foreground';
    if (groupBy === 'line') return getLineColor(key);
    return 'bg-muted-foreground';
  }

  function getCardBorder(item: ContentItem): string {
    if (colorBy === 'channel') return getChannelData(item.channel)?.color?.replace('text-', 'border-l-') || '';
    if (colorBy === 'stage') return getStageData(item.stage)?.dot?.replace('bg-', 'border-l-') || '';
    if (colorBy === 'line' && item.editorialLine) return '';
    if (colorBy === 'category') return '';
    if (colorBy === 'format') return '';
    return '';
  }

  // ─── Render Card ──────────────────────────────────────────────────────────

  function renderCard(item: ContentItem, compact = false) {
    const ch = getChannelData(item.channel);
    const st = getStageData(item.stage);
    const ChIcon = ch.icon;
    const borderClass = colorBy === 'channel' ? `border-l-2 border-l-${ch.color.replace('text-', '')}` :
      colorBy === 'stage' ? `border-l-2 border-l-${st.dot.replace('bg-', '')}` :
      colorBy === 'line' && item.editorialLine ? `border-l-2` : '';

    const lineColor = colorBy === 'line' && item.editorialLine ? getLineColor(item.editorialLine) : undefined;

    return (
      <motion.div key={item.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
        <Card
          className={cn(
            'group cursor-pointer hover:border-primary/50 hover:shadow-md hover:shadow-primary/5 transition-all',
            borderClass,
            item.pinned && 'ring-1 ring-primary/30'
          )}
          style={lineColor ? { borderLeftColor: lineColor } : undefined}
          onClick={() => openEdit(item)}
        >
          <CardContent className={cn('p-3', dense && 'p-2')}>
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                {item.pinned && <Pin className="h-2.5 w-2.5 text-primary shrink-0" />}
                <h4 className={cn('font-medium leading-snug truncate', dense ? 'text-xs' : 'text-sm')}>{item.title}</h4>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => handleTogglePin(item)}>
                    {item.pinned ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />}
                    {item.pinned ? 'Desafixar' : 'Fixar'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDuplicate(item)}>
                    <Copy className="mr-2 h-4 w-4" /> Duplicar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {STAGES.filter(s => s.id !== item.stage).map(s => (
                    <DropdownMenuItem key={s.id} onClick={() => handleStageChange(item, s.id)}>
                      <ArrowRight className="mr-2 h-4 w-4" /> {getStageLabel(s.id)}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {!dense && item.body && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                {item.body.replace(/<[^>]*>/g, '').slice(0, 100)}
              </p>
            )}

            {!dense && item.checklist && item.checklist.length > 0 && (
              <div className="flex items-center gap-1.5 mb-2">
                <CheckSquare className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {item.checklist.filter(c => c.done).length}/{item.checklist.length}
                </span>
                <Progress value={(item.checklist.filter(c => c.done).length / item.checklist.length) * 100} className="h-1 flex-1" />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1">
              <Badge variant="outline" className={cn('gap-0.5', dense ? 'text-xs px-1 py-0' : 'text-xs px-1.5 py-0')}>
                <ChIcon className={cn('h-2 w-2', ch.color)} /> {item.category}
              </Badge>
              {item.format && (
                <Badge variant="secondary" className={cn(dense ? 'text-xs px-1 py-0' : 'text-xs px-1.5 py-0')}>
                  {item.format}
                </Badge>
              )}
              {item.editorialLine && (
                <Badge variant="outline" className={cn(dense ? 'text-xs px-1 py-0' : 'text-xs px-1.5 py-0')} style={{ borderColor: getLineColor(item.editorialLine) + '40', color: getLineColor(item.editorialLine) }}>
                  {EDITORIAL_LINES.find(l => l.id === item.editorialLine)?.icon} {EDITORIAL_LINES.find(l => l.id === item.editorialLine)?.label}
                </Badge>
              )}
              {(item.tags || []).slice(0, dense ? 0 : 1).map(tag => (
                <Badge key={tag} variant="secondary" className={cn(dense ? 'text-xs px-1 py-0' : 'text-xs px-1.5 py-0')}>
                  {tag}
                </Badge>
              ))}
              {item.scheduledDate && (
                <Badge variant="outline" className={cn('gap-0.5 text-blue-400', dense ? 'text-xs px-1 py-0' : 'text-xs px-1.5 py-0')}>
                  <Calendar className="h-2 w-2" />
                  {new Date(item.scheduledDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  {item.scheduledTime && ` ${item.scheduledTime}`}
                </Badge>
              )}
            </div>

            {!dense && item.metrics && (
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                {item.metrics.views !== undefined && <span className="flex items-center gap-0.5"><Eye className="h-2.5 w-2.5" />{item.metrics.views.toLocaleString('pt-BR')}</span>}
                {item.metrics.likes !== undefined && <span className="flex items-center gap-0.5"><Star className="h-2.5 w-2.5" />{item.metrics.likes.toLocaleString('pt-BR')}</span>}
                {item.metrics.comments !== undefined && <span className="flex items-center gap-0.5"><Hash className="h-2.5 w-2.5" />{item.metrics.comments.toLocaleString('pt-BR')}</span>}
              </div>
            )}

            <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-2.5 w-2.5" /> {timeAgo(item.updatedAt)}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // ─── Kanban View ──────────────────────────────────────────────────────────

  function renderKanban() {
    if (groupBy === 'stage') {
      return (
        <div className="flex gap-4 overflow-x-auto pb-4 max-sm:snap-x max-sm:snap-mandatory">
          <LayoutGroup id="content-kanban">
            {STAGES.map(stage => {
              const stageItems = sorted.filter(i => i.stage === stage.id);
              return (
                <div key={stage.id} className="flex flex-col min-w-[260px] max-sm:min-w-[80vw]">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className={cn('h-2.5 w-2.5 rounded-full', stage.dot)} />
                    <h3 className="text-sm font-medium">{getStageLabel(stage.id)}</h3>
                    <Badge variant="secondary" className="ml-auto text-xs">{stageItems.length}</Badge>
                  </div>
                  <div className="space-y-2 flex-1 rounded-lg border border-border/50 bg-muted/20 p-2 min-h-[300px]">
                    <AnimatePresence>
                      {stageItems.map(item => renderCard(item))}
                    </AnimatePresence>
                    {stageItems.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <stage.icon className="h-6 w-6 mb-2 opacity-30" />
                        <p className="text-xs">Nenhum item</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </LayoutGroup>
        </div>
      );
    }

    // Grouped kanban by other axis
    return (
      <div className="flex gap-4 overflow-x-auto pb-4 max-sm:snap-x max-sm:snap-mandatory">
        <LayoutGroup id="content-kanban-grouped">
          {grouped.groupKeys.map(key => {
            const groupItems = grouped.groups.get(key) || [];
            return (
              <div key={key} className="flex flex-col min-w-[260px] max-sm:min-w-[80vw]">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className={cn('h-2.5 w-2.5 rounded-full', getGroupColor(key))} style={groupBy === 'line' ? { backgroundColor: getLineColor(key) } : undefined} />
                  <h3 className="text-sm font-medium">{getGroupLabel(key)}</h3>
                  <Badge variant="secondary" className="ml-auto text-xs">{groupItems.length}</Badge>
                </div>
                <div className="space-y-2 flex-1 rounded-lg border border-border/50 bg-muted/20 p-2 min-h-[300px]">
                  <AnimatePresence>
                    {groupItems.map(item => renderCard(item))}
                  </AnimatePresence>
                  {groupItems.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <p className="text-xs">Nenhum item</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </LayoutGroup>
      </div>
    );
  }

  // ─── List View ────────────────────────────────────────────────────────────

  function renderList() {
    return (
      <div className="space-y-4">
        {Array.from(grouped.groups.entries()).map(([key, groupItems]) => {
          if (groupItems.length === 0) return null;
          const st = groupBy === 'stage' ? getStageData(key as ContentStage) : null;
          return (
            <div key={key}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className={cn('h-2.5 w-2.5 rounded-full', st?.dot || 'bg-muted-foreground')} style={groupBy === 'line' ? { backgroundColor: getLineColor(key) } : undefined} />
                <h3 className="text-sm font-medium">{getGroupLabel(key)}</h3>
                <Badge variant="secondary" className="text-xs">{groupItems.length}</Badge>
              </div>
              <div className="space-y-1">
                {groupItems.map(item => {
                  const ch = getChannelData(item.channel);
                  const st2 = getStageData(item.stage);
                  const ChIcon = ch.icon;
                  const StIcon = st2.icon;
                  return (
                    <motion.div key={item.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <div className="group flex items-center gap-3 rounded-lg p-2.5 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => openEdit(item)}>
                        <ChIcon className={cn('h-4 w-4 shrink-0', ch.color)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {item.pinned && <Pin className="h-2.5 w-2.5 text-primary shrink-0" />}
                            <span className="text-sm font-medium truncate">{item.title}</span>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs px-1.5 py-0 gap-0.5 shrink-0">
                          <StIcon className="h-2 w-2" /> {getStageLabel(st2.id)}
                        </Badge>
                        <Badge variant="secondary" className="text-xs px-1.5 py-0 shrink-0">{item.category}</Badge>
                        {item.scheduledDate && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {new Date(item.scheduledDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground shrink-0">{timeAgo(item.updatedAt)}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" onClick={(e) => e.stopPropagation()}>
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => handleTogglePin(item)}>
                              {item.pinned ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />}
                              {item.pinned ? 'Desafixar' : 'Fixar'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(item)}>
                              <Copy className="mr-2 h-4 w-4" /> Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ─── Calendar View ────────────────────────────────────────────────────────

  function renderCalendar() {
    const now = new Date();
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const title = calendarMode === 'week'
      ? `Semana de ${now.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}`
      : now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium capitalize">{title}</h3>
          <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-0.5">
            <Button variant={calendarMode === 'month' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2 text-xs" onClick={() => setCalendarMode('month')}>Mês</Button>
            <Button variant={calendarMode === 'week' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2 text-xs" onClick={() => setCalendarMode('week')}>Semana</Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(d => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
          ))}
          {calendarDays.map((day, i) => (
            <div key={i} className={cn(
              'rounded-lg border p-1.5 transition-colors',
              calendarMode === 'week' ? 'min-h-[120px]' : 'min-h-[80px]',
              day.day === 0 ? 'border-transparent' :
              day.date === now.toISOString().split('T')[0] ? 'border-primary/50 bg-primary/5' : 'border-border/50 bg-muted/10'
            )}>
              {day.day > 0 && (
                <>
                  <span className={cn('text-xs font-medium', day.date === now.toISOString().split('T')[0] ? 'text-primary font-bold' : 'text-muted-foreground')}>
                    {day.day}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {day.items.slice(0, calendarMode === 'week' ? 10 : 3).map(item => {
                      const ch = getChannelData(item.channel);
                      return (
                        <div key={item.id} className="rounded px-1 py-0.5 text-xs cursor-pointer hover:opacity-80 transition-opacity truncate flex items-center gap-1" style={{ backgroundColor: getLineColor(item.editorialLine || '') + '20', color: getLineColor(item.editorialLine || '') }} onClick={() => openEdit(item)}>
                          <ch.icon className="h-2 w-2 shrink-0" /> {item.title}
                        </div>
                      );
                    })}
                    {day.items.length > (calendarMode === 'week' ? 10 : 3) && (
                      <span className="text-xs text-muted-foreground">+{day.items.length - (calendarMode === 'week' ? 10 : 3)}</span>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Grid View ────────────────────────────────────────────────────────────

  function renderGrid() {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AnimatePresence>
          {sorted.map(item => renderCard(item))}
        </AnimatePresence>
      </div>
    );
  }

  // ─── Main Render ──────────────────────────────────────────────────────────

  return (
    <motion.div className="p-4 lg:p-8" variants={stagger} initial="initial" animate="animate">
      {/* Header */}
      <motion.div className="mb-6" variants={fade}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Conteúdo ARCO LABS</h1>
            <p className="text-muted-foreground">{sorted.length} conteúdos · {items.filter(i => i.stage === 'published').length} publicados</p>
          </div>
        </div>

        {/* Channel Tabs */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button
            onClick={() => setActiveChannel('all')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all border',
              activeChannel === 'all' ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border/50 text-muted-foreground hover:bg-muted/50'
            )}
          >
            Todos
            <Badge variant="secondary" className="text-xs px-1.5 py-0">{items.length}</Badge>
          </button>
          {totalByChannel.map(ch => {
            const Icon = ch.icon;
            return (
              <button
                key={ch.id}
                onClick={() => setActiveChannel(ch.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all border',
                  activeChannel === ch.id
                    ? `bg-gradient-to-r ${ch.gradient} border-current/20 ${ch.color}`
                    : 'border-border/50 text-muted-foreground hover:bg-muted/50'
                )}
              >
                <Icon className="h-4 w-4" />
                {ch.label}
                {ch.count > 0 && <Badge variant="secondary" className="text-xs px-1.5 py-0">{ch.count}</Badge>}
              </button>
            );
          })}
        </div>

        {/* Pipeline Stats */}
        <div className="flex flex-wrap gap-2 mb-3">
          {pipelineStats.map(s => (
            <button
              key={s.id}
              onClick={() => setFilterStage(filterStage === s.id ? 'all' : s.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all border',
                filterStage === s.id ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border/50 text-muted-foreground hover:bg-muted/50'
              )}
            >
              <div className={cn('h-2 w-2 rounded-full', s.dot)} />
              {s.label}
              <span className="font-mono-num">{s.count}</span>
            </button>
          ))}
        </div>

        {/* Filter Chips */}
        <AnimatePresence>
          {activeFilters.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap items-center gap-1.5 mb-3">
              {activeFilters.map(f => (
                <FilterChip key={f.key} label={f.label} value={f.value} onRemove={() => removeFilter(f.key)} />
              ))}
              <button onClick={clearAllFilters} className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1">
                limpar tudo
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 lg:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar conteúdo..." className="pl-9 h-9" />
          </div>

          {/* View switcher */}
          <div className="flex items-center gap-0.5 rounded-lg border bg-muted/30 p-0.5">
            {[
              { id: 'kanban' as const, icon: Layers, label: 'Pipeline' },
              { id: 'list' as const, icon: Rows3, label: 'Lista' },
              { id: 'calendar' as const, icon: Calendar, label: 'Calendário' },
              { id: 'grid' as const, icon: LayoutGrid, label: 'Grade' },
            ].map(v => (
              <Button key={v.id} variant={view === v.id ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setView(v.id)}>
                <v.icon className="h-3 w-3" />
              </Button>
            ))}
          </div>

          {/* Group/Sort/Color */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Agrupar por</Label>
                  <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stage">Estágio</SelectItem>
                      <SelectItem value="channel">Canal</SelectItem>
                      <SelectItem value="category">Categoria</SelectItem>
                      <SelectItem value="format">Formato</SelectItem>
                      <SelectItem value="line">Linha Editorial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Cor por</Label>
                  <Select value={colorBy} onValueChange={(v) => setColorBy(v as ColorBy)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="channel">Canal</SelectItem>
                      <SelectItem value="stage">Estágio</SelectItem>
                      <SelectItem value="category">Categoria</SelectItem>
                      <SelectItem value="format">Formato</SelectItem>
                      <SelectItem value="line">Linha Editorial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Ordenar por</Label>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Data</SelectItem>
                      <SelectItem value="title">Título</SelectItem>
                      <SelectItem value="stage">Estágio</SelectItem>
                      <SelectItem value="channel">Canal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Modo denso</Label>
                  <Switch checked={dense} onCheckedChange={setDense} />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-xs">Categoria</Label>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {[...new Set(items.map(i => i.category).filter(Boolean))].map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Formato</Label>
                  <Select value={filterFormat} onValueChange={setFilterFormat}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {[...new Set(items.map(i => i.format).filter(Boolean))].map(fmt => (
                        <SelectItem key={fmt} value={fmt}>{fmt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Linha Editorial</Label>
                  <Select value={filterLine} onValueChange={setFilterLine}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {EDITORIAL_LINES.map(line => (
                        <SelectItem key={line.id} value={line.id}>{line.icon} {line.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Saved Views */}
          <div className="flex items-center gap-1">
            {savedViews.slice(0, 3).map(v => (
              <Button key={v.id} variant={activeViewId === v.id ? 'secondary' : 'ghost'} size="sm" className="h-9 text-xs gap-1" onClick={() => applyView(v)}>
                <Bookmark className="h-3 w-3" /> {v.name}
              </Button>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 text-xs gap-1">
                  <Save className="h-3 w-3" /> Salvar
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56" align="end">
                <div className="space-y-2">
                  <Label className="text-xs">Salvar visão atual</Label>
                  <div className="flex gap-2">
                    <Input id="view-name" placeholder="Nome da visão" className="h-8 text-xs" />
                    <Button size="sm" className="h-8" onClick={() => {
                      const input = document.getElementById('view-name') as HTMLInputElement;
                      if (input?.value.trim()) saveCurrentView(input.value.trim());
                    }}>Salvar</Button>
                  </div>
                  {savedViews.length > 0 && (
                    <div className="space-y-1 pt-2 border-t">
                      {savedViews.map(v => (
                        <div key={v.id} className="flex items-center justify-between group">
                          <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => applyView(v)}>{v.name}</button>
                          <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => deleteView(v.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <Button variant="outline" size="sm" onClick={() => setStatusLabelDialogOpen(true)} title="Editar rótulos de status">
            <Edit2 className="h-4 w-4" />
          </Button>

          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> Novo
          </Button>
        </div>
      </motion.div>

      <StatusLabelEditorDialog
        open={statusLabelDialogOpen}
        onOpenChange={setStatusLabelDialogOpen}
        scope="content"
        statuses={STAGES.map(s => ({ id: s.id, defaultLabel: s.label, dotClassName: s.dot }))}
        onSaved={() => setStatusLabels(loadStatusLabelOverrides('content'))}
      />

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-4 w-3/4 mb-2" /><Skeleton className="h-3 w-full mb-2" /><Skeleton className="h-3 w-2/3" /></CardContent></Card>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <BookOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-muted-foreground">Nenhum conteúdo encontrado</p>
            <p className="text-sm text-muted-foreground">Crie novo conteúdo ou ajuste os filtros</p>
            <Button className="mt-4 gap-1" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Criar Conteúdo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <motion.div variants={fade}>
          {view === 'kanban' && renderKanban()}
          {view === 'list' && renderList()}
          {view === 'calendar' && renderCalendar()}
          {view === 'grid' && renderGrid()}
        </motion.div>
      )}

      {/* Content Editor */}
      <ContentEditor
        open={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        editingItem={editingItem}
        activeChannel={activeChannel}
        onSaved={loadItems}
      />
    </motion.div>
  );
}
