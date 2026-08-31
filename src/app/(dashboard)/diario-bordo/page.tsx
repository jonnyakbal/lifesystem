'use client';

// Distinct from /diario (the personal daily journal) — this is the living
// technical/product logbook that used to live only in DIARIO_DE_BORDO.md.
// New entries can also be written by an external AI agent via the MCP
// tools (list_log_entries/create_log_entry/...), so the shape mirrors what
// src/lib/mcp/tools.ts registers for the 'log-entries' collection.
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ScrollText, Plus, Trash2, Pencil, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import { NotionEditor } from '@/components/notion-editor';
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

function todayStr() { return new Date().toISOString().split('T')[0]; }

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

  const grouped = useMemo(() => {
    const byYearMonth: { key: string; label: string; items: LogEntry[] }[] = [];
    for (const entry of entries) {
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
  }, [entries]);

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
    <div className="p-8 max-w-3xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight">
            <ScrollText className="h-7 w-7 text-primary" /> Diário de Bordo
          </h1>
          <p className="text-muted-foreground">Evolução técnica e de produto do LIFESYSTEM — stack, infra, segurança, decisões e roadmap.</p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nova entrada
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : entries.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Nenhuma entrada ainda. Registre a primeira evolução do sistema.</p>
      ) : (
        <div className="space-y-8">
          {grouped.map(group => (
            <div key={group.key}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h2>
              <div className="space-y-3">
                {group.items.map(entry => (
                  <motion.div key={entry.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="relative overflow-hidden">
                      <CardContent className="p-5">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div>
                            <div className="mb-1 flex items-center gap-2">
                              <Badge variant="outline" className={cn('text-xs', CATEGORY_CONFIG[entry.category].color)}>
                                {CATEGORY_CONFIG[entry.category].label}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{formatDate(entry.date)}</span>
                            </div>
                            <h3 className="font-medium">{entry.title}</h3>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
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
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1"
                          dangerouslySetInnerHTML={{ __html: entry.body }}
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
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar entrada' : 'Nova entrada no diário'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-3">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título da entrada"
                className="flex-1"
              />
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
            </div>
            <Select value={category} onValueChange={(v) => setCategory(v as LogEntryCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORY_CONFIG) as LogEntryCategory[]).map(cat => (
                  <SelectItem key={cat} value={cat}>{CATEGORY_CONFIG[cat].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <NotionEditor content={body} onChange={setBody} placeholder="O que mudou, por quê, e como..." />
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={!title.trim() || saving}>
              {editing ? 'Salvar' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
