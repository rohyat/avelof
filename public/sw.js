self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  if (event.request.method === 'GET' && event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request))
  }
})

self.addEventListener('push', (event) => {
  let message = {}
  try { message = event.data?.json() ?? {} } catch { message = {} }
  const url = typeof message.url === 'string' && message.url.startsWith('/') ? message.url : '/admin/panel'
  event.waitUntil(self.registration.showNotification(message.title || 'AVELOF update', {
    body: message.body || 'There is a new update in your owner dashboard.',
    icon: '/app-icon-192.png',
    badge: '/app-icon-192.png',
    tag: message.tag || 'avelof-update',
    data: { url },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = event.notification.data?.url || '/admin/panel'
  const target = new URL(path, self.location.origin)
  if (target.origin !== self.location.origin) return
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin)) {
        await client.navigate(target.href)
        return client.focus()
      }
    }
    return self.clients.openWindow(target.href)
  })())
})