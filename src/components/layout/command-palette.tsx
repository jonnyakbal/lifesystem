'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import {
  Search, Inbox, Target, Layers, FolderKanban, CheckSquare,
  BarChart3, Wallet, BookOpen, FileText, Plus, ArrowRight, Command,
  Zap, Hash, Calendar, TrendingUp, Loader2, ListChecks
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CommandItem {
  id: string;
  label: string;
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
  category: string;
}

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  href: string;
  entity: string;
  entityLabel: string;
  entityColor: string;
}

const ENTITY_CONFIG: Record<string, {
  endpoint: string;
  label: string;
  color: string;
  icon: React.ElementType;
  getHref: (item: Record<string, unknown>) => string;
  getTitle: (item: Record<string, unknown>) => string;
  getSubtitle: (item: Record<string, unknown>) => string;
}> = {
  tasks: {
    endpoint: '/api/tasks',
    label: 'Tarefas',
    color: 'text-blue-500',
    icon: CheckSquare,
    getHref: (item) => `/tarefas?open=${item.id}`,
    getTitle: (item) => (item.title as string) || 'Sem título',
    getSubtitle: (item) => {
      const status = item.status as string;
      const priority = item.priority as string;
      const parts: string[] = [];
      if (priority === 'urgent') parts.push('Urgente');
      else if (priority === 'important') parts.push('Importante');
      if (status === 'done') parts.push('Concluída');
      else if (status === 'doing') parts.push('Em andamento');
      else if (status === 'review') parts.push('Revisão');
      return parts.join(' · ') || 'Pendente';
    },
  },
  captures: {
    endpoint: '/api/captures',
    label: 'Capturas',
    color: 'text-yellow-500',
    icon: Inbox,
    getHref: () => '/inbox',
    getTitle: (item) => (item.title as string) || (item.content as string)?.slice(0, 80) || 'Sem conteúdo',
    getSubtitle: (item) => (item.type as string) || 'texto',
  },
  content: {
    endpoint: '/api/content',
    label: 'Conteúdo',
    color: 'text-purple-500',
    icon: FileText,
    getHref: (item) => `/conteudo?open=${item.id}`,
    getTitle: (item) => (item.title as string) || 'Sem título',
    getSubtitle: (item) => {
      const channel = item.channel as string;
      const stage = item.stage as string;
      return [channel, stage].filter(Boolean).join(' · ') || 'Rascunho';
    },
  },
  journal: {
    endpoint: '/api/journal',
    label: 'Diário',
    color: 'text-emerald-500',
    icon: BookOpen,
    getHref: () => '/diario',
    getTitle: (item) => {
      const date = item.entryDate as string;
      if (date) {
        try {
          return new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          });
        } catch {
          return date;
        }
      }
      return 'Entrada sem data';
    },
    getSubtitle: (item) => {
      const content = (item.content as string) || '';
      return content.slice(0, 60) + (content.length > 60 ? '...' : '') || 'Vazio';
    },
  },
  projects: {
    endpoint: '/api/projects',
    label: 'Projetos',
    color: 'text-orange-500',
    icon: FolderKanban,
    getHref: (item) => `/projetos?open=${item.id}`,
    getTitle: (item) => (item.name as string) || 'Sem nome',
    getSubtitle: (item) => {
      const status = item.status as string;
      const tasksDone = item.tasksDone as number;
      const tasksCount = item.tasksCount as number;
      const statusLabel = status === 'active' ? 'Ativo' : status === 'development' ? 'Desenvolvimento' : status === 'paused' ? 'Pausado' : 'Ideia';
      return tasksCount > 0 ? `${statusLabel} · ${tasksDone}/${tasksCount} tarefas` : statusLabel;
    },
  },
  financial: {
    endpoint: '/api/financial',
    label: 'Financeiro',
    color: 'text-rose-500',
    icon: Wallet,
    getHref: () => '/financeiro',
    getTitle: (item) => (item.description as string) || (item.category as string) || 'Sem descrição',
    getSubtitle: (item) => {
      const amount = item.amount as number;
      const type = item.type as string;
      const prefix = type === 'income' ? '+' : '-';
      const formatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(amount || 0);
      return `${prefix} ${formatted}`;
    },
  },
};

const ENTITY_SLUG_MAP: Record<string, string> = {
  tarefas: 'tasks',
  inbox: 'captures',
  conteudo: 'content',
  diario: 'journal',
  projetos: 'projects',
  financeiro: 'financial',
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [quickCapture, setQuickCapture] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheRef = useRef<Map<string, SearchResult[]>>(new Map());

  const today = new Date().toISOString().split('T')[0];

  const commands: CommandItem[] = [
    { id: 'inbox', label: 'Ir para INBOX', icon: Inbox, shortcut: '⌘I', action: () => router.push('/inbox'), category: 'Navegação' },
    { id: 'visao', label: 'Ir para Visão', icon: Target, shortcut: '⌘V', action: () => router.push('/visao'), category: 'Navegação' },
    { id: 'pilares', label: 'Ir para Pilares', icon: Layers, shortcut: '⌘P', action: () => router.push('/pilares'), category: 'Navegação' },
    { id: 'projetos', label: 'Ir para Projetos', icon: FolderKanban, shortcut: '⌘J', action: () => router.push('/projetos'), category: 'Navegação' },
    { id: 'tarefas', label: 'Ir para Tarefas', icon: CheckSquare, shortcut: '⌘T', action: () => router.push('/tarefas'), category: 'Navegação' },
    { id: 'conteudo', label: 'Ir para Conteúdo', icon: FileText, shortcut: '⌘N', action: () => router.push('/conteudo'), category: 'Navegação' },
    { id: 'indicadores', label: 'Ir para Metas', icon: BarChart3, shortcut: '⌘D', action: () => router.push('/indicadores'), category: 'Navegação' },
    { id: 'financeiro', label: 'Ir para Financeiro', icon: Wallet, shortcut: '⌘F', action: () => router.push('/financeiro'), category: 'Navegação' },
    { id: 'diario', label: 'Ir para Diário', icon: BookOpen, shortcut: '⌘L', action: () => router.push('/diario'), category: 'Navegação' },
    { id: 'dashboard', label: 'Ir para Dashboard', icon: Zap, shortcut: '⌘H', action: () => router.push('/'), category: 'Navegação' },
    { id: 'hoje-nav', label: 'Ir para Hoje', icon: Calendar, shortcut: '⌘G', action: () => router.push('/hoje'), category: 'Navegação' },
    { id: 'revisao-nav', label: 'Ir para Revisão Semanal', icon: ListChecks, shortcut: '⌘R', action: () => router.push('/revisao'), category: 'Navegação' },
    { id: 'nova-tarefa', label: 'Criar nova tarefa', icon: Plus, action: () => { router.push('/tarefas'); }, category: 'Ações Rápidas' },
    { id: 'nova-captura', label: 'Criar nova captura', icon: Plus, action: () => { router.push('/inbox'); }, category: 'Ações Rápidas' },
    { id: 'nova-nota', label: 'Criar nova nota', icon: Plus, action: () => { router.push('/conteudo'); }, category: 'Ações Rápidas' },
    { id: 'nova-entrada-diario', label: 'Escrever no diário', icon: Plus, action: () => { router.push('/diario'); }, category: 'Ações Rápidas' },
    { id: 'hoje', label: 'Ir para hoje', icon: Calendar, action: () => { router.push('/hoje'); }, category: 'Atalhos' },
    { id: 'tarefas-atrasadas', label: 'Ver tarefas atrasadas', icon: TrendingUp, action: () => { router.push('/hoje'); }, category: 'Atalhos' },
  ];

  const filteredCommands = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  const executeCommand = useCallback((cmd: CommandItem) => {
    cmd.action();
    setOpen(false);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  const executeSearchResult = useCallback((result: SearchResult) => {
    router.push(result.href);
    setOpen(false);
    setQuery('');
    setSelectedIndex(0);
  }, [router]);

  async function performSearch(searchQuery: string) {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    const cached = cacheRef.current.get(searchQuery.toLowerCase());
    if (cached) {
      setSearchResults(cached);
      setHasSearched(true);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const entries = Object.entries(ENTITY_CONFIG);
      const promises = entries.map(async ([entityKey, config]) => {
        try {
          const res = await fetch(config.endpoint);
          if (!res.ok) return [];
          const data: Record<string, unknown>[] = await res.json();
          const q = searchQuery.toLowerCase();

          return data
            .filter((item) => {
              const searchableText = Object.values(item)
                .filter((v): v is string => typeof v === 'string')
                .join(' ')
                .toLowerCase();
              const tags = Array.isArray(item.tags)
                ? (item.tags as string[]).join(' ').toLowerCase()
                : '';
              return searchableText.includes(q) || tags.includes(q);
            })
            .slice(0, 5)
            .map((item) => ({
              id: `${entityKey}-${item.id}`,
              title: config.getTitle(item),
              subtitle: config.getSubtitle(item),
              icon: config.icon,
              href: config.getHref(item),
              entity: entityKey,
              entityLabel: config.label,
              entityColor: config.color,
            }));
        } catch {
          return [];
        }
      });

      const results = await Promise.all(promises);
      const allResults = results.flat();
      cacheRef.current.set(searchQuery.toLowerCase(), allResults);
      setSearchResults(allResults);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const allItems = hasSearched
    ? searchResults
    : [];

  const totalItems = allItems.length + filteredCommands.length;

  async function handleQuickCapture() {
    if (!quickCapture.trim()) return;
    setIsCapturing(true);
    const type = quickCapture.match(/^https?:\/\//) ? 'link' : 'text';
    await fetch('/api/captures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: quickCapture, type }),
    });
    setIsCapturing(false);
    setQuickCapture('');
    toast.success('Captura salva!');
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
        setQuery('');
        setSelectedIndex(0);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, totalItems - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        // Search results (allItems) occupy indices [0, allItems.length), and
        // command matches (filteredCommands) — which stay visible even while
        // searching, so "Ir para Financeiro" is still reachable when typing
        // "financeiro" — occupy the indices right after.
        if (selectedIndex < allItems.length) {
          if (allItems[selectedIndex]) executeSearchResult(allItems[selectedIndex]);
        } else {
          const cmd = filteredCommands[selectedIndex - allItems.length];
          if (cmd) executeCommand(cmd);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, totalItems, selectedIndex, hasSearched, allItems, filteredCommands, executeCommand, executeSearchResult]);

  const groupedResults = new Map<string, SearchResult[]>();
  allItems.forEach((r) => {
    const list = groupedResults.get(r.entityLabel) || [];
    list.push(r);
    groupedResults.set(r.entityLabel, list);
  });

  let flatIndex = 0;

  if (typeof document === 'undefined') return null;

  // Portaled to <body> so `fixed` positioning is relative to the real viewport,
  // not the ReactLenis smooth-scroll wrapper's transformed containing block.
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/70 backdrop-blur-sm"
            onClick={() => { setOpen(false); setQuery(''); }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            className="fixed left-1/2 top-[15%] z-[101] w-full max-w-lg -translate-x-1/2"
          >
            <div className="glass-strong rounded-2xl border border-border/50 shadow-2xl shadow-primary/5 overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
                {isSearching ? (
                  <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                ) : (
                  <Command className="h-4 w-4 text-muted-foreground" />
                )}
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar comandos, telas, entidades..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  ESC
                </kbd>
              </div>

              {/* Quick Capture */}
              <div className="border-b border-border/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary shrink-0" />
                  <input
                    value={quickCapture}
                    onChange={(e) => setQuickCapture(e.target.value)}
                    placeholder="Captura rápida (Enter para salvar)..."
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && quickCapture.trim()) {
                        e.preventDefault();
                        handleQuickCapture();
                      }
                    }}
                  />
                  {quickCapture.trim() && (
                    <kbd className="rounded border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-xs text-primary">
                      ↵
                    </kbd>
                  )}
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto p-2">
                {isSearching && (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Buscando em todas as entidades...</span>
                  </div>
                )}

                {!isSearching && hasSearched && allItems.length === 0 && filteredCommands.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum resultado encontrado
                  </div>
                )}

                {!isSearching && hasSearched && allItems.length > 0 && (
                  <>
                    {Array.from(groupedResults.entries()).map(([entityLabel, results]) => {
                      const config = Object.values(ENTITY_CONFIG).find(c => c.label === entityLabel);
                      const EntityIcon = config?.icon || FileText;
                      const entityColor = config?.color || 'text-muted-foreground';
                      return (
                        <div key={entityLabel} className="mb-2">
                          <div className={cn('px-3 py-1.5 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5', entityColor)}>
                            <EntityIcon className="h-3 w-3" />
                            {entityLabel}
                            <span className="text-muted-foreground/60 ml-1">({results.length})</span>
                          </div>
                          {results.map((result) => {
                            const idx = flatIndex++;
                            return (
                              <motion.button
                                key={result.id}
                                onClick={() => executeSearchResult(result)}
                                className={cn(
                                  'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
                                  idx === selectedIndex
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                )}
                                whileHover={{ x: 2 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                              >
                                <result.icon className={cn('h-4 w-4 shrink-0', entityColor)} />
                                <div className="flex-1 text-left min-w-0">
                                  <div className="truncate">{result.title}</div>
                                  {result.subtitle && (
                                    <div className="truncate text-xs text-muted-foreground/60">{result.subtitle}</div>
                                  )}
                                </div>
                                <ArrowRight className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100" />
                              </motion.button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </>
                )}

                {filteredCommands.length > 0 && (
                  <>
                    {(() => {
                      const groups = new Map<string, CommandItem[]>();
                      filteredCommands.forEach(cmd => {
                        const list = groups.get(cmd.category) || [];
                        list.push(cmd);
                        groups.set(cmd.category, list);
                      });
                      return Array.from(groups.entries()).map(([category, cmds]) => (
                        <div key={category} className="mb-1">
                          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
                            {category}
                          </div>
                          {cmds.map(cmd => {
                            const idx = flatIndex++;
                            return (
                              <motion.button
                                key={cmd.id}
                                onClick={() => executeCommand(cmd)}
                                className={cn(
                                  'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
                                  idx === selectedIndex
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                )}
                                whileHover={{ x: 2 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                              >
                                <cmd.icon className="h-4 w-4 shrink-0" />
                                <span className="flex-1 text-left">{cmd.label}</span>
                                {cmd.shortcut && (
                                  <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">
                                    {cmd.shortcut}
                                  </kbd>
                                )}
                              </motion.button>
                            );
                          })}
                        </div>
                      ));
                    })()}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-border/50 px-4 py-2 flex items-center gap-4 text-xs text-muted-foreground/60">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border bg-muted px-1 py-0.5">↑↓</kbd> navegar
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border bg-muted px-1 py-0.5">↵</kbd> selecionar
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border bg-muted px-1 py-0.5">esc</kbd> fechar
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
