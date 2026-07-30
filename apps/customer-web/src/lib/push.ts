const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export async function registerPushAndSubscribe(orderId: string): Promise<void> {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  try {
    // Register service worker
    const reg = await navigator.serviceWorker.register('/sw.js')

    // Request permission
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
    if (!publicKey) return

    // Subscribe
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    })

    const json = sub.toJSON()
    if (!json.keys?.p256dh || !json.keys?.auth) return

    // Send subscription to API
    await fetch(`${API_BASE}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        orderId,
      }),
    })
  } catch (err) {
    console.warn('Push registration failed:', err)
  }
}
