// Counts installs: the first time the installed app is opened on a device, tell the server once.
// Android app / iPhone Home Screen app / app installed on a computer. Stats: /stats?key=ADMIN_KEY
import { appVersionCode, deviceId, platform } from './push.js'
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
