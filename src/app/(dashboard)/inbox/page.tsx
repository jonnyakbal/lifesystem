'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Inbox, ListChecks, MoreHorizontal, Plus, Search, Trash2, CheckCircle2, Rows3, Sparkles } from 'lucide-react';
import { apiFetch, showError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PixelSprite } from '@/components/brand/pixel-sprite';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CaptureConversionDialog } from '@/components/capture-conversion-dialog';
import { WeeklyReviewFlow } from '@/components/weekly-review-flow';
import { ClarifyCard, captureTitle, type ClarifyCapture } from '@/components/clarify-card';
import { toast } from 'sonner';

type Capture = ClarifyCapture;
interface Project { id: string; name: string; status?: string }
const typeLabels: Record<string, string> = { text: 'Ideia', link: 'Referência', image: 'Imagem', audio: 'Áudio' };

export default function InboxPage() {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [converting, setConverting] = useState<Capture | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [quickTitle, setQuickTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const saving = useRef(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [mode, setMode] = useState<'clarify' | 'list'>('clarify');
  const [clearedThisSession, setClearedThisSession] = useState(0);

  const loadCaptures = useCallback(async () => {
    setLoading(true); setLoadError('');
    try { setCaptures(await apiFetch<Capture[]>('/api/captures')); }
    catch (error) { setLoadError(showError(error)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    queueMicrotask(() => { void loadCaptures(); });
    void apiFetch<Project[]>('/api/projects').then(setProjects).catch(() => {});
  }, [loadCaptures]);

  async function addCapture() {
    if (!quickTitle.trim() || saving.current) return;
    saving.current = true; setAdding(true);
    try {
      const created = await apiFetch<Capture>('/api/captures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: quickTitle.trim(), type: 'text', status: 'inbox' }) });
      setCaptures(previous => [created, ...previous]); setQuickTitle(''); toast.success('Captura adicionada.');
    } catch (error) { toast.error(showError(error)); }
    finally { saving.current = false; setAdding(false); }
  }

  const queue = useMemo(() => captures.filter(capture => capture.status === 'inbox').sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [captures]);
  const query = search.trim().toLocaleLowerCase('pt-BR');
  const filtered = queue.filter(capture => `${capture.title || ''} ${(capture.content ?? '').replace(/<[^>]*>/g, '')}`.toLocaleLowerCase('pt-BR').includes(query));
  const showList = mode === 'list' || Boolean(query);

  function organized(id: string) {
    setCaptures(previous => previous.map(item => item.id === id ? { ...item, status: 'organized' } : item));
    setClearedThisSession(value => value + 1);
  }
  async function discard(capture: Capture) {
    try {
      await apiFetch(`/api/captures/${capture.id}`, { method: 'DELETE' });
      setCaptures(previous => previous.filter(item => item.id !== capture.id));
      toast('Captura descartada', { action: { label: 'Desfazer', onClick: async () => {
        try { const restored = await apiFetch<Capture>('/api/captures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: capture.content ?? '', title: capture.title, type: capture.type, status: 'inbox' }) }); setCaptures(previous => [restored, ...previous]); }
        catch (error) { toast.error(showError(error)); }
      } } });
    } catch (error) { toast.error(showError(error)); }
  }

  return <div className="inbox-page work-page mx-auto max-w-[1100px] p-4 pb-24 lg:p-8">
    <CaptureConversionDialog key={converting?.id || 'closed'} capture={converting} onClose={() => setConverting(null)} onConverted={() => { if (converting) organized(converting.id); void loadCaptures(); }} />

    <header className="inbox-head">
      <h1 className="font-display">Caixa de entrada</h1>
      {!loading && !loadError && <span className={cn('inbox-count', queue.length === 0 && 'is-zero')} aria-label={`${queue.length} para esclarecer`}>{queue.length === 0 ? 'zerada' : queue.length}</span>}
      <div className="inbox-head-actions">
        <div className="task-segmented" role="group" aria-label="Modo da caixa">
          <button type="button" aria-pressed={!showList} onClick={() => { setMode('clarify'); setSearch(''); }}><Sparkles className="h-4 w-4" /><span>Esclarecer</span></button>
          <button type="button" aria-pressed={showList} onClick={() => setMode('list')}><Rows3 className="h-4 w-4" /><span>Lista</span></button>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setReviewOpen(true)}><ListChecks className="h-4 w-4" />Revisão semanal</Button>
      </div>
    </header>

    <form onSubmit={event => { event.preventDefault(); void addCapture(); }} className="inbox-capture">
      <Plus className="h-4 w-4" />
      <input aria-label="Nova captura" value={quickTitle} onChange={event => setQuickTitle(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void addCapture(); } }} disabled={adding} placeholder="Jogar uma ideia rápida aqui..." />
      <Button type="submit" size="sm" disabled={!quickTitle.trim() || adding}>{adding ? 'Salvando…' : 'Capturar'}</Button>
    </form>

    {loading ? <Skeleton className="mt-6 h-72 rounded-2xl" /> : loadError ? <div className="mt-6 space-y-3"><p role="alert" className="text-sm text-destructive">Não foi possível carregar a fila. {loadError}</p><Button variant="outline" onClick={loadCaptures}>Tentar novamente</Button></div> : <>
      {(showList || queue.length > 0) && <div className="inbox-search"><Search className="h-4 w-4" /><input aria-label="Buscar na fila" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar na fila..." /></div>}

      {showList ? (filtered.length === 0 ? <div className="inbox-empty"><Inbox className="h-8 w-8" /><h2>{query ? 'Nenhuma captura encontrada' : 'Nada esperando decisão'}</h2>{query && <Button variant="outline" onClick={() => setSearch('')}>Limpar busca</Button>}</div> :
        <ul className="inbox-list">{filtered.map(capture => <li key={capture.id} className="inbox-row">
          <button type="button" aria-label={`Converter ${captureTitle(capture)}`} onClick={() => setConverting(capture)} className="inbox-row-main"><span className="inbox-row-title">{captureTitle(capture)}</span><span className="inbox-row-meta">{(capture.type && typeLabels[capture.type]) || 'Captura'} · {new Date(capture.createdAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span></button>
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Ações de ${captureTitle(capture)}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setConverting(capture)}>Converter captura…</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => void discard(capture)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </li>)}</ul>)
      : queue.length === 0 ? <section className="inbox-zero" aria-label="Caixa zerada">
          <div className="inbox-zero-orb" aria-hidden="true" />
          <CheckCircle2 className="h-9 w-9 skin-astral-only" /><PixelSprite name="rocket" className="retro-reward skin-retro-only" />
          <h2>Caixa zerada</h2>
          <p>{clearedThisSession > 0 ? `${clearedThisSession} ${clearedThisSession === 1 ? 'decisão tomada' : 'decisões tomadas'} agora. Cabeça livre.` : 'Nada esperando decisão. Capture qualquer coisa acima antes de esquecer.'}</p>
          <div className="flex flex-wrap justify-center gap-2"><Button variant="outline" asChild><Link href="/hoje">Ir para Hoje<ArrowRight className="h-4 w-4" /></Link></Button><Button variant="ghost" asChild><Link href="/tarefas">Ver tarefas</Link></Button></div>
        </section>
      : <ClarifyCard queue={queue} projects={projects} active={!reviewOpen && !converting}
          onOrganized={organized}
          onRemoved={id => { setCaptures(previous => previous.filter(item => item.id !== id)); setClearedThisSession(value => value + 1); }}
          onRestored={capture => setCaptures(previous => [capture, ...previous])} />}
    </>}

    <Dialog open={reviewOpen} onOpenChange={open => { setReviewOpen(open); if (!open) void loadCaptures(); }}><DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto"><DialogTitle className="sr-only">Revisão Semanal</DialogTitle><WeeklyReviewFlow embedded /></DialogContent></Dialog>
  </div>;
}
