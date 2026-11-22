// Push notifications (Firebase Cloud Messaging). Firebase only loads when needed.
// The web config and VAPID key are public by design; sending needs the server key,
// which lives only in Cloudflare (functions/, workers/notify/).
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyD-hwzPxLV693ywdrm_atL3SOcqAQSm29I',
  authDomain: 'notification-f0da1.firebaseapp.com',
  projectId: 'notification-f0da1',
  storageBucket: 'notification-f0da1.firebasestorage.app',
  messagingSenderId: '4665343877',
  appId: '1:4665343877:web:b23d9ba3e2bb7611ad8eec',
}
const VAPID_KEY = 'BMD_tFFlqgvLWqzJY5nCFzSiwZ7dHeHZlWf18VxkVONBFGJ1Sqd6vPk4Q5d_OGyjcXnbdsvaRvCSod9CkUvelEk'
const SW_SCOPE = '/firebase-cloud-messaging-push-scope'

// Anonymous id for this device, so the server can update the same record
function deviceId() {
  try {
    let id = localStorage.getItem('dw_device_id')
    if (!id) {
      id = crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem('dw_device_id', id)
    }
    return id
  } catch {
    return null
  }
}

// The Android app opens the site with ?app_v=<versionCode> (from 1.0.3 on)
function readAppVersion() {
  try {
    const v = new URLSearchParams(location.search).get('app_v')
    if (v && /^[0-9]+$/.test(v)) {
      sessionStorage.setItem('dw_in_app', '1')
      sessionStorage.setItem('dw_app_v', v)
    }
  } catch {}
}
readAppVersion()

// Version code of the Android app running this page (apps older than 1.0.3 don't send one)
export function appVersionCode() {
  try { return Number(sessionStorage.getItem('dw_app_v')) || 3 } catch { return 3 }
}

const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)

// 'android-app' | 'ios-app' (added to the iPhone Home Screen) | 'installed' (computer) | 'browser'
export function platform() {
  try {
    if (document.referrer.startsWith('android-app://')) sessionStorage.setItem('dw_in_app', '1')
    if (sessionStorage.getItem('dw_in_app')) return 'android-app'
  } catch {}
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
  if (standalone && IS_IOS) return 'ios-app'
  return standalone ? 'installed' : 'browser'
}

export function pushSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
}

let messaging = null
let listening = false

async function register() {
  const [{ initializeApp, getApps }, { getMessaging, getToken, onMessage, isSupported }] = await Promise.all([
    import('firebase/app'),
    import('firebase/messaging'),
  ])
  if (!(await isSupported())) throw new Error('Push not supported here')
  if (!messaging) messaging = getMessaging(getApps()[0] || initializeApp(FIREBASE_CONFIG))

  const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: SW_SCOPE })
  await navigator.serviceWorker.ready
  if (!reg.active) {
    await new Promise(resolve => {
      const sw = reg.installing || reg.waiting
      sw?.addEventListener('statechange', () => sw.state === 'activated' && resolve())
      setTimeout(resolve, 4000)
    })
  }

  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg })
  if (!token) throw new Error('No push token')

  // Tell the server (only when the token is new or a day has passed)
  let last = {}
  try { last = JSON.parse(localStorage.getItem('dw_push_sent') || '{}') } catch {}
  if (last.token !== token || Date.now() - (last.at || 0) > 24 * 60 * 60 * 1000) {
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: deviceId(), token, platform: platform() }),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Server error (${res.status})`)
    try { localStorage.setItem('dw_push_sent', JSON.stringify({ token, at: Date.now() })) } catch {}
  }

  // While the site is open, Firebase doesn't show notifications itself
  if (!listening) {
    listening = true
    onMessage(messaging, payload => {
      const n = payload.notification || {}
      reg.showNotification(n.title || 'Dowatch24', {
        body: n.body,
        icon: '/icon-192.png',
        image: n.image,
        data: { link: payload.fcmOptions?.link || '/' },
      })
    })
  }
  return token
}

// 'unsupported' | 'default' | 'granted' | 'denied'
export function permissionState() {
  return pushSupported() ? Notification.permission : 'unsupported'
}

// Bell button → "Send me a test": refreshes the token, then asks the server for a test push
export async function sendTestPush() {
  const token = await register()
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: deviceId(), token, platform: platform(), test: true }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Server error (${res.status})`)
}

// Called from a tap ("Turn on") — the browser only shows its prompt after a user action
export async function enablePush() {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission
  await register()
  return 'granted'
}

// On each visit: if already allowed, keep the token fresh on the server
export function resumePush() {
  if (!pushSupported() || Notification.permission !== 'granted') return
  register().catch(err => console.warn('Push refresh failed', err))
}

// Inside the Android app: ask for notifications a little after opening (not instantly).
// The app hands this request to Android, so the user sees Android's own "Allow notifications?" box.
// Asks at most once every 2 days while the user hasn't answered; returns a cleanup function.
export function askPushInApp(delayMs = 20000) {
  if (!pushSupported() || Notification.permission !== 'default') return () => {}
  const KEY = 'dw_notify_asked_at'
  try {
    const last = Number(localStorage.getItem(KEY) || 0)
    if (Date.now() - last < 2 * 24 * 60 * 60 * 1000) return () => {}
  } catch {}

  let done = false
  const ask = async () => {
    if (done || Notification.permission !== 'default') return
    done = true
    cleanup()
    try { localStorage.setItem(KEY, String(Date.now())) } catch {}
    const started = Date.now()
    const result = await enablePush().catch(() => Notification.permission)
    // Answered "default" instantly = the box wasn't allowed to show without a tap: ask on the next tap
    if (result === 'default' && Date.now() - started < 400) {
      const onTap = () => { window.removeEventListener('pointerup', onTap, true); enablePush().catch(() => {}) }
      window.addEventListener('pointerup', onTap, true)
    }
  }
  const timer = setTimeout(ask, delayMs)
  window.addEventListener('dw:ask-notify', ask)          // saved something to My List
  function cleanup() {
    clearTimeout(timer)
    window.removeEventListener('dw:ask-notify', ask)
  }
  return cleanup
}
