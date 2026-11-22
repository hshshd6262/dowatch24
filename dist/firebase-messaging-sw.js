/* Firebase Cloud Messaging: shows notifications when Dowatch24 isn't open */
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

// Notifications with a title/body are shown by Firebase automatically,
// and tapping one opens the link set by the server.
firebase.messaging()

// Taps on notifications we show ourselves (while the site is open)
self.addEventListener('notificationclick', event => {
  const data = event.notification.data || {}
  if (data.FCM_MSG) return
  event.notification.close()
  event.waitUntil(clients.openWindow(data.link || '/'))
})
