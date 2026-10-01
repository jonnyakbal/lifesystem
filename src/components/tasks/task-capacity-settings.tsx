'use client';

import { useId, useState } from 'react';
import { Clock3, SlidersHorizontal } from 'lucide-react';
import { apiFetch, showError } from '@/lib/api';
import { planningPreferencesSchema, type PlanningPreferences } from '@/lib/planning-preferences';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const weekdays = [
  ['Seg', 'Segunda-feira'], ['Ter', 'Terça-feira'], ['Qua', 'Quarta-feira'],
  ['Qui', 'Quinta-feira'], ['Sex', 'Sexta-feira'], ['Sáb', 'Sábado'], ['Dom', 'Domingo'],
];

export function TaskCapacitySettings({ preferences, onSaved, loadError = '', onRetry }: {
  preferences: PlanningPreferences; onSaved: (preferences: PlanningPreferences) => void;
  loadError?: string; onRetry?: () => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(preferences);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const parsed = planningPreferencesSchema.safeParse(draft);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || 'Confira os campos.'); return; }
    setSaving(true); setError(''); setSaved(false);
    try {
      const preferences = await apiFetch<PlanningPreferences>('/api/planning-preferences', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data),
      });
      onSaved(preferences); setOpen(false); setSaved(true);
    } catch (error) { setError(showError(error)); }
    finally { setSaving(false); }
  }

  return <section aria-label="Capacidade diária" className="mb-5 rounded-2xl border border-border/70 bg-card/40 p-4 sm:px-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-start gap-3"><Clock3 aria-hidden="true" className="mt-0.5 h-4 w-4 text-primary" /><div>
        <h3 className="text-sm font-semibold">Jornada de trabalho</h3>
        <p className="mt-1 text-xs text-muted-foreground"><span className="font-mono-num">{preferences.workStart}–{preferences.workEnd}</span> · {preferences.workingDays.length === 7 ? 'todos os dias' : `${preferences.workingDays.length} dias por semana`} · {preferences.timeZone}</p>
      </div></div>
      <Button size="sm" variant="outline" aria-expanded={open} aria-controls={`${id}-form`} disabled={saving} onClick={() => {
        if (!open) { setDraft({ ...preferences, workingDays: [...preferences.workingDays] }); setError(''); setSaved(false); }
        setOpen(value => !value);
      }}><SlidersHorizontal aria-hidden="true" className="mr-2 h-3.5 w-3.5" />{open ? 'Fechar configuração' : 'Configurar capacidade'}</Button>
    </div>
    {loadError && <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 text-sm text-destructive"><span>{loadError} A capacidade não pôde ser confirmada.</span>{onRetry && <Button variant="ghost" size="sm" onClick={onRetry}>Recarregar capacidade</Button>}</div>}
    {saved && <p role="status" className="mt-3 text-xs text-primary">Jornada e fuso atualizados.</p>}
    {open && <form id={`${id}-form`} onSubmit={event => void save(event)} className="mt-4 border-t border-border/60 pt-4">
      <p className="mb-4 max-w-2xl text-xs leading-relaxed text-muted-foreground">Defina sua janela de trabalho. Compromissos e blocos de foco ocupam esse tempo; dias fora da seleção não entram na capacidade.</p>
      <fieldset disabled={saving || Boolean(loadError)} className="space-y-4">
        <legend className="sr-only">Preferências de capacidade</legend>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,140px)_minmax(0,140px)_minmax(0,1fr)]">
          <label htmlFor={`${id}-start`} className="space-y-2 text-xs font-medium">Início do trabalho<Input id={`${id}-start`} type="time" required value={draft.workStart} onChange={event => setDraft(value => ({ ...value, workStart: event.target.value }))} /></label>
          <label htmlFor={`${id}-end`} className="space-y-2 text-xs font-medium">Fim do trabalho<Input id={`${id}-end`} type="time" required value={draft.workEnd} onChange={event => setDraft(value => ({ ...value, workEnd: event.target.value }))} /></label>
          <label htmlFor={`${id}-zone`} className="space-y-2 text-xs font-medium">Fuso horário<Input id={`${id}-zone`} required maxLength={100} value={draft.timeZone} placeholder="America/Sao_Paulo" onChange={event => setDraft(value => ({ ...value, timeZone: event.target.value.trim() }))} /></label>
        </div>
        <fieldset><legend className="mb-2 text-xs font-medium">Dias de trabalho</legend><div className="flex flex-wrap gap-2">{weekdays.map(([short, full], index) => {
          const weekday = index + 1; const checked = draft.workingDays.includes(weekday);
          return <label key={weekday} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs font-medium focus-within:outline-2 focus-within:outline-primary ${checked ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
            <input type="checkbox" aria-label={full} checked={checked} className="accent-primary" onChange={event => setDraft(value => ({ ...value, workingDays: event.target.checked ? [...value.workingDays, weekday].sort((a, b) => a - b) : value.workingDays.filter(day => day !== weekday) }))} />{short}
          </label>;
        })}</div></fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={saving}>{saving ? 'Salvando capacidade…' : 'Salvar capacidade'}</Button>
      </fieldset>
    </form>}
  </section>;
}
