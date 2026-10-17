/* Firebase Cloud Messaging service worker — shows notifications when the site is in the background */

// Clicks on notifications we show ourselves (foreground messages)
self.addEventListener('notificationclick', event => {
  const data = event.notification.data || {}
  if (data.FCM_MSG) return // Firebase handles its own
  event.notification.close()
  event.waitUntil(clients.openWindow(data.link || '/'))
})

importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js')

// Config is passed in the registration URL (see src/lib/notifications.js)
const params = new URL(self.location).searchParams

firebase.initializeApp({
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  storageBucket: params.get('storageBucket'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
})

firebase.messaging()
