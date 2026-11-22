// POST /api/installs  { deviceId, platform: 'android' | 'ios' | 'desktop', version? }
// Called once per device, the first time the installed app is opened.
// Each device is stored once (installs/{platform}_{deviceId}), so re-opening never double counts.
import { db, getAccessToken } from '../../server/google.js'

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})

export const PLATFORMS = ['android', 'ios', 'desktop']

export async function onRequestPost({ request, env }) {
  let input
  try { input = await request.json() } catch { return json({ error: 'Bad request' }, 400) }
  const { deviceId, platform, version } = input || {}
  if (!/^[a-zA-Z0-9-]{16,64}$/.test(deviceId || '')) return json({ error: 'Bad device id' }, 400)
  if (!PLATFORMS.includes(platform)) return json({ error: 'Bad platform' }, 400)

  try {
    const auth = await getAccessToken(env)
    const path = `installs/${platform}_${deviceId}`
    const existing = await db(auth, path)
    if (existing) return json({ counted: false })
    await db(auth, path, 'PUT', {
      p: platform,
      at: Date.now(),
      ...(Number.isInteger(version) && version > 0 && version < 100000 ? { v: version } : {}),
    })
    return json({ counted: true })
  } catch (err) {
    console.error(err)
    return json({ error: 'Could not save' }, 500)
  }
}
