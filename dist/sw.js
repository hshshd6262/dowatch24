// Dowatch24 service worker: only shows a friendly offline page when there's no
// connection. Everything else always comes fresh from the network (no caching),
// so new deploys show up straight away.
const CACHE = 'dw-offline-v1'
const OFFLINE_FILES = ['/offline.html', '/icon-192.png']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(OFFLINE_FILES)))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  // Page loads: try the network, fall back to the offline page
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')))
    return
  }

  // The offline page's own icon
  if (new URL(request.url).pathname === '/icon-192.png') {
    event.respondWith(fetch(request).catch(() => caches.match('/icon-192.png')))
  }
})
