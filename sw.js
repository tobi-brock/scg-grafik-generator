/* SCG Grafik-Generator – Service Worker
   Trennung: Anwendungscode = Cache (hier). Nutzerdaten = localStorage/IndexedDB (NIE hier angefasst).
   Bei jedem Deploy den BUILD hochzählen (oder Netlify-Commit-Hash eintragen) → löst ein Update aus. */
const BUILD = '2026-07-20-1';
const CACHE = 'scg-shell-' + BUILD;
const SHELL = [
  '/',
  '/SCG_Grafik_Generator.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  // NICHT automatisch skipWaiting → Update wird kontrolliert per Banner ausgelöst.
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(()=>{}));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Seitenaufrufe/Reloads: Netzwerk zuerst (immer neueste Version), offline → Cache.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        caches.open(CACHE).then(c => c.put('/', res.clone())).catch(()=>{});
        return res;
      }).catch(() => caches.match('/').then(r => r || caches.match('/SCG_Grafik_Generator.html')))
    );
    return;
  }

  // Google Fonts: cache-first (offline-fähig, schnell).
  if (url.host.includes('fonts.googleapis.com') || url.host.includes('fonts.gstatic.com')) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const clone = res.clone(); caches.open(CACHE).then(c => c.put(req, clone)).catch(()=>{});
      return res;
    }).catch(()=>hit)));
    return;
  }

  // Eigene Assets (Icons, CSS): stale-while-revalidate.
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(res => { const clone = res.clone(); caches.open(CACHE).then(c => c.put(req, clone)).catch(()=>{}); return res; }).catch(()=>hit);
      return hit || net;
    }));
  }
});
