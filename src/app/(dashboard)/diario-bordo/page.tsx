'use client';

// Distinct from /diario (the personal daily journal) — this is the living
// technical/product logbook that used to live only in DIARIO_DE_BORDO.md.
// New entries can also be written by an external AI agent via the MCP
// tools (list_log_entries/create_log_entry/...), so the shape mirrors what
// src/lib/mcp/tools.ts registers for the 'log-entries' collection.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { ScrollText, Plus, Trash2, Pencil, MoreHorizontal, Search, ArrowRight, BookOpen } from 'lucide-react';
import { cn, sanitizeHtml, todayStr } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import { NotionEditor } from '@/components/notion-editor';
import { WorkspaceHeading, WorkspaceMetric } from '@/components/workspace/workspace-heading';
import type { LogEntry, LogEntryCategory } from '@/types';

const CATEGORY_CONFIG: Record<LogEntryCategory, { label: string; color: string }> = {
  stack: { label: 'Stack', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  infra: { label: 'Infra', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  deploy: { label: 'Deploy', color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' },
  seguranca: { label: 'Segurança', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  testes: { label: 'Testes', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  produto: { label: 'Produto', color: 'bg-primary/10 text-primary border-primary/20' },
  roadmap: { label: 'Roadmap', color: 'bg-money/10 text-money border-money/20' },
  geral: { label: 'Geral', color: 'bg-muted text-muted-foreground border-transparent' },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function DiarioBordoPage() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<LogEntryCategory>('geral');
  const [date, setDate] = useState(todayStr());
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<LogEntryCategory | 'all'>('all');

  useEffect(() => { loadEntries(); }, []);

  async function loadEntries() {
    try {
      const data = await apiFetch<LogEntry[]>('/api/log-entries');
      setEntries(data);
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setLoading(false);
    }
  }

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return entries.filter(entry => (filterCategory === 'all' || entry.category === filterCategory) && (!query || `${entry.title} ${entry.body.replace(/<[^>]*>/g, ' ')}`.toLocaleLowerCase('pt-BR').includes(query)))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, search, filterCategory]);

  const grouped = useMemo(() => {
    const byYearMonth: { key: string; label: string; items: LogEntry[] }[] = [];
    for (const entry of filteredEntries) {
      const d = new Date(entry.date + 'T12:00:00');
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      let group = byYearMonth.find(g => g.key === key);
      if (!group) {
        group = { key, label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }), items: [] };
        byYearMonth.push(group);
      }
      group.items.push(entry);
    }
    return byYearMonth;
  }, [filteredEntries]);

  function openCreate() {
    setEditing(null);
    setTitle('');
    setCategory('geral');
    setDate(todayStr());
    setBody('');
    setDialogOpen(true);
  }

  function openEdit(entry: LogEntry) {
    setEditing(entry);
    setTitle(entry.title);
    setCategory(entry.category);
    setDate(entry.date);
    setBody(entry.body);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/api/log-entries/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim(), category, date, body }),
        });
        toast.success('Entrada atualizada!');
      } else {
        await apiFetch('/api/log-entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim(), category, date, body }),
        });
        toast.success('Entrada registrada!');
      }
      setDialogOpen(false);
      loadEntries();
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entry: LogEntry) {
    try {
      await apiFetch(`/api/log-entries/${entry.id}`, { method: 'DELETE' });
      setEntries(prev => prev.filter(e => e.id !== entry.id));
      toast.success('Entrada removida.');
    } catch (err) {
      toast.error(showError(err));
    }
  }

  return (
    <div className="work-page max-w-6xl p-4 lg:p-8">
      <WorkspaceHeading eyebrow="Memória do sistema" title="Diário de Bordo" description="O caminho que o LIFESYSTEM percorreu. Registre decisões, aprendizados e mudanças para entender de onde veio o próximo passo." actions={<>
        <Link href="/hermes" className="work-action-link">Hermes <ArrowRight className="h-4 w-4" /></Link>
        <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Nova entrada</Button>
      </>}>
        <div className="work-metrics">
          <WorkspaceMetric label="Registros" value={loading ? '—' : entries.length} detail="Decisões e evoluções preservadas" tone="primary" />
          <WorkspaceMetric label="Neste mês" value={loading ? '—' : entries.filter(entry => entry.date.startsWith(todayStr().slice(0, 7))).length} detail="O que está mudando agora" />
          <WorkspaceMetric label="Frentes registradas" value={new Set(entries.map(entry => entry.category)).size} detail="Produto, infraestrutura e próximos passos" />
        </div>
      </WorkspaceHeading>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Buscar no diário de bordo" placeholder="Buscar uma decisão ou aprendizado..." value={search} onChange={event => setSearch(event.target.value)} className="h-11 pl-9" />
        </div>
        <Link href="/diario" className="inline-flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"><BookOpen className="h-3.5 w-3.5" /> Diário pessoal <ArrowRight className="h-3 w-3" /></Link>
      </div>
      <div className="work-stage-tabs" aria-label="Categorias do diário de bordo">
        <button aria-pressed={filterCategory === 'all'} onClick={() => setFilterCategory('all')}>Todas <span>{entries.length}</span></button>
        {(Object.keys(CATEGORY_CONFIG) as LogEntryCategory[]).map(category => <button key={category} aria-pressed={filterCategory === category} onClick={() => setFilterCategory(category)}>{CATEGORY_CONFIG[category].label}</button>)}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : entries.length === 0 ? (
        <div className="work-empty"><ScrollText className="h-8 w-8 text-primary" /><h2 className="font-display text-2xl">Toda evolução tem uma história</h2><span>Registre o que mudou, por quê e o que você aprendeu.</span><Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Registrar primeira entrada</Button></div>
      ) : filteredEntries.length === 0 ? (
        <div className="work-empty"><Search className="h-7 w-7 text-muted-foreground" /><h2 className="font-display text-2xl">Nenhum registro encontrado</h2><span>Experimente outra busca ou veja todas as categorias.</span><Button variant="outline" onClick={() => { setSearch(''); setFilterCategory('all'); }}>Limpar filtros</Button></div>
      ) : (
        <div className="space-y-8">
          {grouped.map(group => (
            <div key={group.key}>
              <h2 className="mb-5 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-primary" />{group.label}<span className="h-px flex-1 bg-border/60" /></h2>
              <div className="space-y-4 border-l border-border/60 pl-4 sm:pl-6">
                {group.items.map(entry => (
                  <motion.div key={entry.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="work-item-card relative overflow-hidden">
                      <CardContent className="p-5 sm:p-6">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={cn('text-xs', (CATEGORY_CONFIG[entry.category] ?? CATEGORY_CONFIG.geral).color)}>
                                {(CATEGORY_CONFIG[entry.category] ?? CATEGORY_CONFIG.geral).label}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{formatDate(entry.date)}</span>
                            </div>
                            <h3 className="work-card-title font-display text-xl sm:text-2xl"><button type="button" aria-label={`Abrir entrada ${entry.title}`} onClick={() => openEdit(entry)} className="w-full text-left focus-visible:outline-2 focus-visible:outline-primary">{entry.title}</button></h3>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                          <Button variant="ghost" size="icon" className="hidden h-11 w-11 text-muted-foreground sm:inline-flex" aria-label={`Editar entrada ${entry.title}`} onClick={() => openEdit(entry)}><Pencil className="h-4 w-4" /></Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button aria-label={`Opções da entrada ${entry.title}`} variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-muted-foreground">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(entry)}>
                                <Pencil className="mr-2 h-4 w-4" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(entry)} className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Apagar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          </div>
                        </div>
                        <div
                          className="prose prose-sm dark:prose-invert mt-4 max-w-none break-words text-sm leading-relaxed text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_pre]:max-w-full [&_pre]:overflow-x-auto"
                           dangerouslySetInnerHTML={{ __html: sanitizeHtml(entry.body) }}
                        />
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar entrada' : 'Nova entrada no diário'}</DialogTitle>
            <DialogDescription>Guarde a mudança, o motivo e o próximo passo.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-2" data-lenis-prevent>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
              <Input
                aria-label="Título da entrada"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título da entrada"
                className="flex-1"
              />
              <Input aria-label="Data da entrada" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <Select value={category} onValueChange={(v) => setCategory(v as LogEntryCategory)}>
              <SelectTrigger aria-label="Categoria da entrada"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORY_CONFIG) as LogEntryCategory[]).map(cat => (
                  <SelectItem key={cat} value={cat}>{CATEGORY_CONFIG[cat].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <NotionEditor content={body} onChange={setBody} placeholder="O que mudou, por quê, e como..." />
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!title.trim() || !date || saving}>
              {saving ? 'Salvando...' : editing ? 'Salvar' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
