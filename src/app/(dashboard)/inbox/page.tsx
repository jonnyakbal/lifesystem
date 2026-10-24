'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Inbox, ListChecks, MoreHorizontal, Plus, Search, Trash2, CheckCircle2, NotebookText, Zap, CheckSquare, Users, FolderKanban, SkipForward, Rows3, Sparkles, Shuffle } from 'lucide-react';
import { apiFetch, showError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { parseQuickAdd } from '@/lib/task-quick-add';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CaptureConversionDialog } from '@/components/capture-conversion-dialog';
import { WeeklyReviewFlow } from '@/components/weekly-review-flow';
import { toast } from 'sonner';

interface Capture { id: string; content: string; title?: string; type: 'text' | 'link' | 'image' | 'audio'; status: string; createdAt: string; }
interface Project { id: string; name: string; status?: string }
type Step = 'decide' | 'task' | 'waiting';
const typeLabels = { text: 'Ideia', link: 'Referência', image: 'Imagem', audio: 'Áudio' };
const captureTitle = (capture: Capture) => capture.title || capture.content.replace(/<[^>]*>/g, '').trim().split('\n')[0].slice(0, 100) || 'Sem título';
const captureBody = (capture: Capture) => capture.content.replace(/<[^>]*>/g, ' ').trim();

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
  const [skipped, setSkipped] = useState<string[]>([]);
  const [step, setStep] = useState<Step>('decide');
  const [taskText, setTaskText] = useState('');
  const [waitingFor, setWaitingFor] = useState('');
  const [deciding, setDeciding] = useState(false);
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
  const filtered = queue.filter(capture => `${capture.title || ''} ${capture.content.replace(/<[^>]*>/g, '')}`.toLocaleLowerCase('pt-BR').includes(query));
  // Pular manda o item para o fim da fila desta sessão, sem perder nada.
  const ordered = [...queue.filter(item => !skipped.includes(item.id)), ...skipped.map(id => queue.find(item => item.id === id)).filter((item): item is Capture => Boolean(item))];
  const current = ordered[0];
  const showList = mode === 'list' || Boolean(query);

  function resetStep() { setStep('decide'); setTaskText(''); setWaitingFor(''); }
  function done(id: string, message: string) {
    setCaptures(previous => previous.map(item => item.id === id ? { ...item, status: 'organized' } : item));
    setSkipped(previous => previous.filter(item => item !== id));
    setClearedThisSession(value => value + 1);
    resetStep();
    toast.success(message);
  }
  async function discard(capture: Capture) {
    try {
      await apiFetch(`/api/captures/${capture.id}`, { method: 'DELETE' });
      setCaptures(previous => previous.filter(item => item.id !== capture.id));
      setSkipped(previous => previous.filter(item => item !== capture.id));
      setClearedThisSession(value => value + 1); resetStep();
      toast('Captura descartada', { action: { label: 'Desfazer', onClick: async () => {
        try { const restored = await apiFetch<Capture>('/api/captures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: capture.content, title: capture.title, type: capture.type, status: 'inbox' }) }); setCaptures(previous => [restored, ...previous]); }
        catch (error) { toast.error(showError(error)); }
      } } });
    } catch (error) { toast.error(showError(error)); }
  }
  async function convert(capture: Capture, targetType: 'note' | 'task' | 'project', task?: Record<string, unknown>, message = 'Organizado.') {
    if (deciding) return;
    setDeciding(true);
    try {
      await apiFetch(`/api/captures/${capture.id}/convert`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetType, task }) });
      done(capture.id, message);
    } catch (error) { toast.error(showError(error)); }
    finally { setDeciding(false); }
  }
  function taskDetails(capture: Capture) {
    const parsed = parseQuickAdd(taskText || captureTitle(capture), projects);
    return { title: parsed.title || captureTitle(capture), dueDate: parsed.dueDate, priority: parsed.priority, projectId: parsed.projectId, tags: parsed.tags.length ? parsed.tags : undefined };
  }
  const preview = current && step === 'task' ? parseQuickAdd(taskText || captureTitle(current), projects) : null;

  // Atalhos do Esclarecer: um toque por decisão.
  const keyRef = useRef<(event: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyRef.current = event => {
      if (!current || showList || step !== 'decide' || deciding || converting || reviewOpen) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]')) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const actions: Record<string, () => void> = {
        '1': () => void discard(current), '2': () => void convert(current, 'note', undefined, 'Guardado como nota.'),
        '3': () => void convert(current, 'task', { doneNow: true }, 'Feito! Registrado como concluído.'),
        '4': () => { setStep('task'); setTaskText(captureTitle(current)); }, '5': () => setStep('waiting'),
        '6': () => void convert(current, 'project', undefined, 'Virou projeto. Defina a próxima ação dele.'),
        '7': () => setConverting(current), s: () => setSkipped(previous => [...previous.filter(id => id !== current.id), current.id]),
      };
      const action = actions[event.key.toLowerCase()];
      if (action) { event.preventDefault(); action(); }
    };
  });
  useEffect(() => {
    const handler = (event: KeyboardEvent) => keyRef.current(event);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const decisions = current ? [
    { key: '1', icon: Trash2, label: 'Descartar', hint: 'Não serve mais', tone: 'muted', run: () => void discard(current) },
    { key: '2', icon: NotebookText, label: 'Guardar como nota', hint: 'Referência, sem ação', tone: 'muted', run: () => void convert(current, 'note', undefined, 'Guardado como nota.') },
    { key: '3', icon: Zap, label: 'Fazer agora', hint: 'Leva menos de 2 min', tone: 'go', run: () => void convert(current, 'task', { doneNow: true }, 'Feito! Registrado como concluído.') },
    { key: '4', icon: CheckSquare, label: 'Virar tarefa', hint: 'Uma próxima ação', tone: 'primary', run: () => { setStep('task'); setTaskText(captureTitle(current)); } },
    { key: '5', icon: Users, label: 'Delegar', hint: 'Fica aguardando alguém', tone: 'primary', run: () => setStep('waiting') },
    { key: '6', icon: FolderKanban, label: 'Virar projeto', hint: 'Vários passos', tone: 'primary', run: () => void convert(current, 'project', undefined, 'Virou projeto. Defina a próxima ação dele.') },
  ] : [];

  return <div className="inbox-page work-page mx-auto max-w-[1100px] p-4 pb-24 lg:p-8">
    <CaptureConversionDialog key={converting?.id || 'closed'} capture={converting} onClose={() => setConverting(null)} onConverted={() => { if (converting) done(converting.id, 'Organizado.'); void loadCaptures(); }} />

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
          <button type="button" aria-label={`Converter ${captureTitle(capture)}`} onClick={() => setConverting(capture)} className="inbox-row-main"><span className="inbox-row-title">{captureTitle(capture)}</span><span className="inbox-row-meta">{typeLabels[capture.type] || 'Captura'} · {new Date(capture.createdAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span></button>
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Ações de ${captureTitle(capture)}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setConverting(capture)}>Converter captura…</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => void discard(capture)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </li>)}</ul>)
      : !current ? <section className="inbox-zero" aria-label="Caixa zerada">
          <div className="inbox-zero-orb" aria-hidden="true" />
          <CheckCircle2 className="h-9 w-9" />
          <h2>Caixa zerada</h2>
          <p>{clearedThisSession > 0 ? `${clearedThisSession} ${clearedThisSession === 1 ? 'decisão tomada' : 'decisões tomadas'} agora. Cabeça livre.` : 'Nada esperando decisão. Capture qualquer coisa acima antes de esquecer.'}</p>
          <div className="flex flex-wrap justify-center gap-2"><Button variant="outline" asChild><Link href="/hoje">Ir para Hoje<ArrowRight className="h-4 w-4" /></Link></Button><Button variant="ghost" asChild><Link href="/tarefas">Ver tarefas</Link></Button></div>
        </section>
      : <section className="inbox-card" aria-label="Esclarecer captura" key={current.id}>
          <div className="inbox-card-top"><span>{typeLabels[current.type] || 'Captura'} · {new Date(current.createdAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span><span>{ordered.length > 1 ? `mais ${ordered.length - 1} na fila` : 'último item'}</span></div>
          <h2 className="inbox-card-title">{captureTitle(current)}</h2>
          {captureBody(current) && captureBody(current) !== captureTitle(current) && <p className="inbox-card-body">{captureBody(current)}</p>}

          {step === 'decide' && <>
            <p className="inbox-question">O que é isso? Exige alguma ação?</p>
            <div className="inbox-decisions">{decisions.map(item => <button key={item.key} type="button" disabled={deciding} className={cn('inbox-decision', `is-${item.tone}`)} onClick={item.run}>
              <item.icon className="h-5 w-5" /><span><strong>{item.label}</strong><small>{item.hint}</small></span><kbd>{item.key}</kbd>
            </button>)}</div>
            <div className="inbox-card-foot">
              <button type="button" aria-label={`Converter ${captureTitle(current)}`} onClick={() => setConverting(current)}><Shuffle className="h-4 w-4" />Outro destino (conteúdo, edital, financeiro, evento)<kbd>7</kbd></button>
              <button type="button" onClick={() => setSkipped(previous => [...previous.filter(id => id !== current.id), current.id])}><SkipForward className="h-4 w-4" />Pular<kbd>S</kbd></button>
            </div>
          </>}

          {step === 'task' && <form className="inbox-step" onSubmit={event => { event.preventDefault(); void convert(current, 'task', taskDetails(current), 'Virou tarefa.'); }}>
            <label htmlFor="inbox-task-text">Qual é a próxima ação concreta?</label>
            <input id="inbox-task-text" autoFocus value={taskText} onChange={event => setTaskText(event.target.value)} placeholder="Verbo + o quê.  #projeto  !alta  @sex" />
            <div className="task-sheet-tokens">{preview?.labels.map(label => <span key={label}>{label}</span>)}{preview && !preview.dueDate && <span className="is-muted">sem prazo → backlog</span>}</div>
            <div className="inbox-step-actions"><Button type="button" variant="ghost" onClick={resetStep}>Voltar</Button><Button type="submit" disabled={deciding || !taskText.trim()}>Criar tarefa</Button></div>
          </form>}

          {step === 'waiting' && <form className="inbox-step" onSubmit={event => { event.preventDefault(); void convert(current, 'task', { ...taskDetails(current), waitingFor: waitingFor.trim() }, `Delegado. Aguardando ${waitingFor.trim()}.`); }}>
            <label htmlFor="inbox-waiting">Quem vai fazer?</label>
            <input id="inbox-waiting" autoFocus value={waitingFor} onChange={event => setWaitingFor(event.target.value)} placeholder="Nome da pessoa ou equipe" />
            <p className="inbox-step-hint">Vira uma tarefa em “Aguardando”. Ela aparece na Revisão de segunda para você cobrar.</p>
            <div className="inbox-step-actions"><Button type="button" variant="ghost" onClick={resetStep}>Voltar</Button><Button type="submit" disabled={deciding || !waitingFor.trim()}>Delegar</Button></div>
          </form>}
        </section>}
    </>}

    <Dialog open={reviewOpen} onOpenChange={open => { setReviewOpen(open); if (!open) void loadCaptures(); }}><DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto"><DialogTitle className="sr-only">Revisão Semanal</DialogTitle><WeeklyReviewFlow embedded /></DialogContent></Dialog>
  </div>;
}
