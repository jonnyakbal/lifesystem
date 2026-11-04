'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { DEFAULT_REVIEW_SETTINGS, LEGACY_LAST_REVIEW_KEY, REVIEW_SETTINGS_EVENT, type ReviewSettings, type WeeklyReview } from '@/lib/weekly-review';

/**
 * Última revisão semanal e dia combinado, lidos do servidor. Enquanto não houver
 * revisão no servidor, usa a data antiga guardada neste navegador (antes de
 * 03/11/2026). `loaded` fica falso até a resposta chegar, para não lembrar à toa.
 */
export function useLastReview() {
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [legacy, setLegacy] = useState<string | null>(null);
  const [reviewDay, setReviewDay] = useState(DEFAULT_REVIEW_SETTINGS.reviewDay);
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    const [latest, settings] = await Promise.allSettled([
      apiFetch<WeeklyReview | null>('/api/weekly-review'),
      apiFetch<ReviewSettings>('/api/weekly-review/settings'),
    ]);
    // Sem resposta, vale a data deste navegador e a segunda-feira.
    if (latest.status === 'fulfilled' && (latest.value === null || typeof latest.value?.completedAt === 'string')) setReview(latest.value);
    if (settings.status === 'fulfilled' && typeof settings.value?.reviewDay === 'number') setReviewDay(settings.value.reviewDay);
    setLoaded(true);
  }, []);
  useEffect(() => {
    const onSettings = (event: Event) => { const day = (event as CustomEvent<ReviewSettings>).detail?.reviewDay; if (day) setReviewDay(day); };
    queueMicrotask(() => {
      try { setLegacy(localStorage.getItem(LEGACY_LAST_REVIEW_KEY)); } catch { /* sem armazenamento */ }
      void refresh();
    });
    window.addEventListener(REVIEW_SETTINGS_EVENT, onSettings);
    return () => window.removeEventListener(REVIEW_SETTINGS_EVENT, onSettings);
  }, [refresh]);
  return { review, lastCompletedAt: review?.completedAt ?? legacy, reviewDay, loaded, setReview };
}
