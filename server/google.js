// Shared by the Cloudflare Pages Functions (functions/) and the notify Worker (workers/notify/).
// Talks to Firebase with the service-account key using plain web APIs, because
// firebase-admin doesn't run on Cloudflare.
//
// env.FIREBASE_SERVICE_ACCOUNT = the whole JSON key file from
// Firebase → Project settings → Service accounts → Generate new private key (stored as a secret).

const SCOPES = [
  'https://www.googleapis.com/auth/firebase.messaging',
  'https://www.googleapis.com/auth/firebase.database',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

export const DATABASE_URL = 'https://notification-f0da1-default-rtdb.firebaseio.com'
export const SITE_URL = 'https://dowatch24.com'

function serviceAccount(env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) throw new Error('FIREBASE_SERVICE_ACCOUNT secret is missing')
  return typeof env.FIREBASE_SERVICE_ACCOUNT === 'string'
    ? JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)
    : env.FIREBASE_SERVICE_ACCOUNT
}

const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const b64urlText = text => b64url(new TextEncoder().encode(text))

async function importKey(pem) {
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(body), c => c.charCodeAt(0))
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
}

// Signed JWT → Google OAuth access token (valid ~1 hour)
export async function getAccessToken(env) {
  const sa = serviceAccount(env)
  const now = Math.floor(Date.now() / 1000)
  const header = b64urlText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64urlText(JSON.stringify({
    iss: sa.client_email, scope: SCOPES, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }))
  const key = await importKey(sa.private_key)
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`))
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${b64url(sig)}` }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Google auth failed: ${JSON.stringify(data)}`)
  return { token: data.access_token, projectId: sa.project_id }
}

// Firebase Realtime Database over REST (server access ignores the public rules)
export async function db(auth, path, method = 'GET', body) {
  const res = await fetch(`${DATABASE_URL}/${path}.json?access_token=${auth.token}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`Database ${method} ${path} failed: ${res.status} ${await res.text()}`)
  return res.json()
}

// Send one notification to a device token or a topic
export async function sendPush(auth, { token, topic, title, body, image, link }) {
  const message = {
    ...(token ? { token } : { topic }),
    notification: { title, body, ...(image ? { image } : {}) },
    webpush: {
      notification: { icon: `${SITE_URL}/icon-192.png`, badge: `${SITE_URL}/icon-192.png`, ...(image ? { image } : {}) },
      fcm_options: { link: link || SITE_URL },
    },
  }
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${auth.projectId}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Send failed: ${JSON.stringify(data)}`)
  return data
}

// Put a device on a topic (e.g. "trending") so one send reaches everyone
export async function subscribeToTopic(auth, token, topic) {
  const res = await fetch('https://iid.googleapis.com/iid/v1:batchAdd', {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json', access_token_auth: 'true' },
    body: JSON.stringify({ to: `/topics/${topic}`, registration_tokens: [token] }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.results?.[0]?.error) throw new Error(`Topic subscribe failed: ${JSON.stringify(data)}`)
  return data
}
