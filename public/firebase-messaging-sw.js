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

// Where a tap should go. Messages sent from the Firebase console have no link field,
// so they can carry one as custom data: key "link", value like /movie/550.
function linkFor(data) {
  const fcm = data.FCM_MSG
  if (!fcm) return data.link || '/'
  return fcm.data?.link || '/'
}

self.addEventListener('notificationclick', event => {
  const data = event.notification.data || {}
  const fcm = data.FCM_MSG
  // Firebase opens messages sent with a link (our server's ones) by itself
  if (fcm && (fcm.fcmOptions?.link || fcm.notification?.click_action)) return
  event.notification.close()
  const url = new URL(linkFor(data), self.location.origin)
  if (url.origin !== self.location.origin) url.href = self.location.origin + '/'
  event.waitUntil(clients.openWindow(url.href))
})
