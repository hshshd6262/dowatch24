// Dowatch24 notify Worker
// - Every day (Cron Trigger in wrangler.toml) sends one "trending now" notification to everyone.
// - GET /run?key=ADMIN_KEY sends it right away (for testing).
//
// Secrets (Cloudflare dashboard → this Worker → Settings → Variables, type "Secret"):
//   FIREBASE_SERVICE_ACCOUNT  the Firebase service-account JSON key
//   TMDB_KEY                  your TMDB API key
//   ADMIN_KEY                 any long random password, for /run
import { db, getAccessToken, sendPush, SITE_URL } from '../../server/google.js'

const REMEMBER = 20 // don't repeat any of the last 20 trending picks

async function pickTrending(env, recent) {
  const res = await fetch(`https://api.themoviedb.org/3/trending/all/day?api_key=${env.TMDB_KEY}`)
  if (!res.ok) throw new Error(`TMDB ${res.status}`)
  const { results = [] } = await res.json()
  return results.find(r =>
    (r.media_type === 'movie' || r.media_type === 'tv') &&
    r.backdrop_path && (r.title || r.name) && !recent.includes(`${r.media_type}-${r.id}`),
  )
}

function shorten(text, max = 90) {
  if (!text) return ''
  return text.length <= max ? text : `${text.slice(0, text.lastIndexOf(' ', max))}…`
}

export async function sendTrending(env) {
  const auth = await getAccessToken(env)
  const state = (await db(auth, 'pushState/trending')) || {}
  const recent = state.recent || []

  const item = await pickTrending(env, recent)
  if (!item) return { sent: false, reason: 'nothing new trending' }

  const name = item.title || item.name
  const kind = item.media_type === 'movie' ? 'movie' : 'show'
  const link = `${SITE_URL}/${item.media_type}/${item.id}?utm_source=push&utm_medium=notification&utm_campaign=trending`

  await sendPush(auth, {
    topic: 'trending',
    title: `${name} is trending now 🔥`,
    body: shorten(item.overview) || `Everyone's watching this ${kind}. Watch now on Dowatch24.`,
    image: `https://image.tmdb.org/t/p/w780${item.backdrop_path}`,
    link,
  })

  await db(auth, 'pushState/trending', 'PUT', {
    recent: [`${item.media_type}-${item.id}`, ...recent].slice(0, REMEMBER),
    lastSentAt: Date.now(),
    lastTitle: name,
  })
  return { sent: true, title: name, link }
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendTrending(env).then(r => console.log('trending', r)).catch(e => console.error(e)))
  },

  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname !== '/run') return new Response('Dowatch24 notify worker', { status: 200 })
    if (!env.ADMIN_KEY || url.searchParams.get('key') !== env.ADMIN_KEY) return new Response('Forbidden', { status: 403 })
    try {
      return Response.json(await sendTrending(env))
    } catch (err) {
      return Response.json({ error: String(err.message || err) }, { status: 500 })
    }
  },
}
