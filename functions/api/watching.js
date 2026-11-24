// POST /api/watching  { deviceId, platform, action: 'start' | 'beat' | 'stop', type, id, title, season?, episode?, poster? }
// Live "who's watching what" for /stats:
//   live/{deviceId}              what this device has open right now (refreshed every minute)
//   daily/{day}/w/{type}_{id}    plays per title per day (counted on 'start')
//   titles/{type}_{id}           title name + poster for the most-watched lists
import { DATABASE_URL, getAccessToken } from '../../server/google.js'
import { nepalDay } from './opens.js'

const PLATFORMS = ['android', 'ios', 'desktop', 'web']
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})

export async function onRequestPost({ request, env }) {
  let input
  try { input = await request.json() } catch { return json({ error: 'Bad request' }, 400) }
  const { deviceId, platform, action } = input || {}
  if (!/^[a-zA-Z0-9-]{16,64}$/.test(deviceId || '')) return json({ error: 'Bad device id' }, 400)
  if (!PLATFORMS.includes(platform)) return json({ error: 'Bad platform' }, 400)
  if (!['start', 'beat', 'stop'].includes(action)) return json({ error: 'Bad action' }, 400)

  const update = {}
  if (action === 'stop') {
    update[`live/${deviceId}`] = null
  } else {
    const { type, id, title, season, episode, poster } = input
    if (!['movie', 'tv'].includes(type) || !Number.isInteger(id) || id <= 0 || id > 1e8) return json({ error: 'Bad title' }, 400)
    const name = String(title || '').replace(/[\u0000-\u001f]/g, '').slice(0, 120)
    const posterOk = typeof poster === 'string' && /^\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(poster) ? poster : null
    const s = Number.isInteger(season) && season > 0 && season < 1000 ? season : null
    const e = Number.isInteger(episode) && episode > 0 && episode < 10000 ? episode : null
    const key = `${type}_${id}`
    update[`live/${deviceId}`] = {
      at: Date.now(), t: type, id, n: name, p: platform,
      c: /^[A-Z0-9]{2}$/.test(request.cf?.country || '') ? request.cf.country : 'XX',
      ...(s ? { s, e } : {}), ...(posterOk ? { ps: posterOk } : {}),
    }
    if (action === 'start') {
      update[`daily/${nepalDay()}/w/${key}`] = { '.sv': { increment: 1 } }
      update[`titles/${key}`] = { n: name, ...(posterOk ? { ps: posterOk } : {}) }
    }
  }

  try {
    const auth = await getAccessToken(env)
    const res = await fetch(`${DATABASE_URL}/.json?access_token=${auth.token}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })
    if (!res.ok) throw new Error(`Database update failed: ${res.status}`)
    return json({ ok: true })
  } catch (err) {
    console.error(err)
    return json({ error: 'Could not save' }, 500)
  }
}
