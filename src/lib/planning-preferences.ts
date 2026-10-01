import { z } from 'zod';
import type { MinuteInterval } from './planning-availability';

const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Informe um horário entre 00:00 e 23:59.');
export const planningPreferencesSchema = z.object({
  workStart: clock,
  workEnd: clock,
  workingDays: z.array(z.number().int().min(1).max(7)).min(1, 'Escolha pelo menos um dia.').max(7)
    .refine(days => new Set(days).size === days.length, 'Não repita dias da semana.'),
  timeZone: z.string().min(1).max(100).refine(value => {
    if (!/^[A-Za-z][A-Za-z0-9_+/-]*$/.test(value)) return false;
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; }
    catch { return false; }
  }, 'Informe um fuso IANA válido, como America/Sao_Paulo.'),
}).strict().refine(value => value.workEnd > value.workStart, {
  message: 'O fim deve ser posterior ao início, no mesmo dia.', path: ['workEnd'],
});

export type PlanningPreferences = z.infer<typeof planningPreferencesSchema>;
export const DEFAULT_PLANNING_PREFERENCES: PlanningPreferences = {
  workStart: '08:00', workEnd: '20:00', workingDays: [1, 2, 3, 4, 5, 6, 7], timeZone: 'America/Sao_Paulo',
};

/** ISO weekdays: Monday=1, Sunday=7. Day keys are civil dates in the configured timezone. */
export function workWindowOnDay(day: string, preferences: PlanningPreferences): MinuteInterval | null {
  const date = new Date(`${day}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) throw new Error('Dia inválido.');
  const weekday = date.getUTCDay() || 7;
  if (!preferences.workingDays.includes(weekday)) return null;
  const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
  return { start: minutes(preferences.workStart), end: minutes(preferences.workEnd) };
}
