/* Service Worker CourtSync — cache minimaliste :
   - assets statiques (JS, CSS, icônes) en cache-first pour un second lancement rapide ;
   - navigations en network-first avec fallback offline ;
   - jamais de cache pour les données dynamiques (Supabase, API) : elles transitent
     toujours en temps réel. */

const VERSION = 'courtsync-v1'
const STATIC_CACHE = VERSION + '-static'
const PAGE_CACHE = VERSION + '-pages'

const PRECACHE_STATIC = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_STATIC)),
      caches.open(PAGE_CACHE).then((cache) => cache.addAll(['/offline.html'])),
    ]).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Jamais de cache pour les origines externes (Supabase, etc.)
  if (url.origin !== self.location.origin) return

  // Navigations : réseau d'abord, fallback offline.html si hors-ligne.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
          return response
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/offline.html'))
        )
    )
    return
  }

  // Assets statiques (chunks _next, icônes, polices locales) : cache-first.
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons') ||
    /\.(png|ico|svg|woff2?)$/.test(url.pathname)

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone()
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
          }
          return response
        })
      })
    )
    return
  }

  // Tout le reste (routes API, données) : réseau pur, aucun cache.
})
