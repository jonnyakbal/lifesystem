'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, Crosshair, Headphones, Pause, Play, Plus, RotateCcw, Send, X } from 'lucide-react';
import type { StageDef } from '@/types';
import { cn } from '@/lib/utils';
import { isTaskCompleted } from '@/lib/task-stages';
import { apiFetch, showError } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { type TaskListRecord, type TaskCellPatch } from './task-workspace-table';
import { TaskStructureSummary } from './task-structure-summary';

interface Props {
  allTasks?: TaskListRecord[];
  tasks: TaskListRecord[]; stages: StageDef[]; projects: { id: string; name: string }[]; pillars: { id: string; name: string }[];
  busyIds: Set<string>; onOpen: (id: string) => void; onComplete: (id: string) => void;
  onPatch: (id: string, patch: TaskCellPatch) => Promise<boolean>; onCreate: () => void;
  focusId?: string | null;
  onExit?: () => void;
}

const PRESETS = [{ label: '25 min', seconds: 25 * 60 }, { label: '50 min', seconds: 50 * 60 }, { label: 'Livre', seconds: 0 }];
const pad = (value: number) => String(Math.floor(value)).padStart(2, '0');
const clock = (seconds: number) => `${pad(seconds / 60)}:${pad(seconds % 60)}`;

/** Ruído marrom gerado no navegador: som ambiente sem arquivo nem serviço externo. */
function useAmbientNoise() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [on, setOn] = useState(false);
  const stop = useCallback(() => { void ctxRef.current?.close(); ctxRef.current = null; setOn(false); }, []);
  const start = useCallback(() => {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) { const white = Math.random() * 2 - 1; last = (last + 0.02 * white) / 1.02; data[i] = last * 3.2; }
    const source = ctx.createBufferSource(); source.buffer = buffer; source.loop = true;
    const gain = ctx.createGain(); gain.gain.value = 0.18;
    source.connect(gain).connect(ctx.destination); source.start();
    ctxRef.current = ctx; setOn(true);
  }, []);
  useEffect(() => () => { void ctxRef.current?.close(); }, []);
  return { on, toggle: () => (on ? stop() : start()) };
}

function chime() {
  try {
    const ctx = new AudioContext();
    [523.25, 659.25, 783.99].forEach((freq, index) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.frequency.value = freq; osc.type = 'sine';
      const at = ctx.currentTime + index * 0.09;
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(0.12, at + 0.02); gain.gain.exponentialRampToValueAtTime(0.001, at + 0.6);
      osc.connect(gain).connect(ctx.destination); osc.start(at); osc.stop(at + 0.65);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch { /* som é opcional */ }
}

export function TaskFocus(props: Props) {
  const { stages, busyIds, onOpen, onComplete, onPatch, onExit } = props;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queue = props.tasks.filter(task => !isTaskCompleted(task, stages));
  const task = queue.find(item => item.id === (selectedId ?? props.focusId)) || queue[0];
  const index = task ? queue.findIndex(item => item.id === task.id) : -1;
  const next = queue.length > 1 ? queue[(index + 1) % queue.length] : undefined;
  const busy = Boolean(task && busyIds.has(task.id));
  const checks = task?.checklist || [];
  const checked = checks.filter(item => item.done).length;
  const project = task?.projectId ? props.projects.find(item => item.id === task.projectId)?.name : undefined;

  // Sessão: timer, contagem de conclusões e tempo focado.
  const [preset, setPreset] = useState(0);
  const total = PRESETS[preset].seconds;
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [focused, setFocused] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [celebrate, setCelebrate] = useState(0);
  const [capture, setCapture] = useState('');
  const [captureOpen, setCaptureOpen] = useState(false);
  const captureRef = useRef<HTMLInputElement>(null);
  const noise = useAmbientNoise();

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setFocused(value => value + 1);
      setElapsed(value => {
        const nextValue = value + 1;
        if (total && nextValue >= total) { setRunning(false); chime(); toast.success('Sessão concluída. Respira um pouco.'); return total; }
        return nextValue;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running, total]);

  function complete() {
    if (!task || busy) return;
    setDoneCount(value => value + 1);
    setCelebrate(value => value + 1);
    chime();
    onComplete(task.id);
  }

  function openCapture() { setCaptureOpen(true); setTimeout(() => captureRef.current?.focus(), 0); }
  async function sendCapture() {
    const content = capture.trim();
    if (!content) return;
    try {
      await apiFetch('/api/captures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, title: content.slice(0, 80) }) });
      setCapture(''); setCaptureOpen(false);
      toast.success('Ideia guardada na Caixa de entrada');
    } catch (error) { toast.error(showError(error)); }
  }

  // Atalhos leem sempre a versão atual das ações sem reassinar o listener.
  const keyActions = useRef({ complete, next, onExit, openCapture });
  useEffect(() => { keyActions.current = { complete, next, onExit, openCapture }; });
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const { complete, next, onExit, openCapture } = keyActions.current;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]')) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'escape' && onExit) { event.preventDefault(); onExit(); }
      else if (key === ' ') { event.preventDefault(); setRunning(value => !value); }
      else if (key === 'c') { event.preventDefault(); complete(); }
      else if (key === 'p' && next) { event.preventDefault(); setSelectedId(next.id); }
      else if (key === 'i') { event.preventDefault(); openCapture(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const progress = total ? Math.min(elapsed / total, 1) : (elapsed % 60) / 60;
  const R = 54; const C = 2 * Math.PI * R;

  return <div className="focus-mode">
    <div className="focus-sky" aria-hidden="true"><i /><i /><i /><span className="focus-orbit" /><span className="focus-orbit focus-orbit-2" /></div>
    <div className="task-focus-view">
      <header className="focus-top">
        <span className="focus-kicker"><Crosshair className="h-4 w-4" />Modo Foco</span>
        <span className="focus-session" aria-label="Resumo da sessão">{doneCount} {doneCount === 1 ? 'concluída' : 'concluídas'} · {Math.floor(focused / 60)} min focado</span>
        <button type="button" className={cn('focus-chip', noise.on && 'is-on')} aria-pressed={noise.on} onClick={noise.toggle} title="Som ambiente"><Headphones className="h-4 w-4" /><span>Som</span></button>
        {onExit && <button type="button" className="focus-chip" onClick={onExit} aria-label="Sair do foco"><X className="h-4 w-4" /><span>Sair</span></button>}
      </header>

      {!task ? <section className="focus-empty"><CheckCircle2 className="h-10 w-10" /><p>Nenhuma tarefa em aberto nesta seleção.</p><Button variant="outline" onClick={props.onCreate}><Plus className="h-4 w-4" />Criar tarefa</Button></section> : <>
        <section className="focus-stage" aria-label="Tarefa em foco">
          <div className="focus-timer">
            <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r={R} className="focus-ring-bg" /><circle cx="60" cy="60" r={R} className="focus-ring" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} /></svg>
            <div className="focus-timer-inner">
              <strong>{clock(total ? total - elapsed : elapsed)}</strong>
              <div className="focus-timer-controls">
                <button type="button" aria-label={running ? 'Pausar timer' : 'Iniciar timer'} onClick={() => setRunning(value => !value)}>{running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
                <button type="button" aria-label="Zerar timer" onClick={() => { setRunning(false); setElapsed(0); }}><RotateCcw className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>
          <div className="focus-presets" role="group" aria-label="Duração da sessão">{PRESETS.map((item, i) => <button key={item.label} type="button" aria-pressed={preset === i} onClick={() => { setPreset(i); setElapsed(0); }}>{item.label}</button>)}</div>

          <div className="focus-task" key={task.id}>
            {project && <p className="focus-project">{project}</p>}
            <button type="button" className="focus-title" disabled={busy} onClick={() => onOpen(task.id)}>{task.title}</button>
            <TaskStructureSummary task={task} tasks={props.allTasks || props.tasks} stages={stages} onOpen={onOpen} />
            {task.nextAction && <p className="focus-next-action"><ArrowRight className="h-4 w-4" />{task.nextAction}</p>}
            {checks.length > 0 && <div className="focus-checks">
              <div className="focus-checks-bar"><i style={{ width: `${checked / checks.length * 100}%` }} /></div>
              {checks.map(item => <label key={item.id} className={cn('focus-check', item.done && 'is-done')}>
                <input type="checkbox" checked={item.done} disabled={busy} onChange={() => void onPatch(task.id, { checklist: checks.map(check => check.id === item.id ? { ...check, done: !check.done } : check) })} />
                <span className="focus-check-box"><Check className="h-3 w-3" /></span><span>{item.text}</span>
              </label>)}
            </div>}
          </div>

          <button type="button" className="focus-complete" disabled={busy} onClick={complete} aria-label="Concluir tarefa em foco"><CheckCircle2 className="h-5 w-5" />Concluir<kbd>C</kbd></button>
          {celebrate > 0 && <div className="focus-burst" key={celebrate} aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ '--a': `${i * (360 / 14)}deg` } as React.CSSProperties} />)}</div>}
        </section>

        <footer className="focus-bottom">
          {captureOpen ? <form className="focus-capture" onSubmit={event => { event.preventDefault(); void sendCapture(); }}>
            <input ref={captureRef} autoFocus value={capture} onChange={event => setCapture(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setCaptureOpen(false); } }} placeholder="Ideia que surgiu… Enter guarda" aria-label="Capturar ideia sem sair do foco" />
            <button type="submit" aria-label="Guardar ideia"><Send className="h-4 w-4" /></button>
          </form> : <button type="button" className="focus-chip" onClick={openCapture}><Plus className="h-4 w-4" /><span>Ideia</span><kbd>I</kbd></button>}
          <nav className="focus-queue" aria-label="Fila de foco">
            {queue.map(item => <button type="button" key={item.id} disabled={busyIds.has(item.id)} className={cn('focus-queue-item', item.id === task.id && 'is-current')} aria-label={`Focar ${item.title}`} aria-pressed={item.id === task.id} onClick={() => setSelectedId(item.id)}>{item.title}</button>)}
          </nav>
          <span className="focus-keys" aria-hidden="true"><kbd>Espaço</kbd> timer · <kbd>P</kbd> próxima · <kbd>Esc</kbd> sair</span>
        </footer>
      </>}
    </div>
  </div>;
}
