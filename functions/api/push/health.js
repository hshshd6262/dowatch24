// GET /api/push/health: is the Firebase key set up on Cloudflare, and does Google accept it?
// Reveals nothing secret, just ok / not ok.
import { getAccessToken } from '../../../server/google.js'

export async function onRequestGet({ env }) {
  const result = { keySet: Boolean(env.FIREBASE_SERVICE_ACCOUNT), googleAuth: 'not tried' }
  if (result.keySet) {
    try {
      await getAccessToken(env)
      result.googleAuth = 'ok'
    } catch (err) {
      result.googleAuth = 'failed'
      result.hint = String(err.message || err).includes('JSON')
        ? 'FIREBASE_SERVICE_ACCOUNT is not valid JSON: paste the whole key file'
        : 'Google rejected the key: generate a new private key and paste it again'
    }
  }
  return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}
