// Service Worker — LMS PWA
const CACHE_NAME = 'lms-pwa-v1'
const SHELL_ASSETS = [
  '/app/home',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Chỉ cache GET requests
  if (request.method !== 'GET') return

  // Không cache API calls
  if (url.pathname.startsWith('/api/')) return

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          // Cache static assets
          if (response.ok && (url.pathname.startsWith('/app') || url.pathname.startsWith('/icons'))) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => {
          // Offline fallback cho navigation requests
          if (request.mode === 'navigate') {
            return caches.match('/app/home')
          }
        })

      return cached || networkFetch
    })
  )
})
