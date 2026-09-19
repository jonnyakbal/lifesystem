'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Search, Rss, RefreshCw, ExternalLink, Star, Archive, ArchiveRestore, Bookmark,
  ChevronLeft, ChevronRight, Loader2, AlertTriangle, Settings2, Trash2, Inbox, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { apiFetch, showError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContentSource {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
  lastFetchedAt?: string;
  fetchStatus: 'idle' | 'fetching' | 'success' | 'error';
  error?: string;
  itemCount: number;
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
  status: 'unread' | 'reading' | 'read' | 'archived';
  importance: 'low' | 'normal' | 'high';
  linkedCaptureId?: string;
  contentExtracted?: boolean;
  extractFailed?: boolean;
}

type Tab = 'unread' | 'starred' | 'all' | 'archived';

const TABS: { id: Tab; label: string }[] = [
  { id: 'unread', label: 'Não lidos' },
  { id: 'starred', label: 'Estrelas' },
  { id: 'all', label: 'Todos' },
  { id: 'archived', label: 'Arquivo' },
];

const STALE_AFTER_MS = 60 * 60 * 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateString?: string): string {
  if (!dateString) return '';
  const minutes = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(dateString).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function itemDate(item: ContentItem): number {
  return new Date(item.publishedAt ?? item.fetchedAt).getTime();
}

function readMinutes(text: string): number {
  return Math.max(1, Math.round(text.split(/\s+/).length / 200));
}

function isUnread(item: ContentItem) {
  return item.status === 'unread' || item.status === 'reading';
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContentHubPage() {
  const [sources, setSources] = useState<ContentSource[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('unread');
  const [filterSource, setFilterSource] = useState('all');
  const [search, setSearch] = useState('');
  const [readerId, setReaderId] = useState<string | null>(null);
  const [navIds, setNavIds] = useState<string[]>([]);
  const [extracting, setExtracting] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [refreshing, setRefreshing] = useState<Set<string>>(new Set());
  const autoRefreshed = useRef(false);

  const loadData = useCallback(async () => {
    try {
      const [sourcesData, itemsData] = await Promise.all([
        apiFetch<ContentSource[]>('/api/content-hub/sources'),
        apiFetch<ContentItem[]>('/api/content-hub/items'),
      ]);
      const known = new Set(sourcesData.map(src => src.id));
      setSources(sourcesData);
      setItems(itemsData.filter(item => known.has(item.sourceId)));
      return sourcesData;
    } catch (err) {
      toast.error(showError(err));
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Refresh ────────────────────────────────────────────────────────────────

  const refreshSource = useCallback(async (id: string, quiet = false): Promise<number> => {
    setRefreshing(prev => new Set(prev).add(id));
    try {
      const result = await apiFetch<{ fetched: number; items: ContentItem[] }>(
        `/api/content-hub/sources/${id}/refresh`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ maxItems: 30 }) },
      );
      if (result.items.length > 0) setItems(prev => [...result.items, ...prev]);
      if (!quiet) {
        if (result.fetched > 0) toast.success(`${result.fetched} ${result.fetched === 1 ? 'item novo' : 'itens novos'}`);
        else toast.info('Nada novo por enquanto');
      }
      return result.fetched;
    } catch (err) {
      if (!quiet) toast.error(showError(err));
      return 0;
    } finally {
      setRefreshing(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  }, []);

  const refreshMany = useCallback(async (list: ContentSource[], quiet: boolean) => {
    let total = 0;
    for (const source of list) total += await refreshSource(source.id, true);
    setSources(await apiFetch<ContentSource[]>('/api/content-hub/sources').catch(() => list));
    if (!quiet) toast[total > 0 ? 'success' : 'info'](total > 0 ? `${total} novos itens` : 'Nada novo por enquanto');
  }, [refreshSource]);

  useEffect(() => {
    (async () => {
      const loaded = await loadData();
      if (autoRefreshed.current) return;
      autoRefreshed.current = true;
      const stale = loaded.filter(s =>
        s.isActive && (!s.lastFetchedAt || Date.now() - new Date(s.lastFetchedAt).getTime() > STALE_AFTER_MS));
      if (stale.length > 0) refreshMany(stale, true);
    })();
  }, [loadData, refreshMany]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const sourceById = useMemo(() => new Map(sources.map(s => [s.id, s])), [sources]);

  const inSource = useMemo(
    () => (filterSource === 'all' ? items : items.filter(i => i.sourceId === filterSource)),
    [items, filterSource],
  );

  const counts = useMemo(() => ({
    unread: inSource.filter(i => i.status !== 'archived' && isUnread(i)).length,
    starred: inSource.filter(i => i.status !== 'archived' && i.importance === 'high').length,
    all: inSource.filter(i => i.status !== 'archived').length,
    archived: inSource.filter(i => i.status === 'archived').length,
  }), [inSource]);

  const unreadBySource = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of items) if (i.status !== 'archived' && isUnread(i)) map.set(i.sourceId, (map.get(i.sourceId) ?? 0) + 1);
    return map;
  }, [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inSource
      .filter(i => {
        if (tab === 'archived') return i.status === 'archived';
        if (i.status === 'archived') return false;
        if (tab === 'unread') return isUnread(i);
        if (tab === 'starred') return i.importance === 'high';
        return true;
      })
      .filter(i => !q || i.title.toLowerCase().includes(q) || i.excerpt?.toLowerCase().includes(q) || i.author?.toLowerCase().includes(q))
      .sort((a, b) => itemDate(b) - itemDate(a));
  }, [inSource, tab, search]);

  const readerIndex = readerId ? navIds.indexOf(readerId) : -1;
  const readerItem = readerId ? items.find(i => i.id === readerId) ?? null : null;

  // ── Item actions ───────────────────────────────────────────────────────────

  const patchItem = useCallback(async (id: string, patch: Partial<Pick<ContentItem, 'status' | 'importance'>>) => {
    const previous = items.find(i => i.id === id);
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)));
    try {
      await apiFetch<ContentItem>(`/api/content-hub/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
    } catch (err) {
      if (previous) setItems(prev => prev.map(i => (i.id === id ? previous : i)));
      toast.error(showError(err));
    }
  }, [items]);

  const toggleStar = (item: ContentItem) =>
    patchItem(item.id, { importance: item.importance === 'high' ? 'normal' : 'high' });

  const toggleArchive = (item: ContentItem) => {
    const archiving = item.status !== 'archived';
    patchItem(item.id, { status: archiving ? 'archived' : 'read' });
    if (archiving && readerId === item.id) {
      const nextId = navIds[readerIndex + 1] ?? navIds[readerIndex - 1] ?? null;
      setNavIds(prev => prev.filter(id => id !== item.id));
      setReaderId(nextId);
      const next = items.find(i => i.id === nextId);
      if (next && isUnread(next)) patchItem(next.id, { status: 'read' });
      if (next) maybeExtract(next);
    }
  };

  const clipToInbox = async (item: ContentItem) => {
    try {
      const result = await apiFetch<{ captureId: string }>(`/api/content-hub/items/${item.id}/clip`, { method: 'POST' });
      setItems(prev => prev.map(i => (i.id === item.id ? { ...i, linkedCaptureId: result.captureId } : i)));
      window.dispatchEvent(new Event('ls:counts:dirty'));
      toast.success('Enviado para o INBOX');
    } catch (err) {
      toast.error(showError(err));
    }
  };

  const maybeExtract = useCallback(async (item: ContentItem) => {
    const thin = item.content.length < 1500;
    if (!thin || item.contentExtracted || item.extractFailed) return;
    setExtracting(prev => new Set(prev).add(item.id));
    try {
      const full = await apiFetch<ContentItem>(`/api/content-hub/items/${item.id}/content`);
      setItems(prev => prev.map(i => (i.id === item.id
        ? { ...i, content: full.content, contentExtracted: full.contentExtracted, extractFailed: full.extractFailed }
        : i)));
    } catch {
      // sem texto completo: o leitor continua com o resumo do feed
    } finally {
      setExtracting(prev => { const next = new Set(prev); next.delete(item.id); return next; });
    }
  }, []);

  const openReader = (item: ContentItem) => {
    setNavIds(visible.map(i => i.id));
    setReaderId(item.id);
    if (isUnread(item)) patchItem(item.id, { status: 'read' });
    maybeExtract(item);
  };

  const stepReader = (delta: number) => {
    const nextId = navIds[readerIndex + delta];
    const next = items.find(i => i.id === nextId);
    if (!next) return;
    setReaderId(next.id);
    if (isUnread(next)) patchItem(next.id, { status: 'read' });
    maybeExtract(next);
  };

  // ── Sources ────────────────────────────────────────────────────────────────

  const removeSource = async (source: ContentSource) => {
    if (!window.confirm(`Remover "${source.name}" e os ${items.filter(i => i.sourceId === source.id).length} itens dela?`)) return;
    try {
      await apiFetch(`/api/content-hub/sources/${source.id}`, { method: 'DELETE' });
      setSources(prev => prev.filter(s => s.id !== source.id));
      setItems(prev => prev.filter(i => i.sourceId !== source.id));
      if (filterSource === source.id) setFilterSource('all');
      toast.success('Fonte removida');
    } catch (err) {
      toast.error(showError(err));
    }
  };

  const handleAdded = async (source: ContentSource) => {
    setSources(prev => [...prev, source]);
    setFilterSource('all');
    await refreshMany([source], false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4 lg:p-8">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-9 w-full" />
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  const anyRefreshing = refreshing.size > 0;
  const erroredSources = sources.filter(s => s.fetchStatus === 'error');

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight">Fontes &amp; Refs</h1>
          <p className="truncate text-sm text-muted-foreground">
            {sources.length === 0
              ? 'Tudo o que você lê, num lugar só'
              : `${counts.unread} não ${counts.unread === 1 ? 'lido' : 'lidos'} · ${sources.length} ${sources.length === 1 ? 'fonte' : 'fontes'}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {sources.length > 0 && (
            <Button
              variant="outline"
              size="icon"
              aria-label="Atualizar todas as fontes"
              disabled={anyRefreshing}
              onClick={() => refreshMany(sources.filter(s => s.isActive), false)}
            >
              <RefreshCw className={cn('h-4 w-4', anyRefreshing && 'animate-spin')} />
            </Button>
          )}
          <Button onClick={() => setShowAdd(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Fonte
          </Button>
        </div>
      </div>

      {sources.length === 0 ? (
        <EmptyState onAdd={() => setShowAdd(true)} />
      ) : (
        <>
          {/* Source chips */}
          <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0 [scrollbar-width:none]">
            <SourceChip active={filterSource === 'all'} onClick={() => setFilterSource('all')} label="Todas" count={items.filter(i => i.status !== 'archived' && isUnread(i)).length} />
            {sources.map(source => (
              <SourceChip
                key={source.id}
                active={filterSource === source.id}
                onClick={() => setFilterSource(source.id)}
                label={source.name}
                count={unreadBySource.get(source.id) ?? 0}
                warning={source.fetchStatus === 'error'}
                busy={refreshing.has(source.id)}
              />
            ))}
            <button
              onClick={() => setShowManage(true)}
              aria-label="Gerenciar fontes"
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-border px-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Settings2 className="h-3.5 w-3.5" /> Gerenciar
            </button>
          </div>

          {erroredSources.length > 0 && (
            <button
              onClick={() => setShowManage(true)}
              className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-xs text-amber-300"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {erroredSources.length === 1
                ? `"${erroredSources[0].name}" não atualizou. Toque para ver.`
                : `${erroredSources.length} fontes não atualizaram. Toque para ver.`}
            </button>
          )}

          {/* Tabs + search */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1 overflow-x-auto rounded-lg border bg-muted/30 p-0.5 [scrollbar-width:none]">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                    tab === t.id ? 'bg-secondary font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.label}
                  {counts[t.id] > 0 && <span className="font-mono-num text-xs opacity-60">{counts[t.id]}</span>}
                </button>
              ))}
            </div>
            <div className="relative sm:w-56">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="h-9 pl-9" />
            </div>
          </div>

          {/* List */}
          {visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 px-4 py-14 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                {search ? 'Nada bate com essa busca.' : tab === 'unread' ? 'Tudo lido por aqui.' : tab === 'starred' ? 'Nenhum item com estrela.' : tab === 'archived' ? 'Arquivo vazio.' : 'Nenhum item ainda.'}
              </p>
              {tab === 'unread' && !search && counts.all > 0 && (
                <Button variant="link" size="sm" onClick={() => setTab('all')}>Ver todos os itens</Button>
              )}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {visible.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  sourceName={sourceById.get(item.sourceId)?.name ?? ''}
                  onOpen={() => openReader(item)}
                  onStar={() => toggleStar(item)}
                  onArchive={() => toggleArchive(item)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      <AddSourceDialog open={showAdd} onOpenChange={setShowAdd} onAdded={handleAdded} />

      <ManageSourcesDialog
        open={showManage}
        onOpenChange={setShowManage}
        sources={sources}
        items={items}
        refreshing={refreshing}
        onRefresh={async id => { await refreshSource(id); setSources(await apiFetch<ContentSource[]>('/api/content-hub/sources')); }}
        onRemove={removeSource}
      />

      <Reader
        item={readerItem}
        sourceName={readerItem ? sourceById.get(readerItem.sourceId)?.name ?? '' : ''}
        position={readerIndex >= 0 ? `${readerIndex + 1} de ${navIds.length}` : ''}
        loadingFull={readerItem ? extracting.has(readerItem.id) : false}
        hasPrev={readerIndex > 0}
        hasNext={readerIndex >= 0 && readerIndex < navIds.length - 1}
        onStep={stepReader}
        onClose={() => setReaderId(null)}
        onStar={toggleStar}
        onArchive={toggleArchive}
        onClip={clipToInbox}
      />
    </div>
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border/60 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
        <Rss className="h-7 w-7 text-muted-foreground/60" />
      </div>
      <div>
        <p className="text-sm font-medium">Nenhuma fonte ainda</p>
        <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
          Cole o endereço de um site ou blog que você acompanha. O feed é encontrado sozinho.
        </p>
      </div>
      <Button onClick={onAdd} className="gap-1.5"><Plus className="h-4 w-4" /> Adicionar fonte</Button>
    </div>
  );
}

function SourceChip({ label, count, active, warning, busy, onClick }: {
  label: string; count: number; active: boolean; warning?: boolean; busy?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
        active ? 'border-primary/40 bg-primary/15 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : warning ? <AlertTriangle className="h-3 w-3 text-amber-400" /> : null}
      <span className="max-w-[10rem] truncate">{label}</span>
      {count > 0 && <span className="font-mono-num text-xs text-primary">{count}</span>}
    </button>
  );
}

function ItemRow({ item, sourceName, onOpen, onStar, onArchive }: {
  item: ContentItem; sourceName: string; onOpen: () => void; onStar: () => void; onArchive: () => void;
}) {
  const unread = isUnread(item);
  const starred = item.importance === 'high';
  const archived = item.status === 'archived';
  return (
    <li className="group relative">
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
        className={cn(
          'flex cursor-pointer gap-3 rounded-xl border p-3 pr-3 transition-colors hover:bg-card/80 sm:p-4',
          unread ? 'border-border bg-card/60' : 'border-border/40 bg-transparent',
        )}
      >
        <span className={cn('mt-2 h-2 w-2 shrink-0 rounded-full', unread ? 'bg-primary' : 'bg-transparent')} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate font-medium">{sourceName}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0">{timeAgo(item.publishedAt ?? item.fetchedAt)}</span>
            {item.linkedCaptureId && <Inbox className="h-3 w-3 shrink-0 text-money" aria-label="No INBOX" />}
          </div>
          <h3 className={cn('mt-1 line-clamp-2 text-[15px] leading-snug', unread ? 'font-semibold' : 'font-medium text-muted-foreground')}>
            {item.title}
          </h3>
          {item.excerpt && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground/80">{item.excerpt}</p>
          )}
          <div className="mt-2 flex items-center gap-1 sm:hidden" onClick={e => e.stopPropagation()}>
            <RowButton label={starred ? 'Tirar estrela' : 'Marcar com estrela'} onClick={onStar}>
              <Star className={cn('h-4 w-4', starred && 'fill-amber-400 text-amber-400')} />
            </RowButton>
            <RowButton label={archived ? 'Desarquivar' : 'Arquivar'} onClick={onArchive}>
              {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            </RowButton>
          </div>
        </div>
        {item.imageUrl && <Thumb src={item.imageUrl} />}
        <div className="hidden shrink-0 flex-col gap-1 self-start opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 sm:flex" onClick={e => e.stopPropagation()}>
          <RowButton label={starred ? 'Tirar estrela' : 'Marcar com estrela'} onClick={onStar}>
            <Star className={cn('h-4 w-4', starred && 'fill-amber-400 text-amber-400')} />
          </RowButton>
          <RowButton label={archived ? 'Desarquivar' : 'Arquivar'} onClick={onArchive}>
            {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </RowButton>
        </div>
        {starred && <Star className="absolute right-3 top-3 h-3.5 w-3.5 fill-amber-400 text-amber-400 group-hover:hidden" aria-hidden />}
      </div>
    </li>
  );
}

function RowButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:h-8 sm:w-8"
    >
      {children}
    </button>
  );
}

function Thumb({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="hidden h-16 w-16 shrink-0 rounded-lg object-cover sm:block sm:h-20 sm:w-28"
    />
  );
}

// ─── Reader ───────────────────────────────────────────────────────────────────

function Reader({ item, sourceName, position, loadingFull, hasPrev, hasNext, onStep, onClose, onStar, onArchive, onClip }: {
  item: ContentItem | null;
  sourceName: string;
  position: string;
  loadingFull: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onStep: (delta: number) => void;
  onClose: () => void;
  onStar: (item: ContentItem) => void;
  onArchive: (item: ContentItem) => void;
  onClip: (item: ContentItem) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const itemId = item?.id;

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [itemId]);

  useEffect(() => {
    if (!itemId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight' || e.key === 'j') onStep(1);
      if (e.key === 'ArrowLeft' || e.key === 'k') onStep(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [itemId, onStep]);

  const paragraphs = useMemo(
    () => (item?.content ?? '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean),
    [item?.content],
  );
  const showExcerptOnly = item ? !loadingFull && !item.contentExtracted && (item.content?.length ?? 0) < 600 : false;

  return (
    <Dialog open={Boolean(item)} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent
        className={cn(
          'flex max-h-dvh flex-col gap-0 p-0 sm:max-h-[90vh] sm:max-w-2xl',
          'max-sm:left-0 max-sm:top-0 max-sm:h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none',
        )}
      >
        {item && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>{item.title}</DialogTitle>
              <DialogDescription>Leitura de {sourceName}</DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-1 border-b px-3 py-2 pr-12">
              <Button variant="ghost" size="icon" className="h-9 w-9" disabled={!hasPrev} onClick={() => onStep(-1)} aria-label="Item anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9" disabled={!hasNext} onClick={() => onStep(1)} aria-label="Próximo item">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="ml-1 text-xs text-muted-foreground">{position}</span>
              <div className="ml-auto flex items-center">
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onStar(item)} aria-label={item.importance === 'high' ? 'Tirar estrela' : 'Marcar com estrela'}>
                  <Star className={cn('h-4 w-4', item.importance === 'high' && 'fill-amber-400 text-amber-400')} />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onArchive(item)} aria-label={item.status === 'archived' ? 'Desarquivar' : 'Arquivar'}>
                  {item.status === 'archived' ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
              <p className="text-xs text-muted-foreground">
                {[sourceName, item.author, timeAgo(item.publishedAt ?? item.fetchedAt), `${readMinutes(item.content || '')} min de leitura`].filter(Boolean).join(' · ')}
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold leading-tight sm:text-3xl">{item.title}</h2>

              {item.imageUrl && item.imageUrl !== failedImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setFailedImage(item.imageUrl ?? null)}
                  className="mt-5 max-h-72 w-full rounded-xl object-cover"
                />
              )}

              <div className="mt-5 space-y-4 font-display text-[17px] leading-[1.7] text-foreground/90">
                {paragraphs.map((p, i) => (
                  <p key={i} className="whitespace-pre-line break-words">{p}</p>
                ))}
              </div>

              {loadingFull && (
                <div className="mt-6 space-y-3" aria-live="polite">
                  <p className="text-xs text-muted-foreground">Buscando o texto completo…</p>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              )}

              {showExcerptOnly && (
                <p className="mt-6 rounded-lg bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  Essa fonte só publica o começo do texto no feed. Abra o original para ler completo.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <Button
                variant={item.linkedCaptureId ? 'ghost' : 'outline'}
                className="flex-1 gap-2 sm:flex-none"
                disabled={Boolean(item.linkedCaptureId)}
                onClick={() => onClip(item)}
              >
                {item.linkedCaptureId ? <Check className="h-4 w-4 text-money" /> : <Bookmark className="h-4 w-4" />}
                {item.linkedCaptureId ? 'No INBOX' : 'Guardar no INBOX'}
              </Button>
              <Button asChild className="flex-1 gap-2 sm:ml-auto sm:flex-none">
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> Abrir original
                </a>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialogs ──────────────────────────────────────────────────────────────────

function AddSourceDialog({ open, onOpenChange, onAdded }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (source: ContentSource) => Promise<void>;
}) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    let address = url.trim();
    if (!address) return;
    if (!/^https?:\/\//i.test(address)) address = `https://${address}`;
    setSaving(true);
    try {
      const source = await apiFetch<ContentSource>('/api/content-hub/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: address, name: name.trim() }),
      });
      setUrl('');
      setName('');
      onOpenChange(false);
      await onAdded(source);
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-sm:top-auto max-sm:bottom-0 max-sm:translate-y-0 max-sm:rounded-b-none">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Rss className="h-5 w-5 text-orange-400" /> Nova fonte</DialogTitle>
            <DialogDescription>Cole o endereço do site, blog ou feed. Eu procuro o RSS.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <label htmlFor="source-url" className="text-sm font-medium">Endereço</label>
            <Input id="source-url" autoFocus inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="css-tricks.com" value={url} onChange={e => setUrl(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="source-name" className="text-sm font-medium">Nome <span className="font-normal text-muted-foreground">(opcional)</span></label>
            <Input id="source-name" placeholder="Usa o nome do próprio feed" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving || !url.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Adicionar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManageSourcesDialog({ open, onOpenChange, sources, items, refreshing, onRefresh, onRemove }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: ContentSource[];
  items: ContentItem[];
  refreshing: Set<string>;
  onRefresh: (id: string) => void;
  onRemove: (source: ContentSource) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto max-sm:top-auto max-sm:bottom-0 max-sm:translate-y-0 max-sm:rounded-b-none">
        <DialogHeader>
          <DialogTitle>Gerenciar fontes</DialogTitle>
          <DialogDescription>Atualize, veja erros ou remova.</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2">
          {sources.map(source => {
            const count = items.filter(i => i.sourceId === source.id).length;
            return (
              <li key={source.id} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{source.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {count} {count === 1 ? 'item' : 'itens'}
                      {source.lastFetchedAt && ` · atualizada há ${timeAgo(source.lastFetchedAt)}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Atualizar ${source.name}`} disabled={refreshing.has(source.id)} onClick={() => onRefresh(source.id)}>
                    <RefreshCw className={cn('h-4 w-4', refreshing.has(source.id) && 'animate-spin')} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" aria-label={`Remover ${source.name}`} onClick={() => onRemove(source)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {source.fetchStatus === 'error' && source.error && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {source.error}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
