// POST /api/session  { deviceId, platform, seconds }
// Time the installed app was on screen, sent when it goes to the background (and every 5 min).
//   daily/{day}/t/{platform}   seconds on screen that day (Nepal time)
import { DATABASE_URL, getAccessToken } from '../../server/google.js'
import { PLATFORMS } from './installs.js'
import { nepalDay } from './opens.js'

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})

export async function onRequestPost({ request, env }) {
  let input
  try { input = await request.json() } catch { return json({ error: 'Bad request' }, 400) }
  const { deviceId, platform, seconds } = input || {}
  if (!/^[a-zA-Z0-9-]{16,64}$/.test(deviceId || '')) return json({ error: 'Bad device id' }, 400)
  if (!PLATFORMS.includes(platform)) return json({ error: 'Bad platform' }, 400)
  const sec = Math.round(Number(seconds))
  if (!Number.isFinite(sec) || sec < 1 || sec > 4 * 60 * 60) return json({ error: 'Bad seconds' }, 400)

  try {
    const auth = await getAccessToken(env)
    const res = await fetch(`${DATABASE_URL}/.json?access_token=${auth.token}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [`daily/${nepalDay()}/t/${platform}`]: { '.sv': { increment: sec } } }),
    })
    if (!res.ok) throw new Error(`Database update failed: ${res.status}`)
    return json({ ok: true })
  } catch (err) {
    console.error(err)
    return json({ error: 'Could not save' }, 500)
  }
}
