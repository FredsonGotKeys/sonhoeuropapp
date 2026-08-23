// Só ficheiros estáticos passam por aqui. Documentos HTML e pedidos de dados
// do Next.js (RSC) nunca são guardados nem servidos pelo service worker:
// depois de cada deploy, o HTML antigo aponta para ficheiros de build que já
// não existem no servidor, e servi-lo deixa a aplicação sem forma de arrancar
// nem de recuperar sozinha — é isso que produzia o ecrã "This page couldn't
// load" ao navegar.
const CACHE_NAME = 'sonhoeuropa-v4'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// Guardável = ficheiro estático imutável (o nome muda a cada build) ou imagem.
// Tudo o resto vai directo à rede, exactamente como se não houvesse service
// worker nenhum.
function podeSerGuardado(request, url) {
  if (request.mode === 'navigate') return false
  if (request.destination === 'document') return false
  if (url.searchParams.has('_rsc')) return false
  if (request.headers.get('RSC')) return false
  if (url.pathname.startsWith('/api/')) return false

  if (url.pathname.startsWith('/_next/static/')) return true
  if (url.pathname.startsWith('/images/')) return true
  return /\.(?:png|jpe?g|avif|webp|gif|svg|ico|woff2?)$/i.test(url.pathname)
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  if (url.origin !== self.location.origin) return
  if (!podeSerGuardado(request, url)) return

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached

      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, clone))
              .catch(() => {})
          }
          return response
        })
        .catch(() =>
          // Uma falha isolada de rede (comum em dados móveis) merece uma
          // segunda tentativa. Se voltar a falhar, deixamos o erro seguir tal
          // como seguiria sem service worker — o browser trata disso.
          fetch(request)
        )
    })
  )
})

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'SonhoEuropa', {
      body: data.body ?? 'Tens uma nova notificação!',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url ?? '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      const url = event.notification.data?.url ?? '/'
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus()
      }
      return clients.openWindow(url)
    })
  )
})
