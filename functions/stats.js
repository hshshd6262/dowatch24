// GET /stats: private page with installs, app opens, notifications and where people are from.
// Password = the ADMIN_KEY secret in Cloudflare Pages → Settings → Variables and Secrets.
// ?key=…&r=today|7d|30d|1y|all|custom&from=YYYY-MM-DD&to=YYYY-MM-DD (days in Nepal time)
import { DATABASE_URL, db, getAccessToken } from '../server/google.js'

const DAY = 24 * 60 * 60 * 1000
const NEPAL_OFFSET = 5.75 * 60 * 60 * 1000
const PLATFORMS = { android: 'Android app', ios: 'iPhone app', desktop: 'Computer app' }
const PUSH_PLATFORMS = { 'android-app': 'Android app', 'ios-app': 'iPhone app', installed: 'Computer app', browser: 'Website' }
const RANGES = { today: 'Today', '7d': '7 days', '30d': '30 days', '1y': '1 year', all: 'All time' }

const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
const fmt = n => Number(n || 0).toLocaleString('en')
const dayKey = t => new Date(t + NEPAL_OFFSET).toISOString().slice(0, 10)
const dayStart = key => Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) - NEPAL_OFFSET
const isDay = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && !Number.isNaN(dayStart(v))
const flag = cc => (/^[A-Z]{2}$/.test(cc) && cc !== 'XX' ? String.fromCodePoint(...[...cc].map(ch => 0x1f1a5 + ch.charCodeAt(0))) : '🌐')
let regionNames = null
try { regionNames = new Intl.DisplayNames(['en'], { type: 'region' }) } catch {}
const countryName = cc => {
  if (!cc || cc === 'XX') return 'Unknown'
  if (cc === 'T1') return 'Tor network'
  try { return regionNames?.of(cc) || cc } catch { return cc }
}

const STYLE = `
:root{color-scheme:dark;--bg:#050505;--card:#111;--line:#222;--ink:#f2f2f2;--ink2:#a8a8a8;--ink3:#7a7a7a;--red:#e50914;--bar:#e50914}
*{box-sizing:border-box}body{margin:0;padding:24px 16px 48px;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:860px;margin:0 auto}h1{margin:0;font-size:24px}h1 b{color:var(--red)}
h2{margin:30px 0 10px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink2)}
.sub{color:var(--ink3);margin:2px 0 18px;font-size:13px}
.range{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:14px;background:#0b0b0b}
.range a{padding:7px 12px;border-radius:999px;border:1px solid #2a2a2a;color:var(--ink2);text-decoration:none;font-size:13px;font-weight:600}
.range a.on{background:var(--red);border-color:var(--red);color:#fff}
.range form{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-left:auto;font-size:13px;color:var(--ink3)}
.range input[type=date]{padding:6px 8px;border-radius:8px;border:1px solid #333;background:#151515;color:var(--ink);font:inherit}
.range button{padding:7px 12px;border:0;border-radius:8px;background:#2a2a2a;color:#fff;font:inherit;font-weight:700;cursor:pointer}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.tile{padding:14px 16px;border-radius:14px;background:var(--card);border:1px solid var(--line)}
.tile.hero{background:linear-gradient(135deg,#2a0507,#120203);border-color:#3a0a0d}
.tile .n{font-size:30px;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums}
.tile .l{color:var(--ink2);font-size:13px}.tile .s{color:var(--ink3);font-size:12px;margin-top:2px}
.chart{position:relative;margin-top:10px;padding:14px 14px 6px;border-radius:14px;background:var(--card);border:1px solid var(--line)}
.chart svg{display:block;width:100%;height:auto;overflow:visible}
.chart .cap{display:flex;justify-content:space-between;color:var(--ink3);font-size:12px;margin-bottom:6px}
.bar{fill:var(--bar);pointer-events:none}.hit{fill:transparent;cursor:default}.hit:hover+.bar,.bar.hov{fill:#ff4d57}
.axis{stroke:#333;stroke-width:1}.tick{fill:var(--ink3);font-size:11px}
.tip{position:absolute;pointer-events:none;padding:7px 10px;border-radius:8px;background:#1e1e1e;border:1px solid #333;font-size:12px;line-height:1.4;white-space:nowrap;opacity:0;transform:translate(-50%,-100%);transition:opacity .1s}
.tip b{display:block;color:var(--ink)}.tip span{color:var(--ink2)}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #1b1b1b;font-size:13.5px}
th{color:var(--ink3);font-weight:600;font-size:12px}td.num,th.num{text-align:right}
tr:last-child td{border-bottom:0}.meter{height:4px;margin-top:4px;border-radius:2px;background:var(--bar);opacity:.85}
.empty{color:var(--ink3);font-size:13px;padding:14px;background:var(--card);border:1px solid var(--line);border-radius:14px}
.note{color:var(--ink3);font-size:12px;margin-top:8px}
@media(max-width:640px){.cols{grid-template-columns:1fr}.range form{margin-left:0}.tick{font-size:24px}}
`

const page = (body, status = 200) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Dowatch24 stats</title><style>${STYLE}</style></head><body><main>${body}</main></body></html>`,
{ status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })

// Password box (typing it avoids problems with #, &, + or spaces in a web address)
const loginForm = message => page(`<h1>Dowatch<b>24</b> stats</h1>
<p class="sub">${message}</p>
<form method="get" action="/stats" style="display:flex;gap:8px;max-width:420px">
<input name="key" type="password" placeholder="ADMIN_KEY password" autofocus required
 style="flex:1;padding:12px 14px;border-radius:10px;border:1px solid #333;background:#111;color:#fff;font:inherit">
<button style="padding:12px 18px;border:0;border-radius:10px;background:#e50914;color:#fff;font:inherit;font-weight:700">Open</button>
</form>`, 403)

// Daily counters for a range of days (keys are YYYY-MM-DD)
async function dailyRange(auth, from, to) {
  const q = new URLSearchParams({ orderBy: '"$key"', startAt: `"${from}"`, endAt: `"${to}"`, access_token: auth.token })
  const res = await fetch(`${DATABASE_URL}/daily.json?${q}`)
  if (!res.ok) throw new Error(`Database read failed: ${res.status}`)
  return (await res.json()) || {}
}

const sumObj = o => Object.values(o || {}).reduce((a, b) => a + (Number(b) || 0), 0)
const addInto = (target, src) => { for (const [k, v] of Object.entries(src || {})) target[k] = (target[k] || 0) + (Number(v) || 0) }

// Ranked table with a small magnitude bar per row
function rankTable(title, rows, unit) {
  if (!rows.length) return `<div><h2>${title}</h2><div class="empty">No data in this period yet.</div></div>`
  const max = Math.max(...rows.map(r => r.n))
  const total = rows.reduce((a, r) => a + r.n, 0)
  return `<div><h2>${title}</h2><table><thead><tr><th></th><th class="num">${unit}</th><th class="num">Share</th></tr></thead><tbody>
${rows.slice(0, 12).map(r => `<tr><td>${r.label}<div class="meter" style="width:${Math.max(3, (r.n / max) * 100).toFixed(1)}%"></div></td>
<td class="num">${fmt(r.n)}</td><td class="num">${Math.round((r.n / total) * 100)}%</td></tr>`).join('')}
</tbody></table>${rows.length > 12 ? `<p class="note">+ ${rows.length - 12} more</p>` : ''}</div>`
}

// Bar chart of opens over time (one series, so no legend; hover shows the numbers)
function opensChart(buckets, unitLabel) {
  const W = 800, H = 200, padB = 22, padT = 8
  const n = buckets.length
  const max = Math.max(1, ...buckets.map(b => b.opens))
  const slot = W / n
  const gap = n > 60 ? 1 : 2
  const bw = Math.max(1, slot - gap)
  const r = Math.min(4, bw / 2)
  const y = v => padT + (H - padB - padT) * (1 - v / max)
  const base = H - padB
  const bars = buckets.map((b, i) => {
    const x = i * slot + gap / 2
    const top = y(b.opens)
    const h = base - top
    const shape = h <= 0 ? '' : h < r
      ? `<rect class="bar" x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}"/>`
      : `<path class="bar" d="M${x.toFixed(1)},${base}V${(top + r).toFixed(1)}q0,-${r} ${r},-${r}h${(bw - 2 * r).toFixed(1)}q${r},0 ${r},${r}V${base}Z"/>`
    return `<g><rect class="hit" x="${(i * slot).toFixed(1)}" y="0" width="${slot.toFixed(1)}" height="${H}" data-l="${esc(b.label)}" data-o="${b.opens}" data-u="${b.users}"/>${shape}</g>`
  }).join('')
  const ticks = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i)
    .map(i => `<text class="tick" x="${(i * slot + slot / 2).toFixed(1)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${esc(buckets[i].short)}</text>`).join('')
  return `<div class="chart"><div class="cap"><span>App opens ${unitLabel}</span><span>max ${fmt(max)}</span></div>
<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="App opens ${unitLabel}">${bars}<line class="axis" x1="0" x2="${W}" y1="${base}" y2="${base}"/>${ticks}</svg>
<div class="tip" id="tip"></div></div>
<script>(()=>{const c=document.currentScript.previousElementSibling,t=c.querySelector('#tip'),s=c.querySelector('svg');
s.addEventListener('pointermove',e=>{const h=e.target.closest('.hit');if(!h){t.style.opacity=0;return}
c.querySelectorAll('.bar.hov').forEach(b=>b.classList.remove('hov'));const b=h.nextElementSibling;b&&b.classList.add('hov');
const r=c.getBoundingClientRect();t.innerHTML='<b>'+h.dataset.l+'</b><span>'+Number(h.dataset.o).toLocaleString('en')+' opens · '+Number(h.dataset.u).toLocaleString('en')+' people</span>';
t.style.left=Math.min(Math.max(e.clientX-r.left,70),r.width-70)+'px';t.style.top=(e.clientY-r.top-10)+'px';t.style.opacity=1});
s.addEventListener('pointerleave',()=>{t.style.opacity=0;c.querySelectorAll('.bar.hov').forEach(b=>b.classList.remove('hov'))})})()</script>`
}

export async function onRequestGet({ request, env }) {
  const params = new URL(request.url).searchParams
  const key = (params.get('key') || '').trim()
  if (!env.ADMIN_KEY) return page('<h1>Stats are locked</h1><p>Add a secret named <b>ADMIN_KEY</b> in Cloudflare Pages → Settings → Variables and Secrets, redeploy, then open <code>/stats</code>.</p>', 403)
  if (!key) return loginForm('Enter your password to see the stats.')
  if (key !== String(env.ADMIN_KEY).trim()) return loginForm('Wrong password, try again. It must match the ADMIN_KEY secret in Cloudflare Pages exactly (capital letters count).')

  // ----- Date range (Nepal days) -----
  const today = dayKey(Date.now())
  let r = params.get('r') || '30d'
  let from, to = today
  if (r === 'custom' && isDay(params.get('from')) && isDay(params.get('to'))) {
    from = params.get('from'); to = params.get('to')
    if (from > to) [from, to] = [to, from]
    if (to > today) to = today
  } else {
    if (!(r in RANGES)) r = '30d'
    const back = { today: 0, '7d': 6, '30d': 29, '1y': 364, all: null }[r]
    from = back === null ? '2024-01-01' : dayKey(dayStart(today) - back * DAY)
  }

  let installs = {}, devices = {}, daily = {}
  try {
    const auth = await getAccessToken(env)
    ;[installs, devices, daily] = await Promise.all([
      db(auth, 'installs').then(v => v || {}),
      db(auth, 'devices').then(v => v || {}),
      dailyRange(auth, from, to),
    ])
  } catch (err) {
    return page(`<h1>Couldn't load stats</h1><p>${esc(err.message || err)}</p>`, 500)
  }

  // "All time" starts at the first day anything was recorded
  if (r === 'all') {
    const firsts = [...Object.values(installs).map(x => x?.at), ...Object.values(devices).map(x => x?.createdAt)].filter(Boolean)
    const firstDaily = Object.keys(daily).sort()[0]
    const candidates = [...firsts.map(dayKey), firstDaily].filter(Boolean).sort()
    from = candidates[0] || today
  }
  const start = dayStart(from), end = dayStart(to) + DAY
  const inRange = t => t >= start && t < end
  const days = []
  for (let t = start; t < end; t += DAY) days.push(dayKey(t))

  // ----- Installs -----
  const inst = { android: 0, ios: 0, desktop: 0 }
  const instCountry = {}, instCity = {}
  let instAll = 0
  for (const x of Object.values(installs)) {
    if (!x || !(x.p in inst)) continue
    instAll++
    if (!inRange(x.at)) continue
    inst[x.p]++
    const cc = x.c || 'XX'
    instCountry[cc] = (instCountry[cc] || 0) + 1
    if (x.city) { const k = `${x.city}|${cc}`; instCity[k] = (instCity[k] || 0) + 1 }
  }
  const instTotal = sumObj(inst)

  // ----- Opens -----
  const opens = { android: 0, ios: 0, desktop: 0 }, people = { android: 0, ios: 0, desktop: 0 }
  const openCountry = {}, peopleCountry = {}
  const perDay = days.map(d => {
    const x = daily[d] || {}
    addInto(opens, x.o); addInto(people, x.u); addInto(openCountry, x.oc); addInto(peopleCountry, x.uc)
    return { day: d, opens: sumObj(x.o), users: sumObj(x.u) }
  })
  const opensTotal = sumObj(opens)
  const peopleDays = sumObj(people)
  const avgDaily = days.length ? peopleDays / days.length : 0
  const busiest = perDay.reduce((a, b) => (b.users > (a?.users || 0) ? b : a), null)

  // Chart buckets: days, or weeks / months for long ranges
  const monthName = d => new Date(dayStart(d) + NEPAL_OFFSET).toLocaleString('en', { month: 'short', timeZone: 'UTC' })
  const shortDay = d => `${monthName(d)} ${+d.slice(8, 10)}`
  let buckets, unitLabel
  if (perDay.length <= 92) {
    buckets = perDay.map(p => ({ ...p, label: shortDay(p.day) + ', ' + p.day.slice(0, 4), short: shortDay(p.day) }))
    unitLabel = 'per day'
  } else if (perDay.length <= 731) {
    buckets = []
    for (let i = 0; i < perDay.length; i += 7) {
      const wk = perDay.slice(i, i + 7)
      buckets.push({ opens: wk.reduce((a, b) => a + b.opens, 0), users: Math.round(wk.reduce((a, b) => a + b.users, 0) / wk.length),
        label: `Week of ${shortDay(wk[0].day)}, ${wk[0].day.slice(0, 4)} (people = daily average)`, short: shortDay(wk[0].day) })
    }
    unitLabel = 'per week'
  } else {
    const byMonth = new Map()
    for (const p of perDay) {
      const m = p.day.slice(0, 7)
      if (!byMonth.has(m)) byMonth.set(m, { opens: 0, users: 0, n: 0, first: p.day })
      const b = byMonth.get(m); b.opens += p.opens; b.users += p.users; b.n++
    }
    buckets = [...byMonth.values()].map(b => ({ opens: b.opens, users: Math.round(b.users / b.n),
      label: `${monthName(b.first)} ${b.first.slice(0, 4)} (people = daily average)`, short: `${monthName(b.first)} ${b.first.slice(2, 4)}` }))
    unitLabel = 'per month'
  }

  // ----- Notifications allowed -----
  const push = { 'android-app': 0, 'ios-app': 0, installed: 0, browser: 0 }
  let pushAll = 0
  for (const x of Object.values(devices)) {
    if (!x?.token) continue
    pushAll++
    if (inRange(x.createdAt)) push[x.platform in push ? x.platform : 'browser']++
  }
  const pushTotal = sumObj(push)

  // ----- Page -----
  const k = encodeURIComponent(key)
  const label = r === 'custom' ? `${from} → ${to}` : RANGES[r]
  const rangeLinks = Object.entries(RANGES).map(([id, name]) => `<a href="/stats?key=${k}&r=${id}" class="${r === id ? 'on' : ''}">${name}</a>`).join('')
  const countryRows = obj => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([cc, n]) => ({ label: `${flag(cc)} ${esc(countryName(cc))}`, n }))
  const cityRows = Object.entries(instCity).sort((a, b) => b[1] - a[1]).map(([kk, n]) => { const [city, cc] = kk.split('|'); return { label: `${flag(cc)} ${esc(city)}`, n } })

  return page(`
<h1>Dowatch<b>24</b> stats</h1>
<p class="sub">${esc(label)} · ${esc(from)} to ${esc(to)} · days in Nepal time</p>

<div class="range">${rangeLinks}
<form method="get" action="/stats"><input type="hidden" name="key" value="${esc(key)}"><input type="hidden" name="r" value="custom">
<input type="date" name="from" value="${esc(from)}" max="${today}" aria-label="From"> to <input type="date" name="to" value="${esc(to)}" max="${today}" aria-label="To">
<button>Show</button></form></div>

<h2>Installs</h2>
<div class="tiles">
<div class="tile hero"><div class="n">${fmt(instTotal)}</div><div class="l">new installs</div><div class="s">${fmt(instAll)} all time</div></div>
${Object.entries(PLATFORMS).map(([p, name]) => `<div class="tile"><div class="n">${fmt(inst[p])}</div><div class="l">${name}</div></div>`).join('')}
</div>

<h2>App opens</h2>
<div class="tiles">
<div class="tile hero"><div class="n">${fmt(opensTotal)}</div><div class="l">times the app was opened</div></div>
<div class="tile"><div class="n">${fmt(Math.round(avgDaily))}</div><div class="l">people per day (average)</div>${busiest && busiest.users ? `<div class="s">busiest: ${fmt(busiest.users)} on ${esc(busiest.day)}</div>` : ''}</div>
${Object.entries(PLATFORMS).map(([p, name]) => `<div class="tile"><div class="n">${fmt(opens[p])}</div><div class="l">${name} opens</div></div>`).join('')}
</div>
${opensTotal ? opensChart(buckets, unitLabel) : '<div class="empty" style="margin-top:10px">No app opens in this period yet. Opens are counted from the day this update went live.</div>'}

<h2>Notifications allowed</h2>
<div class="tiles">
<div class="tile hero"><div class="n">${fmt(pushTotal)}</div><div class="l">turned notifications on</div><div class="s">${fmt(pushAll)} all time</div></div>
${Object.entries(PUSH_PLATFORMS).map(([p, name]) => `<div class="tile"><div class="n">${fmt(push[p])}</div><div class="l">${name}</div></div>`).join('')}
</div>

<div class="cols">
${rankTable('Installs by country', countryRows(instCountry), 'Installs')}
${rankTable('App opens by country', countryRows(openCountry), 'Opens')}
</div>
<div class="cols">
${rankTable('Installs by city', cityRows, 'Installs')}
${rankTable('People by country (daily)', countryRows(peopleCountry), 'Person-days')}
</div>
<p class="note">Installs = first open of the app on a device (counted once). Opens = every launch. People = devices that opened the app that day.
Country/city come from Cloudflare and start with this update; earlier installs show as Unknown.</p>
`)
}
