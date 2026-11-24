// "Who's watching what" for /stats: while the player is open on a movie / episode and the page
// is on screen, check in every minute. Closing the player removes the live entry.
import { deviceId, platform } from './push.js'

const KIND = { 'android-app': 'android', 'ios-app': 'ios', installed: 'desktop', browser: 'web' }
const BEAT_MS = 60 * 1000

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
  const beat = () => { if (document.visibilityState === 'visible') send({ ...base, action: 'beat' }) }
  const schedule = () => { clearInterval(timer); timer = setInterval(beat, BEAT_MS) }
  const onVis = () => {
    if (document.visibilityState === 'visible') { beat(); schedule() } else clearInterval(timer)
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
