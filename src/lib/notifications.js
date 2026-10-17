import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'

// Public VAPID key (Firebase → Project settings → Cloud Messaging → Web Push certificates).
// This one is meant to be public, so it's fine in client code.
const VAPID_KEY = 'BMD_tFFlqgvLWqzJY5nCFzSiwZ7dHeHZlWf18VxkVONBFGJ1Sqd6vPk4Q5d_OGyjcXnbdsvaRvCSod9CkUvelEk'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const configured = Boolean(config.apiKey && config.projectId && config.messagingSenderId && config.appId)

let messaging = null
let registration = null
let listening = false

export async function pushSupported() {
  if (!configured) return false
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false
  try { return await isSupported() } catch { return false }
}

function waitUntilActive(reg) {
  if (reg.active) return Promise.resolve(reg)
  const sw = reg.installing || reg.waiting
  return new Promise(resolve => {
    sw?.addEventListener('statechange', () => sw.state === 'activated' && resolve(reg))
  })
}

async function register() {
  if (!messaging) messaging = getMessaging(initializeApp(config))
  if (!registration) {
    // The service worker can't read Vite env vars, so the config goes in its URL
    const params = new URLSearchParams(Object.entries(config).filter(([, v]) => v))
    registration = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${params}`,
      { scope: '/firebase-cloud-messaging-push-scope' },
    )
    await waitUntilActive(registration)
  }

  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
  if (!token) throw new Error('No push token returned')
  try { localStorage.setItem('dw_push_token', token) } catch {}

  // Firebase doesn't show notifications while the site is open in front — do it ourselves
  if (!listening) {
    listening = true
    onMessage(messaging, payload => {
      const n = payload.notification || {}
      registration.showNotification(n.title || 'Dowatch24', {
        body: n.body,
        icon: n.icon || '/icon-192.png',
        image: n.image,
        data: { link: payload.fcmOptions?.link || payload.data?.link || '/' },
      })
    })
  }
  return token
}

// Only ever called from a click — never prompts on its own
export async function enablePush() {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission
  await register()
  return 'granted'
}

// On page load: if they already said yes, refresh the token quietly
export async function resumePush() {
  if (!(await pushSupported()) || Notification.permission !== 'granted') return
  try { await register() } catch (e) { console.warn('Push refresh failed', e) }
}
