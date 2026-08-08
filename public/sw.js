// ============================================================
// Service Worker — Offline Support & Cache Management
// ============================================================

// Increment this version any time you rename files or make breaking changes
// Old caches are automatically cleaned up on activate
const CACHE_NAME = 'local-ai-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icons.svg',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }),
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    }),
  );
  self.clients.claim();
});

// Fetch: network-first for HTML, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  const cacheResponseIfOk = async (response) => {
    if (!response || !response.ok) return response;
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
    return response;
  };

  // Skip non-GET requests and browser extensions
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // For API calls and model downloads, use network-only
  if (url.hostname === 'huggingface.co' || url.hostname === 'cdn-lfs.huggingface.co') {
    return;
  }

  // For DuckDuckGo API, use network-only
  if (url.hostname === 'api.duckduckgo.com') {
    return;
  }

  // For static assets (JS, CSS, images), use network-first with cache fallback
  // (network-first prevents stale module errors when code changes)
  if (url.pathname.match(/\.(js|css|png|jpg|svg|ico|woff2?)$/)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          }
          return caches.match(request);
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // For navigation requests, use network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(cacheResponseIfOk)
        .catch(() => {
          return caches.match('/offline.html').then((offlinePage) => {
            return offlinePage || new Response('Offline', { status: 503 });
          });
        }),
    );
    return;
  }

  // For everything else, network-first
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
