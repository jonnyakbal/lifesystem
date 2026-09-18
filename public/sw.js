// Service worker "pass-through" — substitui o antigo shell-cacheado.
//
// Por que não cacheamos mais o shell: o LIFESYSTEM é 100% API-driven — o
// shell offline serve a casca SEM dados (telas vazias, o pior dos dois
// mundos). Pior: quando o servidor reinicia, o shell em cache referencia
// chunks hashados que não existem mais e o app morre em branco SEM
// consertar sozinho (o SW velho continua servindo a casca morta).
//
// Este SW: não intercepta nada (passa tudo pra rede), apaga QUALQUER cache
// legado do shell antigo e desregistra a si mesmo. Browsers com o SW antigo
// se auto-curam na primeira navegação após baixar este arquivo.
const LEGACY_CACHE_PREFIX = 'lifesystem';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith(LEGACY_CACHE_PREFIX))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister())
      .catch(() => undefined),
  );
});

// Sem handler de fetch: tudo vai direto pra rede.
