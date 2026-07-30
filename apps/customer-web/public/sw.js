self.addEventListener('push', (event) => {
  if (!event.data) return
  let data = {}
  try { data = event.data.json() } catch { data = { title: 'Pandas Kitchen', body: event.data.text() } }

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Pandas Kitchen', {
      body: data.body ?? '',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'order-update',
      renotify: true,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/order/') && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow('/')
    })
  )
})
