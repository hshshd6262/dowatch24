/* Firebase Cloud Messaging: shows notifications when Dowatch24 isn't open */

// We show every notification ourselves so it always has the Dowatch24 logo,
// including ones sent from the Firebase console (those carry no logo, and Chrome
// would otherwise show a plain letter "D"). This listener is added before Firebase's,
// and stops Firebase from showing a second copy.
const ICON = '/icon-192.png'
const BADGE = '/badge-96.png'   // white "D": the small status-bar icon in browsers

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch { payload = {} }
  event.stopImmediatePropagation()

  const n = payload.notification || {}
  const data = payload.data || {}
  const link = payload.fcmOptions?.link || n.click_action || data.link || '/'

  event.waitUntil(self.registration.showNotification(n.title || data.title || 'Dowatch24', {
    body: n.body || data.body || '',
    icon: n.icon || ICON,
    badge: BADGE,
    image: n.image || data.image || undefined,
    tag: payload.collapse_key || undefined,
    data: { link },
  }))
})

importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyD-hwzPxLV693ywdrm_atL3SOcqAQSm29I',
  authDomain: 'notification-f0da1.firebaseapp.com',
  projectId: 'notification-f0da1',
  storageBucket: 'notification-f0da1.firebasestorage.app',
  messagingSenderId: '4665343877',
  appId: '1:4665343877:web:b23d9ba3e2bb7611ad8eec',
})
firebase.messaging()

// Tapping a notification opens its link (Firebase console: custom data key "link",
// value like /movie/550). Reuses an open Dowatch24 tab if there is one.
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const data = event.notification.data || {}
  const raw = data.link || data.FCM_MSG?.fcmOptions?.link || data.FCM_MSG?.data?.link || '/'
  let url
  try { url = new URL(raw, self.location.origin) } catch { url = new URL('/', self.location.origin) }
  if (url.origin !== self.location.origin) url = new URL('/', self.location.origin)

  event.waitUntil((async () => {
    const open = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    const tab = open.find(c => new URL(c.url).origin === self.location.origin)
    if (tab) {
      await tab.focus()
      if ('navigate' in tab) return tab.navigate(url.href).catch(() => clients.openWindow(url.href))
      return
    }
    return clients.openWindow(url.href)
  })())
})
