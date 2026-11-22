// POST /api/opens  { deviceId, platform: 'android' | 'ios' | 'desktop', lastDay? }
// Called once each time the installed app is opened. Keeps small counters per day (Nepal time):
//   daily/{YYYY-MM-DD}/o/{platform}   opens
//   daily/{YYYY-MM-DD}/u/{platform}   people (first open of that device that day)
//   daily/{YYYY-MM-DD}/oc/{country}   opens by country
//   daily/{YYYY-MM-DD}/uc/{country}   people by country
// The app remembers the day the server last gave it ("lastDay"), so a person is counted once a day.
import { DATABASE_URL, getAccessToken } from '../../server/google.js'
import { PLATFORMS } from './installs.js'

const NEPAL_OFFSET = 5.75 * 60 * 60 * 1000
export const nepalDay = (t = Date.now()) => new Date(t + NEPAL_OFFSET).toISOString().slice(0, 10)

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})
const plusOne = { '.sv': { increment: 1 } }

export async function onRequestPost({ request, env }) {
  let input
  try { input = await request.json() } catch { return json({ error: 'Bad request' }, 400) }
  const { deviceId, platform, lastDay, perm } = input || {}
  if (!/^[a-zA-Z0-9-]{16,64}$/.test(deviceId || '')) return json({ error: 'Bad device id' }, 400)
  if (!PLATFORMS.includes(platform)) return json({ error: 'Bad platform' }, 400)

  const day = nepalDay()
  const country = /^[A-Z0-9]{2}$/.test(request.cf?.country || '') ? request.cf.country : 'XX'
  const firstToday = lastDay !== day
  const update = {
    [`daily/${day}/o/${platform}`]: plusOne,
    [`daily/${day}/oc/${country}`]: plusOne,
    ...(firstToday ? { [`daily/${day}/u/${platform}`]: plusOne, [`daily/${day}/uc/${country}`]: plusOne } : {}),
    // notification status of the people opening the app (once a day each)
    ...(firstToday && ['granted', 'denied', 'default', 'unsupported'].includes(perm) ? { [`daily/${day}/perm/${perm}/${platform}`]: plusOne } : {}),
  }
  try {
    const auth = await getAccessToken(env)
    const res = await fetch(`${DATABASE_URL}/.json?access_token=${auth.token}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })
    if (!res.ok) throw new Error(`Database update failed: ${res.status} ${await res.text()}`)
    return json({ day })
  } catch (err) {
    console.error(err)
    return json({ error: 'Could not save' }, 500)
  }
}
