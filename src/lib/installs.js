// Counts installs (first open on a device, once) and opens (every time the app is opened).
// Android app / iPhone Home Screen app / app installed on a computer. Stats: /stats?key=ADMIN_KEY
import { appVersionCode, deviceId, permissionState, platform } from './push.js'
import { trackEvent } from './analytics.js'

const KIND = { 'android-app': 'android', 'ios-app': 'ios', installed: 'desktop' }
const DONE_KEY = 'dw_install_counted'

export function reportInstall() {
  const kind = KIND[platform()]
  if (!kind) return
  try { if (localStorage.getItem(DONE_KEY)) return } catch { return }
  const id = deviceId()
  if (!id) return

  fetch('/api/installs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: id, platform: kind, ...(kind === 'android' ? { version: appVersionCode() } : {}) }),
  })
    .then(async res => {
      if (!res.ok) return   // failed? try again next time
      localStorage.setItem(DONE_KEY, '1')
      if ((await res.json().catch(() => ({}))).counted) trackEvent('app_install', { install_platform: kind })
    })
    .catch(() => {})
}

// Every app launch (not reloads within the same launch). Stats: opens + people per day, by country.
export function reportOpen() {
  const kind = KIND[platform()]
  if (!kind) return
  try {
    if (sessionStorage.getItem('dw_open_sent')) return
    sessionStorage.setItem('dw_open_sent', '1')
  } catch {}
  const id = deviceId()
  if (!id) return
  let lastDay = null
  try { lastDay = localStorage.getItem('dw_open_day') } catch {}
  fetch('/api/opens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: id, platform: kind, lastDay, perm: permissionState() }),
  })
    .then(res => (res.ok ? res.json() : null))
    .then(data => { if (data?.day) localStorage.setItem('dw_open_day', data.day) })
    .catch(() => {})
}

// Time on screen in the installed app: counts only while the app is visible,
// sent when it goes to the background (and every 5 minutes during long sessions)
export function trackTime() {
  const kind = KIND[platform()]
  if (!kind) return
  const id = deviceId()
  if (!id) return
  let visibleSince = document.visibilityState === 'visible' ? Date.now() : null
  let pending = 0

  const send = () => {
    if (visibleSince) {
      pending += Date.now() - visibleSince
      visibleSince = document.visibilityState === 'visible' ? Date.now() : null
    }
    const seconds = Math.round(pending / 1000)
    if (seconds < 3) return
    pending = 0
    const body = JSON.stringify({ deviceId: id, platform: kind, seconds: Math.min(seconds, 4 * 60 * 60) })
    try {
      if (navigator.sendBeacon?.('/api/session', new Blob([body], { type: 'application/json' }))) return
    } catch {}
    fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') send()
    else visibleSince = Date.now()
  })
  window.addEventListener('pagehide', send)
  setInterval(() => { if (document.visibilityState === 'visible') send() }, 15 * 60 * 1000)   // long sessions: every 15 min
}
