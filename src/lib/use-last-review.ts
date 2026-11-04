'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { LEGACY_LAST_REVIEW_KEY, type WeeklyReview } from '@/lib/weekly-review';

/**
 * Última revisão semanal, lida do servidor. Enquanto não houver registro no
 * servidor, usa a data antiga guardada neste navegador (antes de 03/11/2026).
 * `loaded` fica falso até a resposta chegar, para não lembrar à toa.
 */
export function useLastReview() {
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [legacy, setLegacy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    try { setReview(await apiFetch<WeeklyReview | null>('/api/weekly-review')); }
    catch { /* Sem resposta, vale a data deste navegador. */ }
    finally { setLoaded(true); }
  }, []);
  useEffect(() => {
    queueMicrotask(() => {
      try { setLegacy(localStorage.getItem(LEGACY_LAST_REVIEW_KEY)); } catch { /* sem armazenamento */ }
      void refresh();
    });
  }, [refresh]);
  return { review, lastCompletedAt: review?.completedAt ?? legacy, loaded, setReview };
}
