'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Inbox, ListChecks, MoreHorizontal, Plus, Search, Trash2, CheckCircle2 } from 'lucide-react';
import { apiFetch, showError } from '@/lib/api';
import { WorkspaceHeading, WorkspaceMetric } from '@/components/workspace/workspace-heading';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CaptureConversionDialog } from '@/components/capture-conversion-dialog';
import { WeeklyReviewFlow } from '@/components/weekly-review-flow';
import { toast } from 'sonner';

interface Capture { id: string; content: string; title?: string; type: 'text' | 'link' | 'image' | 'audio'; status: string; createdAt: string; }
const typeLabels = { text: 'Ideia', link: 'Referência', image: 'Imagem', audio: 'Áudio' };
const captureTitle = (capture: Capture) => capture.title || capture.content.replace(/<[^>]*>/g, '').trim().split('\n')[0].slice(0, 100) || 'Sem título';

export default function InboxPage() {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [converting, setConverting] = useState<Capture | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [quickTitle, setQuickTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const saving = useRef(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewFresh, setReviewFresh] = useState(false);
  const loadCaptures = useCallback(async () => {
    setLoading(true); setLoadError('');
    try { setCaptures(await apiFetch<Capture[]>('/api/captures')); }
    catch (error) { setLoadError(showError(error)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    queueMicrotask(() => {
      void loadCaptures();
      refreshReview();
    });
  }, [loadCaptures]);

  function refreshReview() {
    try {
      const completed = localStorage.getItem('lifesystem-last-weekly-review');
      const age = completed ? Date.now() - new Date(completed).getTime() : Infinity;
      setReviewFresh(age >= 0 && age < 7 * 86400000);
    } catch { /* A revisão também funciona sem armazenamento do navegador. */ }
  }

  async function addCapture() {
    if (!quickTitle.trim() || saving.current) return;
    saving.current = true; setAdding(true);
    try {
      const created = await apiFetch<Capture>('/api/captures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: quickTitle.trim(), type: 'text', status: 'inbox' }) });
      setCaptures(previous => [created, ...previous]); setQuickTitle(''); toast.success('Captura adicionada.');
    } catch (error) { toast.error(showError(error)); }
    finally { saving.current = false; setAdding(false); }
  }
  async function deleteCapture(id: string) {
    try { await apiFetch(`/api/captures/${id}`, { method: 'DELETE' }); setCaptures(previous => previous.filter(capture => capture.id !== id)); toast.success('Captura excluída.'); }
    catch (error) { toast.error(showError(error)); }
  }
  const queue = captures.filter(capture => capture.status === 'inbox').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const query = search.trim().toLocaleLowerCase('pt-BR');
  const filtered = queue.filter(capture => `${capture.title || ''} ${capture.content.replace(/<[^>]*>/g, '')}`.toLocaleLowerCase('pt-BR').includes(query));

  return <div className="work-page mx-auto max-w-[1400px] space-y-6 p-4 pb-24 lg:p-8">
    <CaptureConversionDialog key={converting?.id || 'closed'} capture={converting} onClose={() => setConverting(null)} onConverted={loadCaptures} />
    <WorkspaceHeading eyebrow="Capturar" title="Caixa de entrada" description="Tire da cabeça. Depois, escolha um destino: nota, tarefa, conteúdo, financeiro, evento ou projeto." actions={<Button variant="outline" asChild><Link href="/notas">Minha biblioteca<ArrowRight className="h-4 w-4" /></Link></Button>}>
      <div className="flex flex-wrap gap-6"><WorkspaceMetric label="Para decidir" value={loading || loadError ? '—' : queue.length} detail="Ideias esperando um próximo passo" tone="primary" /><WorkspaceMetric label="Sua revisão" value={reviewFresh ? 'Em dia' : 'No seu ritmo'} detail="Um ritual curto para ajustar a direção" /></div>
    </WorkspaceHeading>
    <form onSubmit={event => { event.preventDefault(); void addCapture(); }} className="rounded-2xl border bg-card p-4 sm:p-5">
      <label htmlFor="inbox-quick-capture" className="mb-3 block text-sm font-medium">O que não pode se perder?</label>
      <div className="flex flex-wrap gap-2"><Input id="inbox-quick-capture" value={quickTitle} onChange={event => setQuickTitle(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void addCapture(); } }} disabled={adding} placeholder="Jogar uma ideia rápida aqui..." className="min-w-0 flex-1 basis-48" /><Button type="submit" disabled={!quickTitle.trim() || adding}><Plus className="h-4 w-4" />{adding ? 'Salvando…' : 'Adicionar'}</Button></div>
    </form>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="relative min-w-0 flex-1 basis-64"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar na fila" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar na fila..." className="pl-9" /></div>
      <Button variant="ghost" onClick={() => setReviewOpen(true)}>{reviewFresh ? <CheckCircle2 className="h-4 w-4 text-money" /> : <ListChecks className="h-4 w-4 text-primary" />}{reviewFresh ? 'Revisão em dia' : 'Revisar a semana'}<ArrowRight className="h-4 w-4" /></Button>
    </div>
    {loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(index => <Skeleton key={index} className="h-48 rounded-2xl" />)}</div> : loadError ? <Card><CardContent className="space-y-3 py-8"><p role="alert" className="text-sm text-destructive">Não foi possível carregar a fila. {loadError}</p><Button variant="outline" onClick={loadCaptures}>Tentar novamente</Button></CardContent></Card> : filtered.length === 0 ? <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center"><Inbox className="mb-4 h-8 w-8 text-primary/60" /><h2 className="font-display text-2xl">{query ? 'Nenhuma captura encontrada' : 'Espaço para a próxima ideia'}</h2><p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{query ? 'Tente outro termo. Suas capturas continuam na fila.' : 'Nada esperando uma decisão. Use o campo acima para guardar algo antes de esquecer.'}</p>{query && <Button className="mt-5" variant="outline" onClick={() => setSearch('')}>Limpar busca</Button>}</div> : <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">{filtered.map(capture => <article key={capture.id} className="group flex min-w-0 flex-col rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40">
      <div className="mb-4 flex items-center justify-between gap-2"><span className="rounded-full bg-primary/8 px-2.5 py-1 text-xs text-primary">{typeLabels[capture.type] || 'Captura'}</span><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Ações de ${captureTitle(capture)}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setConverting(capture)}>Converter captura…</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => deleteCapture(capture.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
      <button type="button" aria-label={`Converter ${captureTitle(capture)}`} onClick={() => setConverting(capture)} className="flex flex-1 flex-col text-left focus-visible:outline-2 focus-visible:outline-primary"><h2 className="work-card-title mb-3 break-words text-lg font-medium">{captureTitle(capture)}</h2><p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{capture.content.replace(/<[^>]*>/g, '').trim()}</p><span className="mt-6 flex w-full flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground"><span>{new Date(capture.createdAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span><span className="flex min-h-7 items-center gap-2 text-primary">Escolher destino<ArrowRight className="h-3.5 w-3.5" /></span></span></button>
    </article>)}</div>}
    <Dialog open={reviewOpen} onOpenChange={open => { setReviewOpen(open); if (!open) { void loadCaptures(); refreshReview(); } }}><DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto"><DialogTitle className="sr-only">Revisão Semanal</DialogTitle><WeeklyReviewFlow embedded /></DialogContent></Dialog>
  </div>;
}
