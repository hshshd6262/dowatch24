// POST /api/push/subscribe  { deviceId, token, platform, test? }
// Saves the device, puts it on the "trending" topic, and sends a welcome notification.
import { DATABASE_URL, db, getAccessToken, sendPush, subscribeToTopic, SITE_URL } from '../../../server/google.js'

const STATS_PLATFORM = { 'android-app': 'android', 'ios-app': 'ios', installed: 'desktop', browser: 'web' }

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})

export async function onRequestPost({ request, env }) {
  let input
  try { input = await request.json() } catch { return json({ error: 'Bad request' }, 400) }

  const { deviceId, token, platform, test } = input || {}
  if (!/^[a-zA-Z0-9-]{16,64}$/.test(deviceId || '')) return json({ error: 'Bad device id' }, 400)
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) return json({ error: 'Bad token' }, 400)
  const kind = ['android-app', 'ios-app', 'installed', 'browser'].includes(platform) ? platform : 'browser'

  // Which step failed is reported back (no secrets) so problems are easy to spot
  let step = 'google sign-in (check FIREBASE_SERVICE_ACCOUNT on Cloudflare)'
  try {
    const auth = await getAccessToken(env)
    const path = `devices/${deviceId}`
    step = 'database read'
    const existing = await db(auth, path)
    const now = Date.now()

    // Keeps Google's exact reason on /stats ("Latest sign-up errors") when something is refused
    const logError = message => fetch(`${DATABASE_URL}/notifyErrors.json?access_token=${auth.token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        at: Date.now(),
        p: STATS_PLATFORM[kind] || 'web',
        m: String(message).slice(0, 300),
        ua: String(request.headers.get('user-agent') || '').slice(0, 200),
        c: request.cf?.country || 'XX',
      }),
    }).catch(() => {})

    // Join the "trending" list that campaigns go to. If Google refuses, still save the phone
    // (topic: false) and try again the next time it checks in (about once a day).
    step = 'joining the trending topic'
    let topic = true
    if (!(existing?.topic === true && existing.token === token)) {
      try {
        await subscribeToTopic(auth, token, 'trending')
      } catch (err) {
        topic = false
        console.error('topic join', err)
        await logError(`saved, but joining the campaign list failed (will retry): ${String(err.message || err).slice(0, 220)}`)
      }
    }
    step = 'database save'
    await db(auth, path, 'PATCH', {
      token,
      platform: kind,
      topic,
      createdAt: existing?.createdAt || now,
      lastSeen: now,
    })

    step = 'sending the notification'
    // "Send me a test" from the bell button
    if (test) {
      await sendPush(auth, {
        token,
        title: 'Test notification ✅',
        body: 'Notifications are working on this device.',
        link: `${SITE_URL}/?utm_source=push&utm_medium=notification&utm_campaign=test`,
      })
      return json({ ok: true, test: true })
    }

    // Welcome message only for a new device or a new token.
    // The phone is already signed up at this point, so if Google won't deliver the welcome
    // we still answer OK, and keep Google's exact reason for /stats ("Latest sign-up errors").
    if (!existing || existing.token !== token) {
      try {
        await sendPush(auth, {
          token,
          title: "You're in! 🎉",
          body: "We'll let you know what's trending and when new episodes drop.",
          link: `${SITE_URL}/?utm_source=push&utm_medium=notification&utm_campaign=welcome`,
        })
      } catch (err) {
        console.error('welcome push', err)
        await logError(`signed up OK, but the welcome message was not delivered: ${String(err.message || err).slice(0, 220)}`)
        return json({ ok: true, topic, welcome: 'not delivered' })
      }
    }
    return json({ ok: true })
  } catch (err) {
    console.error(step, err)
    return json({ error: `Failed at: ${step}` }, 500)
  }
}
