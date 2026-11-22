// GET /stats?key=ADMIN_KEY: private page with how many people installed the app.
// ADMIN_KEY is a secret you set in Cloudflare Pages → Settings → Variables and Secrets.
import { db, getAccessToken } from '../server/google.js'

const DAY = 24 * 60 * 60 * 1000
const NEPAL_OFFSET = 5.75 * 60 * 60 * 1000   // "today" starts at midnight Nepal time

const page = (body, status = 200) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Dowatch24 installs</title><style>
:root{color-scheme:dark}body{margin:0;padding:24px 16px;background:#050505;color:#f2f2f2;font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:720px;margin:0 auto}h1{margin:0 0 4px;font-size:24px}h1 b{color:#e50914}.sub{color:#888;margin:0 0 24px;font-size:13px}
.total{padding:22px;border-radius:18px;background:linear-gradient(135deg,#2a0507,#120203);border:1px solid #3a0a0d;margin-bottom:14px}
.total .n{font-size:52px;font-weight:800;line-height:1}.total .l{color:#bbb}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:22px}
.card{padding:16px;border-radius:14px;background:#111;border:1px solid #222}.card .n{font-size:28px;font-weight:800}.card .l{color:#999;font-size:13px}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}th,td{padding:9px 8px;text-align:right;border-bottom:1px solid #1d1d1d}
th:first-child,td:first-child{text-align:left}th{color:#888;font-weight:600;font-size:13px}
@media(max-width:520px){.grid{grid-template-columns:1fr}}</style></head><body><main>${body}</main></body></html>`,
  { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })

export async function onRequestGet({ request, env }) {
  const key = new URL(request.url).searchParams.get('key')
  if (!env.ADMIN_KEY) return page('<h1>Stats are locked</h1><p>Add a secret named <b>ADMIN_KEY</b> in Cloudflare Pages → Settings → Variables and Secrets, redeploy, then open <code>/stats?key=YOUR_KEY</code>.</p>', 403)
  if (key !== env.ADMIN_KEY) return page('<h1>Wrong key</h1>', 403)

  let rows = {}
  try {
    rows = (await db(await getAccessToken(env), 'installs')) || {}
  } catch (err) {
    return page(`<h1>Couldn't load stats</h1><p>${String(err.message || err).replace(/[<>&]/g, '')}</p>`, 500)
  }

  const now = Date.now()
  const todayStart = Math.floor((now + NEPAL_OFFSET) / DAY) * DAY - NEPAL_OFFSET
  const names = { android: 'Android app', ios: 'iPhone app', desktop: 'Computer app' }
  const count = { android: 0, ios: 0, desktop: 0 }
  const today = { android: 0, ios: 0, desktop: 0 }
  const week = { android: 0, ios: 0, desktop: 0 }
  const days = []   // last 14 days, newest first
  for (let i = 0; i < 14; i++) days.push({ start: todayStart - i * DAY, android: 0, ios: 0, desktop: 0 })

  for (const r of Object.values(rows)) {
    if (!r || !(r.p in count)) continue
    count[r.p]++
    if (r.at >= todayStart) today[r.p]++
    if (r.at >= now - 7 * DAY) week[r.p]++
    const d = days.find(x => r.at >= x.start && r.at < x.start + DAY)
    if (d) d[r.p]++
  }
  const total = count.android + count.ios + count.desktop
  const sum = o => o.android + o.ios + o.desktop
  const date = t => new Date(t + NEPAL_OFFSET).toISOString().slice(0, 10)

  return page(`
<h1>Dowatch<b>24</b> installs</h1>
<p class="sub">People who installed and opened the app (each device counted once). Times in Nepal time.</p>
<div class="total"><div class="n">${total.toLocaleString('en')}</div><div class="l">total installs · ${sum(today)} today · ${sum(week)} in the last 7 days</div></div>
<div class="grid">${Object.keys(names).map(p => `<div class="card"><div class="n">${count[p].toLocaleString('en')}</div><div class="l">${names[p]} · ${today[p]} today</div></div>`).join('')}</div>
<table><thead><tr><th>Day</th><th>Android</th><th>iPhone</th><th>Computer</th><th>Total</th></tr></thead><tbody>
${days.map(d => `<tr><td>${date(d.start)}${d.start === todayStart ? ' (today)' : ''}</td><td>${d.android}</td><td>${d.ios}</td><td>${d.desktop}</td><td><b>${sum(d)}</b></td></tr>`).join('')}
</tbody></table>`)
}
