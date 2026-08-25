'use client';

// Reusable "relations" panel — the Linear/Notion pattern of showing what an
// item points to ("Vinculados") plus what points back to it ("Referenciado
// por", computed by the caller, never stored — same as Obsidian backlinks).
// Used by Content, Capture, Task, and Project so cross-entity links (which
// the schema already supported via Content.linkedTaskIds/linkedProjectIds
// and Capture.targetId) actually show up somewhere.
import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, FolderKanban, FileText, Inbox, Plus, X, Search, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type LinkableType = 'task' | 'project' | 'content' | 'capture';

export interface LinkableItem {
  id: string;
  type: LinkableType;
  title: string;
  subtitle?: string;
}

const TYPE_CONFIG: Record<LinkableType, { label: string; icon: typeof CheckSquare; endpoint: string; color: string }> = {
  task: { label: 'Tarefa', icon: CheckSquare, endpoint: '/api/tasks', color: 'text-blue-500' },
  project: { label: 'Projeto', icon: FolderKanban, endpoint: '/api/projects', color: 'text-green-500' },
  content: { label: 'Conteúdo', icon: FileText, endpoint: '/api/content', color: 'text-purple-500' },
  capture: { label: 'Captura', icon: Inbox, endpoint: '/api/captures', color: 'text-yellow-500' },
};

function titleOf(type: LinkableType, item: any): string {
  if (type === 'task' || type === 'project' || type === 'content') return item.title || item.name || 'Sem título';
  if (type === 'capture') return item.title || (item.content as string)?.replace(/<[^>]*>/g, '').slice(0, 60) || 'Sem título';
  return 'Sem título';
}

interface LinkedItemsPanelProps {
  /** IDs this item currently links out to (per linkable type it's allowed to hold). */
  linkedIds: Partial<Record<LinkableType, string[]>>;
  onChange: (next: Partial<Record<LinkableType, string[]>>) => void;
  /** Which entity types can be searched/added as a link from here. */
  linkableTypes: LinkableType[];
  /** Items that point TO this one — computed by the caller (never stored). */
  backlinks?: LinkableItem[];
  /** Don't let an item link to itself. */
  excludeId?: string;
  className?: string;
  /** Hide the "Vinculados" editable section — used where an entity only
   * receives backlinks and doesn't store its own outgoing link array
   * (e.g. Task, Project in Phase 1). */
  readOnly?: boolean;
}

export function LinkedItemsPanel({ linkedIds, onChange, linkableTypes, backlinks = [], excludeId, className, readOnly }: LinkedItemsPanelProps) {
  const [cache, setCache] = useState<Record<LinkableType, any[]>>({} as any);
  const [loaded, setLoaded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      linkableTypes.map((t) => fetch(TYPE_CONFIG[t].endpoint).then((r) => r.json()).then((data) => [t, data] as const))
    ).then((entries) => {
      if (cancelled) return;
      const next = {} as Record<LinkableType, any[]>;
      for (const [t, data] of entries) next[t] = data;
      setCache(next);
      setLoaded(true);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkableTypes.join(',')]);

  const linked: LinkableItem[] = useMemo(() => {
    if (!loaded) return [];
    const out: LinkableItem[] = [];
    for (const type of linkableTypes) {
      const ids = linkedIds[type] || [];
      const items = cache[type] || [];
      for (const id of ids) {
        const item = items.find((i) => i.id === id);
        if (item) out.push({ id, type, title: titleOf(type, item) });
      }
    }
    return out;
  }, [linkedIds, cache, loaded, linkableTypes]);

  const searchResults: LinkableItem[] = useMemo(() => {
    if (!query.trim() || !loaded) return [];
    const q = query.toLowerCase();
    const out: LinkableItem[] = [];
    for (const type of linkableTypes) {
      const ids = new Set(linkedIds[type] || []);
      for (const item of cache[type] || []) {
        if (item.id === excludeId) continue;
        if (ids.has(item.id)) continue;
        const title = titleOf(type, item);
        if (title.toLowerCase().includes(q)) {
          out.push({ id: item.id, type, title });
          if (out.length >= 8) return out;
        }
      }
    }
    return out;
  }, [query, cache, loaded, linkableTypes, linkedIds, excludeId]);

  function addLink(item: LinkableItem) {
    const current = linkedIds[item.type] || [];
    onChange({ ...linkedIds, [item.type]: [...current, item.id] });
    setQuery('');
    setPickerOpen(false);
  }

  function removeLink(item: LinkableItem) {
    const current = linkedIds[item.type] || [];
    onChange({ ...linkedIds, [item.type]: current.filter((id) => id !== item.id) });
  }

  return (
    <div className={cn('space-y-3', className)}>
      {!readOnly && (
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Link2 className="h-3 w-3" /> Vinculados
          </span>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-xs text-muted-foreground">
                <Plus className="h-3 w-3" /> Adicionar
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-2 z-[200]">
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Buscar ${linkableTypes.map((t) => TYPE_CONFIG[t].label.toLowerCase()).join(', ')}...`}
                  className="h-8 pl-7 text-sm"
                />
              </div>
              <div className="max-h-56 overflow-y-auto">
                {!loaded ? (
                  <p className="px-2 py-3 text-center text-xs text-muted-foreground">Carregando...</p>
                ) : query.trim() && searchResults.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-muted-foreground">Nenhum resultado</p>
                ) : (
                  searchResults.map((item) => {
                    const Icon = TYPE_CONFIG[item.type].icon;
                    return (
                      <button
                        key={`${item.type}-${item.id}`}
                        type="button"
                        onClick={() => addLink(item)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60"
                      >
                        <Icon className={cn('h-3.5 w-3.5 shrink-0', TYPE_CONFIG[item.type].color)} />
                        <span className="truncate">{item.title}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        {linked.length === 0 ? (
          <p className="text-xs text-muted-foreground/60">Nenhum vínculo ainda.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {linked.map((item) => {
              const Icon = TYPE_CONFIG[item.type].icon;
              return (
                <span
                  key={`${item.type}-${item.id}`}
                  className="group flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-xs"
                >
                  <Icon className={cn('h-3 w-3', TYPE_CONFIG[item.type].color)} />
                  <span className="max-w-[160px] truncate">{item.title}</span>
                  <button type="button" onClick={() => removeLink(item)} className="opacity-40 hover:opacity-100">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>
      )}

      {backlinks.length > 0 && (
        <div>
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Link2 className="h-3 w-3 rotate-90" /> Referenciado por
          </span>
          <div className="flex flex-wrap gap-1.5">
            {backlinks.map((item) => {
              const Icon = TYPE_CONFIG[item.type].icon;
              return (
                <span
                  key={`back-${item.type}-${item.id}`}
                  className="flex items-center gap-1.5 rounded-md border border-border/40 bg-muted/20 px-2 py-1 text-xs text-muted-foreground"
                >
                  <Icon className={cn('h-3 w-3', TYPE_CONFIG[item.type].color)} />
                  <span className="max-w-[160px] truncate">{item.title}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
