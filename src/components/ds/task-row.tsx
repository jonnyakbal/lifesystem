'use client';
import { Check, Circle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// The single task line used by every list-like view (Hoje, Lista, Semana,
// day panels). Rules that must survive: the title opens the task; completing
// is its own 44px control with a visible label; meta is chips, never inline
// form fields; a done task stays readable and can be reopened elsewhere.
export function TaskRow({ title, done = false, meta, onOpen, onToggle, accent }: {
  title: string;
  done?: boolean;
  meta?: ReactNode;
  onOpen?: () => void;
  onToggle?: () => void;
  accent?: 'danger' | 'action' | null;
}) {
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border bg-card p-3', accent === 'danger' && 'border-l-4 border-l-critical', accent === 'action' && 'border-l-4 border-l-primary', done && 'opacity-70')}>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={done}
        className="flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {done ? <Check className="h-5 w-5 text-money" /> : <Circle className="h-5 w-5" />}
        <span>{done ? 'Feita' : 'Concluir'}</span>
      </button>
      <div className="min-w-0 flex-1 py-1">
        <button type="button" onClick={onOpen} className={cn('text-left text-base font-medium leading-snug hover:text-primary', done && 'line-through')}>
          {title}
        </button>
        {meta && <div className="mt-2 flex flex-wrap gap-1.5">{meta}</div>}
      </div>
    </div>
  );
}
