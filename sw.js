/* Service worker do Gota 💧
   - Deixa o app instalável (PWA) e usável offline.
   - É o que permite as notificações aparecerem no celular:
     no Android o construtor `new Notification()` é bloqueado e só
     `registration.showNotification()` funciona; no iOS as notificações
     só existem com o app instalado na tela inicial (que exige o SW). */
const CACHE = 'gota-v1';
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

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Só mexe no que é do próprio app; fontes do Google e o Apps Script passam direto.
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      const c = await caches.open(CACHE);
      c.put(req, res.clone());
      return res;
    } catch (err) {
      return cached || caches.match('./index.html');
    }
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
