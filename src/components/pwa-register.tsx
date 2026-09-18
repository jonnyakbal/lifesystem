'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // O app é 100% API-driven: shell offline = telas vazias com cara de bug
    // (foi exatamente o que aconteceu no preview). Não registramos mais SW em
    // nenhum ambiente — e desregistramos qualquer um que exista no browser.
    // O public/sw.js virou um "kill-switch": browsers que ainda têm o SW
    // antigo baixam esta versão na próxima navegação, que apaga os caches
    // legados e desregistra a si mesmo. Auto-cura sem intervenção.
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      })
      .catch(() => undefined);
  }, []);

  return null;
}
