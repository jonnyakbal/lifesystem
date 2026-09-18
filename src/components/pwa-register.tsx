'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Service worker é recurso de produção. Em dev/preview ele serve o shell
    // em cache quando o servidor reinicia (network-first só cobre navegação;
    // os chunks hashados antigos ficam órfãos e as telas nascem vazias).
    // No dev: desfaz qualquer registro existente e não registra novo.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => {
          registrations.forEach((registration) => registration.unregister());
        })
        .catch(() => undefined);
      return;
    }

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed — non-critical
    });
  }, []);

  return null;
}
