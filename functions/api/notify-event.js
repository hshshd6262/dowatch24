// POST /api/notify-event  { event, platform, message? }
// Step-by-step tracking of the notification sign-up, per day (Nepal time):
//   daily/{day}/n/{event}/{platform}  +1
// Failures also keep the error text (latest ones) in notifyErrors/, so problems are visible on /stats.
import { DATABASE_URL, getAccessToken } from '../../server/google.js'
import { nepalDay } from './opens.js'

export const EVENTS = ['shown', 'tap', 'allowed', 'denied', 'closed', 'later', 'saved', 'failed']
const PLATFORMS = ['android', 'ios', 'desktop', 'web']

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})

export async function onRequestPost({ request, env }) {
  let input
  try { input = await request.json() } catch { return json({ error: 'Bad request' }, 400) }
  const { event, platform, message } = input || {}
  if (!EVENTS.includes(event)) return json({ error: 'Bad event' }, 400)
  if (!PLATFORMS.includes(platform)) return json({ error: 'Bad platform' }, 400)

  const day = nepalDay()
  try {
    const auth = await getAccessToken(env)
    const res = await fetch(`${DATABASE_URL}/.json?access_token=${auth.token}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [`daily/${day}/n/${event}/${platform}`]: { '.sv': { increment: 1 } } }),
    })
    if (!res.ok) throw new Error(`Database update failed: ${res.status}`)
    if (event === 'failed') {
      await fetch(`${DATABASE_URL}/notifyErrors.json?access_token=${auth.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          at: Date.now(),
          p: platform,
          m: String(message || 'unknown error').slice(0, 300),
          ua: String(request.headers.get('user-agent') || '').slice(0, 200),
          c: request.cf?.country || 'XX',
        }),
      })
    }
    return json({ ok: true })
  } catch (err) {
    console.error(err)
    return json({ error: 'Could not save' }, 500)
  }
}
