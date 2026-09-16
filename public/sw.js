const CACHE_NAME = 'oliva-cache-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Recipe detail pages, their images, and the underlying Next.js JS/CSS
// bundles all get cached on every successful fetch — the JS bundle is
// needed too, since the page can't hydrate/render without it even if the
// HTML shell itself is cached. Re-opening a recipe you've already viewed
// works with no connection — useful mid-cook if kitchen wifi drops.
// Everything else (recipe list, home, The Table, API calls) stays
// network-only: caching those risks showing stale shared data.
function isCacheable(url) {
  const isRecipeDetailPage = /\/recipes\/[^/]+$/.test(url.pathname);
  const isSupabaseStorageImage = url.hostname.endsWith('.supabase.co') && url.pathname.includes('/storage/');
  const isNextStaticAsset = url.pathname.startsWith('/_next/static/');
  return isRecipeDetailPage || isSupabaseStorageImage || isNextStaticAsset;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET' || !isCacheable(url)) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((cached) => cached || new Response('', { status: 504 }))
      )
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || new Response('', { status: 504 }))
      )
  );
});