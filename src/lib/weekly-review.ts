import { z } from 'zod';

// Registro de cada revisão semanal concluída. Fica no servidor para valer em
// qualquer aparelho (antes ficava só no localStorage do navegador).
export const WEEKLY_REVIEW_COLLECTION = 'weekly_reviews';
export const LEGACY_LAST_REVIEW_KEY = 'lifesystem-last-weekly-review';
export const MAX_WEEK_PRIORITIES = 3;

const count = z.number().int().min(0).max(10_000);
export const weeklyReviewInputSchema = z.object({
  priorities: z.array(z.string().trim().min(1).max(200)).max(MAX_WEEK_PRIORITIES, `Escolha no máximo ${MAX_WEEK_PRIORITIES} prioridades.`)
    .refine(ids => new Set(ids).size === ids.length, 'Prioridade repetida.'),
  summary: z.object({ clarified: count, rescheduled: count, completed: count, nextActions: count }).partial().default({}),
});
export type WeeklyReviewInput = z.infer<typeof weeklyReviewInputSchema>;
export type WeeklyReview = WeeklyReviewInput & { id: string; completedAt: string; createdAt?: string };

// Dia combinado para a revisão (ISO: segunda=1 … domingo=7). Fica fora das
// preferências de jornada, que são um contrato estrito lido também pelo MCP.
export const REVIEW_SETTINGS_COLLECTION = 'weekly_review_settings';
export const reviewSettingsSchema = z.object({ reviewDay: z.number().int().min(1).max(7) }).strict();
export type ReviewSettings = z.infer<typeof reviewSettingsSchema>;
export const DEFAULT_REVIEW_SETTINGS: ReviewSettings = { reviewDay: 1 };
export const REVIEW_SETTINGS_EVENT = 'lifesystem-review-settings';

/** 00:00 (horário local) do último dia de revisão em ou antes de `now`. */
export function startOfReviewWeek(now: Date, reviewDay = DEFAULT_REVIEW_SETTINGS.reviewDay): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const isoToday = start.getDay() || 7;
  start.setDate(start.getDate() - ((isoToday - reviewDay + 7) % 7));
  return start;
}

/** Pendente se a última revisão foi antes do dia de revisão desta semana. */
export function isReviewDue(lastCompletedAt: string | null, now = new Date(), reviewDay = DEFAULT_REVIEW_SETTINGS.reviewDay): boolean {
  if (!lastCompletedAt) return true;
  const last = new Date(lastCompletedAt);
  return Number.isNaN(last.getTime()) || last < startOfReviewWeek(now, reviewDay);
}

export function daysSince(iso: string, now = new Date()): number {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  return Number.isFinite(days) ? Math.max(0, days) : 0;
}

/** Dias de calendário entre duas datas AAAA-MM-DD (b − a), sem depender da hora. */
export function calendarDaysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

export function latestReview(reviews: WeeklyReview[]): WeeklyReview | null {
  return reviews.reduce<WeeklyReview | null>((latest, review) => (!latest || review.completedAt > latest.completedAt ? review : latest), null);
}
