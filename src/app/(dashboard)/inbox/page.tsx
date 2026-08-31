'use client';

// The fast, transient triage queue — separate from /notas (the permanent,
// deep knowledge hub). Everything here has status:'inbox': dumped quickly
// (Captura Rápida / ⌘K, or "Novo" below) and not yet looked at. Opening one
// takes you to /notas?open=<id> to actually write/organize it — the moment
// that page's autosave fires, the capture is promoted to a Note and
// disappears from here. No editor lives in this file on purpose.
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Trash2, Search, Inbox as InboxIcon, MoreHorizontal, CheckSquare,
  FolderKanban, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface Capture {
  id: string;
  content: string;
  title?: string;
  type: 'text' | 'link' | 'image' | 'audio';
  status: string;
  createdAt: string;
}

function getTitle(content: string): string {
  const text = content.replace(/<[^>]*>/g, '').trim();
  return text.split('\n')[0].slice(0, 80) || 'Sem título';
}

// Sticky-note look for the queue: each card gets a deterministic color +
// slight rotation from its own id (hash, not Math.random() — has to be the
// same on server and client render or React complains about a mismatch).
const STICKY_COLORS = [
  { bg: 'bg-yellow-100 dark:bg-yellow-950/40', border: 'border-yellow-300/50 dark:border-yellow-800/50' },
  { bg: 'bg-pink-100 dark:bg-pink-950/40', border: 'border-pink-300/50 dark:border-pink-800/50' },
  { bg: 'bg-blue-100 dark:bg-blue-950/40', border: 'border-blue-300/50 dark:border-blue-800/50' },
  { bg: 'bg-green-100 dark:bg-green-950/40', border: 'border-green-300/50 dark:border-green-800/50' },
  { bg: 'bg-orange-100 dark:bg-orange-950/40', border: 'border-orange-300/50 dark:border-orange-800/50' },
  { bg: 'bg-purple-100 dark:bg-purple-950/40', border: 'border-purple-300/50 dark:border-purple-800/50' },
];

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) { hash = ((hash << 5) - hash) + id.charCodeAt(i); hash |= 0; }
  return Math.abs(hash);
}

function getStickyStyle(id: string) {
  const h = hashId(id);
  const color = STICKY_COLORS[h % STICKY_COLORS.length];
  const rotation = (h % 5) - 2; // -2deg..2deg, subtle
  return { color, rotation };
}

const fade = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };
const stagger = { animate: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } } };

export default function InboxPage() {
  const router = useRouter();
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [quickTitle, setQuickTitle] = useState('');

  useEffect(() => { loadCaptures(); }, []);

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

  // Creates the capture then jumps straight into the Notas editor — same
  // "open it = it becomes a note" rule applies to brand-new ones too, not
  // just ones dumped elsewhere (⌘K).
  async function handleQuickAdd() {
    if (!quickTitle.trim()) return;
    try {
      const created = await apiFetch<Capture>('/api/captures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: quickTitle, type: 'text' }),
      });
      setQuickTitle('');
      router.push(`/notas?open=${created.id}`);
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/captures/${id}`, { method: 'DELETE' });
      loadCaptures();
      toast.success('Excluída');
    } catch (err) { toast.error(showError(err)); }
  }

  async function handleConvert(capture: Capture, targetType: 'task' | 'project') {
    try {
      const title = getTitle(capture.content);
      const created = targetType === 'task'
        ? await apiFetch<{ id: string }>('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, priority: 'normal', status: 'todo', sortOrder: 0, tags: [], checklist: [] }),
          })
        : await apiFetch<{ id: string }>('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: title, description: capture.content.replace(/<[^>]*>/g, '').slice(0, 300), status: 'idea', tags: [], needs: '', links: [], tasksCount: 0, tasksDone: 0 }),
          });
      await apiFetch(`/api/captures/${capture.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId: created.id, status: 'organized' }),
      });
      loadCaptures();
      toast.success(targetType === 'task' ? 'Virou tarefa!' : 'Virou projeto!');
    } catch (err) { toast.error(showError(err)); }
  }

  const queue = useMemo(() => captures.filter(c => c.status === 'inbox'), [captures]);

  const filtered = useMemo(() => {
    if (!search) return queue;
    const q = search.toLowerCase();
    return queue.filter(c => c.content.toLowerCase().includes(q));
  }, [queue, search]);

  return (
    <motion.div className="p-4 lg:p-8 max-w-4xl" variants={stagger} initial="initial" animate="animate">
      <motion.div className="mb-6" variants={fade}>
        <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-3">
          <InboxIcon className="h-7 w-7 text-primary" /> INBOX
        </h1>
        <p className="text-muted-foreground">Fila rápida — abra pra processar, vira Nota sozinho</p>
      </motion.div>

      <motion.div className="mb-6 flex max-w-xl gap-2" variants={fade}>
        <Input
          value={quickTitle}
          onChange={e => setQuickTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
          placeholder="Jogar uma ideia rápida aqui..."
          className="h-10"
        />
        <Button onClick={handleQuickAdd} disabled={!quickTitle.trim()} className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </motion.div>

      {queue.length > 0 && (
        <motion.div className="relative mb-6 max-w-xl" variants={fade}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar na fila..." className="pl-9 h-9" />
        </motion.div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
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
            <p className="mt-4 text-lg font-medium">INBOX vazia</p>
            <p className="text-sm text-muted-foreground">Tudo processado — bom trabalho.</p>
          </CardContent>
        </Card>
      ) : (
        <motion.div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" variants={stagger}>
          <AnimatePresence initial={false}>
            {filtered.map(capture => {
              const { color, rotation } = getStickyStyle(capture.id);
              return (
                <motion.div
                  key={capture.id}
                  variants={fade}
                  layout
                  exit={{ opacity: 0, scale: 0.9 }}
                  style={{ rotate: `${rotation}deg` }}
                  whileHover={{ rotate: 0, scale: 1.03 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <Card
                    className={cn(
                      'group relative min-h-[140px] cursor-pointer border shadow-md transition-shadow hover:shadow-xl',
                      color.bg, color.border,
                    )}
                    onClick={() => router.push(`/notas?open=${capture.id}`)}
                  >
                    <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-black/10 dark:hover:bg-white/10" onClick={e => e.stopPropagation()}>
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => handleConvert(capture, 'task')}>
                            <CheckSquare className="mr-2 h-4 w-4" /> Converter em Tarefa
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleConvert(capture, 'project')}>
                            <FolderKanban className="mr-2 h-4 w-4" /> Converter em Projeto
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(capture.id)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardContent className="flex h-full flex-col p-4">
                      <p className="line-clamp-4 flex-1 text-sm font-medium text-foreground/90">
                        {capture.title || getTitle(capture.content)}
                      </p>
                      <p className="mt-2 flex items-center gap-1 text-xs text-foreground/50">
                        {new Date(capture.createdAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </motion.div>
  );
}
