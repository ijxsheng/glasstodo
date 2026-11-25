// Only built application files belong in Cache Storage. User data stays in IndexedDB.
const ROOT = new URL('./', self.location.href);
const PREFIX = `glasstodo:${ROOT.pathname}:`;
const CACHE = PREFIX + '__VERSION__';
const ASSETS = __ASSETS__.map(path => new URL(path, ROOT).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
// Do not skipWaiting: new versions activate after all old windows close.
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  const page = event.request.mode === 'navigate' && (url.pathname === ROOT.pathname || url.pathname === ROOT.pathname + 'index.html');
  if (!page && !ASSETS.includes(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Precached, versioned app files have one representation. Vite serves
    // Vary: Origin, while module loads and precache fetches use different Origin headers.
    return await cache.match(page ? new URL('index.html', ROOT).href : event.request, {ignoreVary:true}) || fetch(event.request);
  })());
});
