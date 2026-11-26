// Ad counts for /stats. A banner counts as seen when at least half of it is on screen for 1 second
// (once per banner per page view); "filled" when the ad network actually put an ad in it.
// Also counts page loads (each one is a chance for the popunder script). Sent in small batches.
import { platform } from './push.js'

const KIND = { 'android-app': 'android', 'ios-app': 'ios', installed: 'desktop', browser: 'web' }
const queue = { seen: {}, filled: {}, pageLoads: 1 }   // this page load counts once
let pending = true

function flush() {
  if (!pending) return
  pending = false
  const body = JSON.stringify({ platform: KIND[platform()] || 'web', ...queue })
  queue.seen = {}; queue.filled = {}; queue.pageLoads = 0
  try {
    if (navigator.sendBeacon?.('/api/ads', new Blob([body], { type: 'application/json' }))) return
  } catch {}
  fetch('/api/ads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
}

// Each send is a server request: batch them (first after 30 s, then at most every 2 min, plus when leaving)
setInterval(flush, 2 * 60 * 1000)
setTimeout(flush, 30 * 1000)
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })
window.addEventListener('pagehide', flush)

export function countAd(slot, filled) {
  queue.seen[slot] = (queue.seen[slot] || 0) + 1
  if (filled) queue.filled[slot] = (queue.filled[slot] || 0) + 1
  pending = true
}
