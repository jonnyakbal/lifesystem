'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Trash2, Search, Rss, RefreshCw, ExternalLink, Eye, EyeOff,
  CheckCircle2, Circle, ArrowRight, Sparkles, Globe, Mail, Video,
  Newspaper, FileText, ChevronDown, X, Loader2, AlertTriangle, Clock,
  Star, Archive, Bookmark, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContentSource {
  id: string;
  name: string;
  type: 'rss' | 'website' | 'youtube_channel' | 'youtube_playlist' | 'newsletter' | 'manual';
  url: string;
  description?: string;
  icon?: string;
  color?: string;
  tags?: string[];
  isActive: boolean;
  lastFetchedAt?: string;
  fetchStatus: 'idle' | 'fetching' | 'success' | 'error';
  error?: string;
  itemCount: number;
  createdAt: string;
}

interface ContentItem {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  author?: string;
  content: string;
  excerpt?: string;
  imageUrl?: string;
  publishedAt?: string;
  fetchedAt: string;
  summary?: string;
  tags?: string[];
  category?: string;
  status: 'unread' | 'reading' | 'read' | 'archived';
  importance: 'low' | 'normal' | 'high';
  aiInsights?: {
    summary?: string;
    actionSuggestion?: string;
    actionTitle?: string;
    relatedPillar?: string;
    relatedProject?: string;
  };
  linkedCaptureId?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_TYPES: { id: ContentSource['type']; label: string; icon: typeof Globe; color: string }[] = [
  { id: 'rss', label: 'RSS/Atom', icon: Rss, color: 'text-orange-400' },
  { id: 'website', label: 'Site', icon: Globe, color: 'text-blue-400' },
  { id: 'youtube_channel', label: 'Canal YouTube', icon: Video, color: 'text-red-400' },
  { id: 'youtube_playlist', label: 'Playlist YouTube', icon: Video, color: 'text-red-300' },
  { id: 'newsletter', label: 'Newsletter', icon: Mail, color: 'text-green-400' },
  { id: 'manual', label: 'Manual', icon: FileText, color: 'text-purple-400' },
];

const STATUS_COLORS = {
  unread: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  reading: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  read: 'bg-green-500/20 text-green-400 border-green-500/30',
  archived: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const IMPORTANCE_COLORS = {
  low: 'bg-gray-500/20 text-gray-400',
  normal: 'bg-blue-500/20 text-blue-400',
  high: 'bg-orange-500/20 text-orange-400',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSourceTypeConfig(type: ContentSource['type']) {
  return SOURCE_TYPES.find(t => t.id === type) ?? SOURCE_TYPES[0];
}

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContentHubPage() {
  const [sources, setSources] = useState<ContentSource[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [showAddSource, setShowAddSource] = useState(false);
  const [showReader, setShowReader] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const [newSource, setNewSource] = useState({
    name: '',
    type: 'rss' as ContentSource['type'],
    url: '',
    description: '',
    tags: '',
  });

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [sourcesData, itemsData] = await Promise.all([
        apiFetch<ContentSource[]>('/api/content-hub/sources'),
        apiFetch<ContentItem[]>('/api/content-hub/items'),
      ]);
      setSources(sourcesData);
      setItems(itemsData);
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filtered items
  const filteredItems = useMemo(() => {
    let result = items;
    if (filterSource !== 'all') result = result.filter(i => i.sourceId === filterSource);
    if (filterStatus !== 'all') result = result.filter(i => i.status === filterStatus);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.excerpt?.toLowerCase().includes(q) ||
        i.author?.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime());
  }, [items, filterSource, filterStatus, search]);

  const unreadCount = useMemo(() => items.filter(i => i.status === 'unread').length, [items]);

  // Add source
  const handleAddSource = async () => {
    if (!newSource.name || !newSource.url) {
      toast.error('Nome e URL são obrigatórios');
      return;
    }
    try {
      const source = await apiFetch<ContentSource>('/api/content-hub/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSource.name,
          type: newSource.type,
          url: newSource.url,
          description: newSource.description || undefined,
          tags: newSource.tags ? newSource.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        }),
      });
      setSources(prev => [...prev, source]);
      setShowAddSource(false);
      setNewSource({ name: '', type: 'rss', url: '', description: '', tags: '' });
      toast.success('Fonte adicionada!');
      // Auto-refresh the new source
      handleRefreshSource(source.id);
    } catch (err) {
      toast.error(showError(err));
    }
  };

  // Refresh source
  const handleRefreshSource = async (id: string) => {
    setRefreshingId(id);
    try {
      const result = await apiFetch<{ fetched: number; items: ContentItem[] }>(`/api/content-hub/sources/${id}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxItems: 20 }),
      });
      if (result.fetched > 0) {
        setItems(prev => [...result.items, ...prev]);
        toast.success(`${result.fetched} novos itens capturados`);
      } else {
        toast.info('Nenhum novo item encontrado');
      }
      // Update source status
      const updated = await apiFetch<ContentSource[]>('/api/content-hub/sources');
      setSources(updated);
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setRefreshingId(null);
    }
  };

  // Delete source
  const handleDeleteSource = async (id: string) => {
    try {
      await apiFetch(`/api/content-hub/sources/${id}`, { method: 'DELETE' });
      setSources(prev => prev.filter(s => s.id !== id));
      setItems(prev => prev.filter(i => i.sourceId !== id));
      toast.success('Fonte removida');
    } catch (err) {
      toast.error(showError(err));
    }
  };

  // Mark item as read
  const handleMarkRead = async (id: string, status: ContentItem['status']) => {
    try {
      const updated = await apiFetch<ContentItem>(`/api/content-hub/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i));
    } catch (err) {
      toast.error(showError(err));
    }
  };

  // Clip to inbox
  const handleClipToInbox = async (id: string) => {
    try {
      const result = await apiFetch<{ captureId: string }>(`/api/content-hub/items/${id}/clip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType: 'capture' }),
      });
      setItems(prev => prev.map(i => i.id === id ? { ...i, linkedCaptureId: result.captureId, status: 'read' } : i));
      toast.success('Capturado para o INBOX!');
    } catch (err) {
      toast.error(showError(err));
    }
  };

  // Open reader
  const openReader = (item: ContentItem) => {
    setSelectedItem(item);
    setShowReader(true);
    if (item.status === 'unread') handleMarkRead(item.id, 'reading');
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/20">
            <Rss className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Fontes de Conteúdo</h1>
            <p className="text-sm text-muted-foreground">
              {sources.length} fontes · {items.length} itens · {unreadCount} não lidos
            </p>
          </div>
        </div>
        <Button onClick={() => setShowAddSource(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Fonte
        </Button>
      </div>

      {/* Source Cards */}
      {sources.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sources.map(source => {
            const config = getSourceTypeConfig(source.type);
            const sourceItems = items.filter(i => i.sourceId === source.id);
            const unread = sourceItems.filter(i => i.status === 'unread').length;
            return (
              <Card key={source.id} className="group relative overflow-hidden border-border/50 bg-card/50 hover:bg-card/80 transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/50",
                        `bg-gradient-to-br from-${config.color.replace('text-', '')}/10 to-transparent`
                      )}>
                        <config.icon className={cn("h-4 w-4", config.color)} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{source.name}</p>
                        <p className="text-xs text-muted-foreground">{config.label}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="sr-only">Opções</span>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleRefreshSource(source.id)}>
                          <RefreshCw className="h-3.5 w-3.5 mr-2" />
                          Atualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.open(source.url, '_blank')}>
                          <ExternalLink className="h-3.5 w-3.5 mr-2" />
                          Abrir original
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDeleteSource(source.id)} className="text-destructive">
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                        {sourceItems.length}
                      </span>
                      <span>itens</span>
                    </div>
                    {unread > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-blue-400">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 font-medium">
                          {unread}
                        </span>
                        <span>novo</span>
                      </div>
                    )}
                    {source.lastFetchedAt && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                        <Clock className="h-3 w-3" />
                        {timeAgo(source.lastFetchedAt)}
                      </div>
                    )}
                    {refreshingId === source.id && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    )}
                  </div>

                  {source.error && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      {source.error}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar nos itens..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Todas as fontes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as fontes</SelectItem>
            {sources.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Todos status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="unread">Não lido</SelectItem>
            <SelectItem value="reading">Lendo</SelectItem>
            <SelectItem value="read">Lido</SelectItem>
            <SelectItem value="archived">Arquivado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/50 py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
            <Rss className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">
              {sources.length === 0
                ? 'Adicione sua primeira fonte de conteúdo'
                : 'Nenhum item encontrado'}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {sources.length === 0
                ? 'RSS, sites, newsletters, YouTube...'
                : 'Tente ajustar os filtros ou adicionar novos itens'}
            </p>
          </div>
          {sources.length === 0 && (
            <Button onClick={() => setShowAddSource(true)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar fonte
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filteredItems.map(item => {
              const source = sources.find(s => s.id === item.sourceId);
              const config = source ? getSourceTypeConfig(source.type) : null;
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <Card
                    className={cn(
                      "group relative overflow-hidden border-border/50 bg-card/50 hover:bg-card/80 transition-all cursor-pointer",
                      item.status === 'unread' && "border-l-2 border-l-blue-500"
                    )}
                    onClick={() => openReader(item)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Status dot */}
                        <div className="mt-1.5 shrink-0">
                          {item.status === 'unread' ? (
                            <Circle className="h-3 w-3 text-blue-500 fill-blue-500" />
                          ) : item.status === 'reading' ? (
                            <Clock className="h-3 w-3 text-yellow-500" />
                          ) : item.status === 'read' ? (
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          ) : (
                            <Archive className="h-3 w-3 text-gray-500" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {config && (
                              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", STATUS_COLORS[item.status])}>
                                <config.icon className={cn("h-2.5 w-2.5 mr-1", config.color)} />
                                {source?.name}
                              </Badge>
                            )}
                            {item.importance === 'high' && (
                              <Star className="h-3 w-3 text-orange-400 fill-orange-400" />
                            )}
                          </div>
                          <h3 className="text-sm font-semibold line-clamp-1">{item.title}</h3>
                          {item.excerpt && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.excerpt}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground/60">
                            {item.author && <span>{item.author}</span>}
                            {item.publishedAt && <span>{timeAgo(item.publishedAt)}</span>}
                            {item.tags && item.tags.length > 0 && (
                              <div className="flex gap-1">
                                {item.tags.slice(0, 3).map(tag => (
                                  <Badge key={tag} variant="outline" className="text-[9px] px-1 py-0">{tag}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                          {!item.linkedCaptureId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title="Capturar para INBOX"
                              onClick={(e) => { e.stopPropagation(); handleClipToInbox(item.id); }}
                            >
                              <Bookmark className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {item.linkedCaptureId && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-green-500/20 text-green-400">
                              ✓ INBOX
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title="Abrir link original"
                            onClick={(e) => { e.stopPropagation(); window.open(item.url, '_blank'); }}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add Source Dialog */}
      <Dialog open={showAddSource} onOpenChange={setShowAddSource}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rss className="h-5 w-5 text-orange-400" />
              Nova Fonte de Conteúdo
            </DialogTitle>
            <DialogDescription>
              Adicione um feed RSS, site, newsletter ou canal do YouTube.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome *</label>
              <Input
                placeholder="Ex: Blog do Android, Arco Bola..."
                value={newSource.name}
                onChange={e => setNewSource(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo *</label>
              <Select value={newSource.type} onValueChange={v => setNewSource(prev => ({ ...prev, type: v as ContentSource['type'] }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-2">
                        <t.icon className={cn("h-3.5 w-3.5", t.color)} />
                        {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">URL *</label>
              <Input
                placeholder={newSource.type === 'rss' ? 'https://exemplo.com/feed.xml' : 'https://exemplo.com'}
                value={newSource.url}
                onChange={e => setNewSource(prev => ({ ...prev, url: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Input
                placeholder="Opcional: breve descrição"
                value={newSource.description}
                onChange={e => setNewSource(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tags</label>
              <Input
                placeholder="Separadas por vírgula"
                value={newSource.tags}
                onChange={e => setNewSource(prev => ({ ...prev, tags: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSource(false)}>Cancelar</Button>
            <Button onClick={handleAddSource}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reader Dialog */}
      <Dialog open={showReader} onOpenChange={setShowReader}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8">{selectedItem.title}</DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  {selectedItem.author && <span>{selectedItem.author}</span>}
                  {selectedItem.publishedAt && <span>· {timeAgo(selectedItem.publishedAt)}</span>}
                </DialogDescription>
              </DialogHeader>

              {/* AI Insights */}
              {selectedItem.aiInsights && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Análise IA
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedItem.aiInsights.summary}</p>
                  {selectedItem.aiInsights.actionSuggestion && selectedItem.aiInsights.actionSuggestion !== 'dismiss' && (
                    <Badge variant="outline" className="text-xs">
                      <Zap className="h-3 w-3 mr-1" />
                      Sugerir: {selectedItem.aiInsights.actionSuggestion}
                    </Badge>
                  )}
                </div>
              )}

              {/* Excerpt */}
              {selectedItem.excerpt && (
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground italic">{selectedItem.excerpt}</p>
                </div>
              )}

              {/* Full Content */}
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div
                  className="text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: selectedItem.content }}
                />
              </div>

              {/* Actions */}
              <DialogFooter className="flex flex-row gap-2 sm:gap-2">
                {!selectedItem.linkedCaptureId && (
                  <Button variant="outline" onClick={() => handleClipToInbox(selectedItem.id)} className="gap-2">
                    <Bookmark className="h-4 w-4" />
                    Capturar no INBOX
                  </Button>
                )}
                <Button variant="outline" onClick={() => window.open(selectedItem.url, '_blank')} className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Abrir original
                </Button>
                <Button onClick={() => setShowReader(false)}>Fechar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}