const CACHE_NAME = 'melktak-pwa-v9';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/registerSW.js',
  '/assets/management-ui.js', '/assets/management-ui.css', '/assets/index-app.js', '/assets/crm-workflows.js', '/assets/index-app.css',
  '/icons/icon-192.png', '/icons/icon-512.png'];
const SHELL_PATHS = new Set(SHELL);
 
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('melktak-pwa-') && key !== CACHE_NAME)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Never store CRM responses, credentials, documents, uploads, or third party traffic.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin ||
      url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;
  const navigation = event.request.mode === 'navigate';
  // Only the root SPA navigation belongs to this cache (not platform/shared property pages).
  if (navigation && !['/', '/index.html'].includes(url.pathname)) return;
  if (!navigation && !SHELL_PATHS.has(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = navigation ? '/' : url.pathname;
    try {
      const response = await fetch(event.request);
      if (response.ok && response.type === 'basic') await cache.put(cacheKey, response.clone());
      return response;
    } catch {
      return await cache.match(cacheKey) || new Response('اتصال اینترنت برقرار نیست.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  })());
});
 