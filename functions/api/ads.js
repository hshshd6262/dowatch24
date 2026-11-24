// POST /api/ads  { platform, seen: { slot: n }, filled: { slot: n }, pageLoads }
// Ad counts per day for /stats:
//   daily/{day}/ad/{slot}       banners seen (≥50% on screen for 1 second)
//   daily/{day}/adf/{slot}      of those, how many had an ad inside (not blocked / empty)
//   daily/{day}/pl/{platform}   page loads (each one is a chance for the popunder)
import { DATABASE_URL, getAccessToken } from '../../server/google.js'
import { nepalDay } from './opens.js'

const PLATFORMS = ['android', 'ios', 'desktop', 'web']
const SLOTS = ['top', 'under-hero', 'above-player', 'above-servers', 'tv-above-share', 'other']
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})
const count = v => (Number.isInteger(v) && v > 0 ? Math.min(v, 50) : 0)

export async function onRequestPost({ request, env }) {
  let input
  try { input = await request.json() } catch { return json({ error: 'Bad request' }, 400) }
  const { platform, seen = {}, filled = {}, pageLoads = 0 } = input || {}
  if (!PLATFORMS.includes(platform)) return json({ error: 'Bad platform' }, 400)

  const day = nepalDay()
  const inc = n => ({ '.sv': { increment: n } })
  const update = {}
  for (const slot of SLOTS) {
    const s = count(seen?.[slot]), f = Math.min(count(filled?.[slot]), s)
    if (s) update[`daily/${day}/ad/${slot}`] = inc(s)
    if (f) update[`daily/${day}/adf/${slot}`] = inc(f)
  }
  const pl = count(pageLoads) ? 1 : 0   // at most one page load per batch
  if (pl) update[`daily/${day}/pl/${platform}`] = inc(1)
  if (!Object.keys(update).length) return json({ ok: true })

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
