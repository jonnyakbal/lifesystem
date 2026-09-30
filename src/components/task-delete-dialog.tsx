'use client';

import { useRef, useState } from 'react';
import { Loader2, Trash2, CalendarDays } from 'lucide-react';
import { apiFetch, showError } from '@/lib/api';
import type { TaskPlanning } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function TaskDeleteDialog({ task, onClose, onDeleted }: {
  task: { id: string; title: string; planning?: TaskPlanning };
  onClose: () => void; onDeleted: () => void;
}) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mirrored = Boolean(task.planning?.eventId);
  async function remove() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ removeGoogleEvent: mirrored }) });
      onDeleted(); onClose();
    } catch (failure) { setError(showError(failure)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !lock.current) onClose(); }}>
    <DialogContent>
      <DialogHeader>
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"><Trash2 className="h-5 w-5" /></div>
        <DialogTitle>Excluir tarefa?</DialogTitle>
        <DialogDescription>Você está excluindo “{task.title}”.</DialogDescription>
      </DialogHeader>
      {mirrored && <div className="flex gap-3 rounded-xl border bg-muted/40 p-4 text-sm"><CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p>O bloco de horário e o evento espelhado no Google Agenda também serão removidos. Se a agenda falhar ou o evento tiver mudado, a tarefa será mantida para você revisar em Planejar.</p></div>}
      {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button variant="destructive" disabled={busy} onClick={() => void remove()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Excluir tarefa</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
