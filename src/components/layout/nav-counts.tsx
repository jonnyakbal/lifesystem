'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Contador do INBOX pra navegação (badge "quantas capturas esperam triagem").
// Uma única fonte de verdade montada no ChromeGate: busca no mount, ao
// voltar pra aba e quando qualquer tela dispara 'ls:counts:dirty' (as
// mutações de /api/captures e /api/tasks disparam via lib/api.ts). Sem
// polling, sem refetch por navegação.
const InboxCountContext = createContext(0);

export function InboxCountProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const captures = await fetch('/api/captures').then(r => r.json());
      setCount(Array.isArray(captures)
        ? captures.filter((c: { status?: string }) => c.status === 'inbox').length
        : 0);
    } catch { /* contagem é enfoque, não dado crítico — falha em silêncio */ }
  }, []);

  useEffect(() => {
    // queueMicrotask: o lint (com razão) não quer setState síncrono no corpo
    // do effect — padrão já usado em weekly-review-flow e inbox.
    queueMicrotask(refresh);
    const onDirty = () => { refresh(); };
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('ls:counts:dirty', onDirty);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('ls:counts:dirty', onDirty);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  return <InboxCountContext.Provider value={count}>{children}</InboxCountContext.Provider>;
}

export function useInboxCount() {
  return useContext(InboxCountContext);
}
