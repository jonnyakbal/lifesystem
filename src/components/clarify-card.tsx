'use client';

// O "Esclarecer" do GTD, um item por vez: usado na Caixa de entrada e no
// primeiro passo da Revisão semanal. Mesmas decisões e teclas nos dois.
import { useEffect, useRef, useState } from 'react';
import { CheckSquare, FolderKanban, NotebookText, Shuffle, SkipForward, Trash2, Users, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { parseQuickAdd } from '@/lib/task-quick-add';
import { Button } from '@/components/ui/button';
import { CaptureConversionDialog } from '@/components/capture-conversion-dialog';

export interface ClarifyCapture { id: string; content?: string; title?: string; type?: 'text' | 'link' | 'image' | 'audio'; status: string; createdAt: string; }
interface Project { id: string; name: string; status?: string }
type Step = 'decide' | 'task' | 'waiting';

const typeLabels: Record<string, string> = { text: 'Ideia', link: 'Referência', image: 'Imagem', audio: 'Áudio' };
// Capturas vindas de integrações podem chegar sem texto.
export const captureTitle = (capture: ClarifyCapture) => capture.title || (capture.content ?? '').replace(/<[^>]*>/g, '').trim().split('\n')[0].slice(0, 100) || 'Sem título';
export const captureBody = (capture: ClarifyCapture) => (capture.content ?? '').replace(/<[^>]*>/g, ' ').trim();

export function ClarifyCard({ queue, projects, active = true, onOrganized, onRemoved, onRestored }: {
  /** Fila já ordenada; o cartão mostra o primeiro item não pulado. */
  queue: ClarifyCapture[];
  projects: Project[];
  /** Falso enquanto outro painel está por cima: as teclas não agem. */
  active?: boolean;
  onOrganized: (id: string) => void;
  onRemoved: (id: string) => void;
  onRestored: (capture: ClarifyCapture) => void;
}) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const [step, setStep] = useState<Step>('decide');
  const [taskText, setTaskText] = useState('');
  const [waitingFor, setWaitingFor] = useState('');
  const [deciding, setDeciding] = useState(false);
  const [converting, setConverting] = useState<ClarifyCapture | null>(null);

  // Pular manda o item para o fim da fila desta sessão, sem perder nada.
  const ordered = [...queue.filter(item => !skipped.includes(item.id)), ...skipped.map(id => queue.find(item => item.id === id)).filter((item): item is ClarifyCapture => Boolean(item))];
  const current = ordered[0];

  function resetStep() { setStep('decide'); setTaskText(''); setWaitingFor(''); }
  function done(id: string, message: string) {
    setSkipped(previous => previous.filter(item => item !== id));
    resetStep();
    onOrganized(id);
    toast.success(message);
  }
  async function discard(capture: ClarifyCapture) {
    try {
      await apiFetch(`/api/captures/${capture.id}`, { method: 'DELETE' });
      setSkipped(previous => previous.filter(item => item !== capture.id));
      resetStep();
      onRemoved(capture.id);
      toast('Captura descartada', { action: { label: 'Desfazer', onClick: async () => {
        try { onRestored(await apiFetch<ClarifyCapture>('/api/captures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: capture.content ?? '', title: capture.title, type: capture.type, status: 'inbox' }) })); }
        catch (error) { toast.error(showError(error)); }
      } } });
    } catch (error) { toast.error(showError(error)); }
  }
  async function convert(capture: ClarifyCapture, targetType: 'note' | 'task' | 'project', task?: Record<string, unknown>, message = 'Organizado.') {
    if (deciding) return;
    setDeciding(true);
    try {
      await apiFetch(`/api/captures/${capture.id}/convert`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetType, task }) });
      done(capture.id, message);
    } catch (error) { toast.error(showError(error)); }
    finally { setDeciding(false); }
  }
  function taskDetails(capture: ClarifyCapture) {
    const parsed = parseQuickAdd(taskText || captureTitle(capture), projects);
    return { title: parsed.title || captureTitle(capture), dueDate: parsed.dueDate, priority: parsed.priority, projectId: parsed.projectId, tags: parsed.tags.length ? parsed.tags : undefined };
  }
  const preview = current && step === 'task' ? parseQuickAdd(taskText || captureTitle(current), projects) : null;

  // Atalhos do Esclarecer: um toque por decisão.
  const keyRef = useRef<(event: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyRef.current = event => {
      if (!current || !active || step !== 'decide' || deciding || converting) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="menu"]')) return;
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

  if (!current) return null;
  // Mesmo mapa de teclas citado no Modo História (office/story/stage-props.tsx).
  const decisions = [
    { key: '1', icon: Trash2, label: 'Descartar', hint: 'Não serve mais', tone: 'muted', run: () => void discard(current) },
    { key: '2', icon: NotebookText, label: 'Guardar como nota', hint: 'Referência, sem ação', tone: 'muted', run: () => void convert(current, 'note', undefined, 'Guardado como nota.') },
    { key: '3', icon: Zap, label: 'Fazer agora', hint: 'Leva menos de 2 min', tone: 'go', run: () => void convert(current, 'task', { doneNow: true }, 'Feito! Registrado como concluído.') },
    { key: '4', icon: CheckSquare, label: 'Virar tarefa', hint: 'Uma próxima ação', tone: 'primary', run: () => { setStep('task'); setTaskText(captureTitle(current)); } },
    { key: '5', icon: Users, label: 'Delegar', hint: 'Fica aguardando alguém', tone: 'primary', run: () => setStep('waiting') },
    { key: '6', icon: FolderKanban, label: 'Virar projeto', hint: 'Vários passos', tone: 'primary', run: () => void convert(current, 'project', undefined, 'Virou projeto. Defina a próxima ação dele.') },
  ];

  return <>
    <CaptureConversionDialog key={converting?.id || 'closed'} capture={converting} onClose={() => setConverting(null)} onConverted={() => { if (converting) done(converting.id, 'Organizado.'); }} />
    <section className="inbox-card" aria-label="Esclarecer captura" key={current.id}>
      <div className="inbox-card-top"><span>{(current.type && typeLabels[current.type]) || 'Captura'} · {new Date(current.createdAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span><span>{ordered.length > 1 ? `mais ${ordered.length - 1} na fila` : 'último item'}</span></div>
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
    </section>
  </>;
}
