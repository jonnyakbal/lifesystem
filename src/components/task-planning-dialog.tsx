'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Task } from '@/types';
import { apiFetch, showError } from '@/lib/api';
import { planningClockParts, planningStartAt, planningTimeZone } from '@/lib/task-planning-timezone';
import { planningPreferencesSchema } from '@/lib/planning-preferences';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

export function TaskPlanningDialog({ task, initialDate, connected, onClose, onSaved, preferredTimeZone }: {
  task: Task; initialDate: string; connected: boolean; onClose: () => void; onSaved: (task: Task) => void;
  preferredTimeZone?: string;
}) {
  const previous = task.planning;
  const start = previous?.startAt ? new Date(previous.startAt) : null;
  const [date, setDate] = useState(initialDate);
  const [timed, setTimed] = useState(Boolean(start));
  const [zone, setZone] = useState<string | null>(previous?.startAt && previous.timeZone ? previous.timeZone : preferredTimeZone || null);
  const [zoneError, setZoneError] = useState('');
  const [retry, setRetry] = useState(0);
  const [time, setTime] = useState(start && previous?.timeZone ? planningClockParts(start.toISOString(), previous.timeZone).time : '09:00');
  const [minutes, setMinutes] = useState(start && previous?.endAt ? String((Date.parse(previous.endAt) - start.getTime()) / 60000) : '45');
  const [mirror, setMirror] = useState(Boolean(previous?.syncToGoogle));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (previous?.startAt && previous.timeZone || preferredTimeZone) return;
    let active = true;
    apiFetch('/api/planning-preferences').then(value => {
      const preferences = planningPreferencesSchema.parse(value);
      if (active) { setZone(preferences.timeZone); setZoneError(''); }
    }).catch(error => { if (active) setZoneError(showError(error)); });
    return () => { active = false; };
  }, [preferredTimeZone, previous?.startAt, previous?.timeZone, retry]);
  const timeZone = zone ? planningTimeZone({ preferredTimeZone: zone, previousStartAt: previous?.startAt, previousTimeZone: previous?.timeZone }) : null;

  async function save(event: React.FormEvent) {
    event.preventDefault(); if (saving || !timeZone) return;
    setError('');
    let begin: Date | null;
    try { begin = timed ? new Date(planningStartAt(date, time, timeZone, previous?.startAt)) : null; }
    catch (error) { setError(showError(error)); return; }
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
      <p className="text-xs text-muted-foreground">O dia planejado e o prazo da tarefa ficam sincronizados.</p>
      <label className="flex items-center gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" checked={timed} disabled={Boolean(previous?.eventId)} onChange={event => setTimed(event.target.checked)} className="h-4 w-4 accent-primary" />Reservar horário</label>
      {timed && <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-2 text-xs font-medium">Horário de início<Input type="time" required value={time} onChange={event => setTime(event.target.value)} /></label>
          <label className="grid gap-2 text-xs font-medium">Duração em minutos<Input type="number" required min="1" max="1440" value={minutes} onChange={event => setMinutes(event.target.value)} /></label>
        </div>
        <div className="flex gap-2" aria-label="Durações sugeridas">{[15, 30, 45, 60, 90].map(value => <button type="button" key={value} aria-pressed={minutes === String(value)} className="rounded-full border px-2.5 py-1.5 text-xs aria-pressed:border-primary aria-pressed:bg-primary/15" onClick={() => setMinutes(String(value))}>{value} min</button>)}</div>
        <p className="text-xs text-muted-foreground">Fuso{previous?.startAt ? ' do bloco' : ' configurado'}: {timeZone || 'carregando…'}. O horário será reservado por {minutes || '—'} minutos.</p>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={mirror} disabled={Boolean(previous?.eventId) || !connected} onChange={event => setMirror(event.target.checked)} className="h-4 w-4 accent-primary" />Espelhar no Google Agenda</label>
        {!connected && <p className="text-xs text-muted-foreground">Você pode salvar só aqui ou <Link className="text-primary underline" href="/api/google-calendar/connect">conectar o Google Agenda</Link> antes de espelhar.</p>}
        {previous?.eventId && <p className="text-xs text-muted-foreground">Salvar atualiza o mesmo evento. Para deixar de espelhar, use “Devolver ao planejamento” no cartão.</p>}
      </div>}
      {!timed && <p className="text-xs text-muted-foreground">A tarefa fica entre as prioridades do dia, sem ocupar um horário.</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {zoneError && <div role="alert" className="text-sm text-destructive">{zoneError}<Button type="button" variant="ghost" onClick={() => setRetry(value => value + 1)}>Recarregar fuso</Button></div>}
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" disabled={saving} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving || !date || !timeZone}>{saving ? 'Salvando…' : !timeZone && !zoneError ? 'Carregando fuso…' : timed ? 'Salvar bloco' : 'Salvar dia'}</Button></div>
    </form>
  </DialogContent></Dialog>;
}
