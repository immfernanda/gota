/* Service worker do Gota 💧
   - Deixa o app instalável (PWA) e usável offline.
   - É o que permite as notificações aparecerem no celular:
     no Android o construtor `new Notification()` é bloqueado e só
     `registration.showNotification()` funciona; no iOS as notificações
     só existem com o app instalado na tela inicial (que exige o SW).

   Estratégia de cache (para o PWA NÃO travar numa versão antiga):
   - Página (HTML): REDE PRIMEIRO. Com internet, sempre pega a versão mais
     nova; sem internet, cai no cache. É isso que faz suas atualizações
     aparecerem no celular ao abrir o app.
   - Demais arquivos: responde do cache na hora e atualiza em segundo plano
     (stale-while-revalidate).
   IMPORTANTE: a cada publicação de mudança, suba o VERSION abaixo. */
const VERSION = 'v2';
const CACHE = 'gota-' + VERSION;
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-maskable.svg'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function ehNavegacao(req) {
  return req.mode === 'navigate' || req.destination === 'document';
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Só mexe no que é do próprio app; fontes do Google e o Apps Script passam direto.
  if (url.origin !== location.origin) return;

  // HTML / navegação: rede primeiro, cache como reserva offline.
  if (ehNavegacao(req)) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const c = await caches.open(CACHE);
        c.put(req, res.clone());          // guarda sob a URL pedida (ex.: "/")
        c.put('./index.html', res.clone()); // e sob index.html, p/ a reserva offline
        return res;
      } catch (err) {
        return (await caches.match(req)) || (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Demais arquivos: cache imediato + atualização em segundo plano.
  e.respondWith((async () => {
    const cached = await caches.match(req);
    const rede = fetch(req).then((res) => {
      caches.open(CACHE).then((c) => c.put(req, res.clone()));
      return res;
    }).catch(() => cached);
    return cached || rede;
  })());
});

// Ao tocar na notificação, abre/foca o app.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow('./');
  })());
});
