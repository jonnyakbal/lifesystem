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

/** Segunda-feira 00:00 (horário local) da semana de `now`. */
export function startOfWeek(now: Date): Date {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

/** A revisão combinada é toda segunda: está pendente se a última foi antes da segunda desta semana. */
export function isReviewDue(lastCompletedAt: string | null, now = new Date()): boolean {
  if (!lastCompletedAt) return true;
  const last = new Date(lastCompletedAt);
  return Number.isNaN(last.getTime()) || last < startOfWeek(now);
}

export function daysSince(iso: string, now = new Date()): number {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  return Number.isFinite(days) ? Math.max(0, days) : 0;
}

export function latestReview(reviews: WeeklyReview[]): WeeklyReview | null {
  return reviews.reduce<WeeklyReview | null>((latest, review) => (!latest || review.completedAt > latest.completedAt ? review : latest), null);
}
