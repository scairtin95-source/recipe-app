const CACHE_NAME = 'oliva-cache-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Network-first passthrough. This satisfies PWA installability
// requirements today; real offline support (caching pages/assets so the
// app works with no connection) is a good follow-up, not built here yet.
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});