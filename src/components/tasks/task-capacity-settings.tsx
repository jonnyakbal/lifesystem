'use client';

import { useId, useMemo, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { apiFetch, showError } from '@/lib/api';
import { planningPreferencesSchema, type PlanningPreferences } from '@/lib/planning-preferences';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const weekdays = [
  ['Seg', 'Segunda-feira'], ['Ter', 'Terça-feira'], ['Qua', 'Quarta-feira'],
  ['Qui', 'Quinta-feira'], ['Sex', 'Sexta-feira'], ['Sáb', 'Sábado'], ['Dom', 'Domingo'],
];
/** Avisa as telas abertas (Planejar, Tarefas) quando a jornada muda em Configurações. */
export const PLANNING_PREFERENCES_EVENT = 'lifesystem-planning-preferences';

export function openJourneySettings() {
  window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'jornada' } }));
}

function daysLabel(days: number[]) {
  if (days.length === 7) return 'todos os dias';
  if (days.join() === '1,2,3,4,5') return 'seg a sex';
  return days.map(day => weekdays[day - 1][0].toLowerCase()).join(', ');
}

/** Resumo da jornada nas telas de planejamento; a edição mora em Configurações → Jornada. */
export function TaskCapacitySettings({ preferences, loadError = '', onRetry }: {
  preferences: PlanningPreferences; onSaved?: (preferences: PlanningPreferences) => void;
  loadError?: string; onRetry?: () => void;
}) {
  return <section aria-label="Capacidade diária" className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
    <Clock3 aria-hidden="true" className="h-4 w-4 text-primary" />
    <span>Jornada <span className="font-mono-num text-foreground">{preferences.workStart}–{preferences.workEnd}</span> · {daysLabel(preferences.workingDays)} · {preferences.timeZone}</span>
    <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={openJourneySettings}>Ajustar jornada</Button>
    {loadError && <span role="alert" className="flex flex-wrap items-center gap-2 text-destructive">{loadError} A capacidade não pôde ser confirmada.{onRetry && <Button variant="ghost" size="sm" onClick={onRetry}>Recarregar capacidade</Button>}</span>}
  </section>;
}

function timeZoneOptions(current: string) {
  let zones: string[] = [];
  try { zones = Intl.supportedValuesOf('timeZone'); } catch { /* navegador antigo: só o atual e o do aparelho */ }
  const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const all = [...new Set([current, device, ...zones].filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const offset = (zone: string) => {
    try { return new Intl.DateTimeFormat('pt-BR', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts(new Date()).find(part => part.type === 'timeZoneName')?.value || ''; }
    catch { return ''; }
  };
  return { device, options: all.map(zone => ({ zone, label: `${zone.replace(/_/g, ' ')} (${offset(zone)})` })) };
}

/** Formulário da jornada (Configurações → Jornada). */
export function JourneyForm({ preferences, onSaved }: { preferences: PlanningPreferences; onSaved: (preferences: PlanningPreferences) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(() => ({ ...preferences, workingDays: [...preferences.workingDays] }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const { device, options } = useMemo(() => timeZoneOptions(draft.timeZone), [draft.timeZone]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const parsed = planningPreferencesSchema.safeParse(draft);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || 'Confira os campos.'); return; }
    setSaving(true); setError(''); setSaved(false);
    try {
      const next = await apiFetch<PlanningPreferences>('/api/planning-preferences', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data),
      });
      onSaved(next); setSaved(true);
      window.dispatchEvent(new CustomEvent(PLANNING_PREFERENCES_EVENT, { detail: next }));
    } catch (error) { setError(showError(error)); }
    finally { setSaving(false); }
  }

  return <form onSubmit={event => void save(event)} aria-label="Jornada de trabalho">
    <fieldset disabled={saving} className="space-y-4">
      <legend className="sr-only">Jornada de trabalho</legend>
      <div className="grid grid-cols-2 gap-3">
        <label htmlFor={`${id}-start`} className="space-y-1.5 text-xs font-medium">Início do trabalho<Input id={`${id}-start`} type="time" required value={draft.workStart} onChange={event => { setSaved(false); setDraft(value => ({ ...value, workStart: event.target.value })); }} /></label>
        <label htmlFor={`${id}-end`} className="space-y-1.5 text-xs font-medium">Fim do trabalho<Input id={`${id}-end`} type="time" required value={draft.workEnd} onChange={event => { setSaved(false); setDraft(value => ({ ...value, workEnd: event.target.value })); }} /></label>
      </div>
      <label htmlFor={`${id}-zone`} className="block space-y-1.5 text-xs font-medium">Fuso horário
        <select id={`${id}-zone`} value={draft.timeZone} onChange={event => { setSaved(false); setDraft(value => ({ ...value, timeZone: event.target.value })); }} className="h-10 w-full rounded-md border bg-background px-3 text-base sm:text-sm">
          {options.map(option => <option key={option.zone} value={option.zone}>{option.label}</option>)}
        </select>
        {device && device !== draft.timeZone && <button type="button" className="text-xs text-primary hover:underline" onClick={() => { setSaved(false); setDraft(value => ({ ...value, timeZone: device })); }}>Usar o fuso deste aparelho ({device.replace(/_/g, ' ')})</button>}
      </label>
      <fieldset><legend className="mb-2 text-xs font-medium">Dias de trabalho</legend><div className="flex flex-wrap gap-1.5">{weekdays.map(([short, full], index) => {
        const weekday = index + 1; const checked = draft.workingDays.includes(weekday);
        return <label key={weekday} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-xs font-medium focus-within:outline-2 focus-within:outline-primary ${checked ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
          <input type="checkbox" aria-label={full} checked={checked} className="accent-primary" onChange={event => { setSaved(false); setDraft(value => ({ ...value, workingDays: event.target.checked ? [...value.workingDays, weekday].sort((a, b) => a - b) : value.workingDays.filter(day => day !== weekday) })); }} />{short}
        </label>;
      })}</div></fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Salvando…' : 'Salvar jornada'}</Button>
        {saved && <span role="status" className="text-xs text-primary">Jornada e fuso atualizados.</span>}
      </div>
    </fieldset>
  </form>;
}
