'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Task } from '@/types';
import { apiFetch, showError } from '@/lib/api';
import { todayStr } from '@/lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

export function TaskPlanningDialog({ task, initialDate, connected, onClose, onSaved }: {
  task: Task; initialDate: string; connected: boolean; onClose: () => void; onSaved: (task: Task) => void;
}) {
  const previous = task.planning;
  const start = previous?.startAt ? new Date(previous.startAt) : null;
  const [date, setDate] = useState(initialDate);
  const [timed, setTimed] = useState(Boolean(start));
  const [time, setTime] = useState(start ? `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}` : '09:00');
  const [minutes, setMinutes] = useState(start && previous?.endAt ? String((Date.parse(previous.endAt) - start.getTime()) / 60000) : '45');
  const [mirror, setMirror] = useState(Boolean(previous?.syncToGoogle));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  async function save(event: React.FormEvent) {
    event.preventDefault(); if (saving) return;
    setError('');
    // Retain the original UTC offset when reopening the repeated hour of a DST fold.
    const sameStart = start && todayStr(start) === date && `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}` === time;
    const begin = timed ? sameStart ? start : new Date(`${date}T${time}:00`) : null;
    if (timed && (!begin || Number.isNaN(begin.getTime()) || todayStr(begin) !== date || `${String(begin.getHours()).padStart(2, '0')}:${String(begin.getMinutes()).padStart(2, '0')}` !== time)) {
      setError('Esse horário não existe no fuso selecionado. Escolha outro horário.'); return;
    }
    setSaving(true);
    try {
      const updated = await apiFetch<Task>(`/api/tasks/${task.id}/planning`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, timeZone, syncToGoogle: timed && mirror,
          startAt: begin?.toISOString(), endAt: begin ? new Date(begin.getTime() + Number(minutes) * 60000).toISOString() : undefined }),
      });
      onSaved(updated);
    } catch (err) { setError(showError(err)); }
    finally { setSaving(false); }
  }

  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl">
    <DialogHeader><DialogTitle>Planejar tarefa</DialogTitle><DialogDescription>{task.title}</DialogDescription></DialogHeader>
    <form onSubmit={save} className="space-y-5">
      <label className="grid gap-2 text-sm font-medium">Dia escolhido<Input required type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
      {task.dueDate && <p className="text-xs text-muted-foreground">Prazo da tarefa: {new Date(`${task.dueDate}T12:00:00`).toLocaleDateString('pt-BR')}. Reservar um bloco não muda esse prazo.</p>}
      <label className="flex items-center gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" checked={timed} disabled={Boolean(previous?.eventId)} onChange={event => setTimed(event.target.checked)} className="h-4 w-4 accent-primary" />Reservar horário</label>
      {timed && <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-2 text-xs font-medium">Horário de início<Input type="time" required value={time} onChange={event => setTime(event.target.value)} /></label>
          <label className="grid gap-2 text-xs font-medium">Duração em minutos<Input type="number" required min="1" max="1440" value={minutes} onChange={event => setMinutes(event.target.value)} /></label>
        </div>
        <p className="text-xs text-muted-foreground">Fuso: {timeZone}. O horário será reservado por {minutes || '—'} minutos.</p>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={mirror} disabled={Boolean(previous?.eventId) || !connected} onChange={event => setMirror(event.target.checked)} className="h-4 w-4 accent-primary" />Espelhar no Google Agenda</label>
        {!connected && <p className="text-xs text-muted-foreground">Você pode salvar só aqui ou <Link className="text-primary underline" href="/api/google-calendar/connect">conectar o Google Agenda</Link> antes de espelhar.</p>}
        {previous?.eventId && <p className="text-xs text-muted-foreground">Salvar atualiza o mesmo evento. Para deixar de espelhar, use “Devolver ao planejamento” no cartão.</p>}
      </div>}
      {!timed && <p className="text-xs text-muted-foreground">A tarefa fica entre as prioridades do dia, sem ocupar um horário.</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" disabled={saving} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving || !date}>{saving ? 'Salvando…' : timed ? 'Salvar bloco' : 'Salvar dia'}</Button></div>
    </form>
  </DialogContent></Dialog>;
}
