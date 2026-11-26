// "Who's watching what" for /stats: while the player is open on a movie / episode and the page
// is on screen, check in every 5 minutes. Closing the player removes the live entry.
import { deviceId, platform } from './push.js'

const KIND = { 'android-app': 'android', 'ios-app': 'ios', installed: 'desktop', browser: 'web' }
// Check in every 5 minutes (each check-in is a server request, so keep these rare)
const BEAT_MS = 5 * 60 * 1000

function send(body) {
  const json = JSON.stringify(body)
  try {
    if (body.action === 'stop' && navigator.sendBeacon?.('/api/watching', new Blob([json], { type: 'application/json' }))) return
  } catch {}
  fetch('/api/watching', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json, keepalive: true }).catch(() => {})
}

// Returns a stop function. info: { type: 'movie' | 'tv', id, title, season?, episode?, poster? }
export function startWatching(info) {
  const id = deviceId()
  if (!id || !info?.id || !['movie', 'tv'].includes(info.type)) return () => {}
  const base = {
    deviceId: id,
    platform: KIND[platform()] || 'web',
    type: info.type,
    id: Number(info.id),
    title: String(info.title || '').slice(0, 120),
    ...(info.type === 'tv' && info.season ? { season: Number(info.season), episode: Number(info.episode) || 1 } : {}),
    ...(info.poster ? { poster: info.poster } : {}),
  }
  send({ ...base, action: 'start' })
  let timer = null
  let lastSent = Date.now()
  const beat = () => {
    if (document.visibilityState !== 'visible') return
    lastSent = Date.now()
    send({ ...base, action: 'beat' })
  }
  const schedule = () => { clearInterval(timer); timer = setInterval(beat, BEAT_MS) }
  // Coming back to the page only checks in if the last check-in is getting old
  const onVis = () => {
    if (document.visibilityState === 'visible') {
      if (Date.now() - lastSent > BEAT_MS - 60 * 1000) beat()
      schedule()
    } else clearInterval(timer)
  }
  schedule()
  document.addEventListener('visibilitychange', onVis)
  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVis)
    send({ deviceId: id, platform: base.platform, action: 'stop' })
  }
}
