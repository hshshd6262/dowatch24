// POST /api/push/subscribe  { deviceId, token, platform, test? }
// Saves the device, puts it on the "trending" topic, and sends a welcome notification.
import { db, getAccessToken, sendPush, subscribeToTopic, SITE_URL } from '../../../server/google.js'

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
  const kind = ['android-app', 'installed', 'browser'].includes(platform) ? platform : 'browser'

  // Which step failed is reported back (no secrets) so problems are easy to spot
  let step = 'google sign-in (check FIREBASE_SERVICE_ACCOUNT on Cloudflare)'
  try {
    const auth = await getAccessToken(env)
    const path = `devices/${deviceId}`
    step = 'database read'
    const existing = await db(auth, path)
    const now = Date.now()

    step = 'joining the trending topic'
    await subscribeToTopic(auth, token, 'trending')
    step = 'database save'
    await db(auth, path, 'PATCH', {
      token,
      platform: kind,
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

    // Welcome message only for a new device or a new token
    if (!existing || existing.token !== token) {
      await sendPush(auth, {
        token,
        title: "You're in! 🎉",
        body: "We'll let you know what's trending and when new episodes drop.",
        link: `${SITE_URL}/?utm_source=push&utm_medium=notification&utm_campaign=welcome`,
      })
    }
    return json({ ok: true })
  } catch (err) {
    console.error(step, err)
    return json({ error: `Failed at: ${step}` }, 500)
  }
}
