// GET /stats: private Dowatch24 dashboard, split into tabs.
// Password = the ADMIN_KEY secret in Cloudflare Pages → Settings → Variables and Secrets.
// ?key=…&tab=overview|installs|usage|retention|notifications|locations|forecast
//  &r=today|7d|30d|1y|all|custom&from=YYYY-MM-DD&to=YYYY-MM-DD   (days in Nepal time)
import { DATABASE_URL, db, getAccessToken } from '../server/google.js'
import { barChart, countryName, empty, esc, flag, fmt, fmt1, forecastChart, page, pct, rankTable, tile } from '../server/stats-ui.js'

const DAY = 24 * 60 * 60 * 1000
const NEPAL_OFFSET = 5.75 * 60 * 60 * 1000
const PLATFORMS = { android: 'Android app', ios: 'iPhone app', desktop: 'Computer app' }
const PUSH_PLATFORMS = { 'android-app': 'Android app', 'ios-app': 'iPhone app', installed: 'Computer app', browser: 'Website' }
const RANGES = { today: 'Today', '7d': '7 days', '30d': '30 days', '1y': '1 year', all: 'All time' }
const TABS = { overview: 'Overview', installs: 'Installs', usage: 'Usage', retention: 'Return rate', notifications: 'Notifications', locations: 'Locations', forecast: 'Forecast' }
const RETURN_DAYS = [1, 3, 7, 14, 30]
const Z90 = 1.645   // 90% likely range

const dayKey = t => new Date(t + NEPAL_OFFSET).toISOString().slice(0, 10)
const dayStart = key => Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) - NEPAL_OFFSET
const isDay = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && !Number.isNaN(dayStart(v))
const daysBetween = (a, b) => Math.round((dayStart(b) - dayStart(a)) / DAY)
const addDays = (key, n) => dayKey(dayStart(key) + n * DAY)
const sumObj = o => Object.values(o || {}).reduce((a, b) => a + (Number(b) || 0), 0)
const addInto = (target, src) => { for (const [k, v] of Object.entries(src || {})) target[k] = (target[k] || 0) + (Number(v) || 0) }
const monthName = d => new Date(dayStart(d) + NEPAL_OFFSET).toLocaleString('en', { month: 'short', timeZone: 'UTC' })
const shortDay = d => `${monthName(d)} ${+d.slice(8, 10)}`
const minutes = sec => (sec >= 60 * 60 ? `${fmt1(sec / 3600)} h` : `${fmt1(sec / 60)} min`)

// Likely range for a share (Wilson interval): k out of n
function wilson(k, n, z = Z90) {
  if (!n) return null
  const p = Math.min(1, k / n)
  const d = 1 + (z * z) / n
  const c = (p + (z * z) / (2 * n)) / d
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d
  return { p, lo: Math.max(0, c - h), hi: Math.min(1, c + h), n }
}

// Password box (typing it avoids problems with #, &, + or spaces in a web address)
const loginForm = message => page(`<h1 style="margin-top:24px">Dowatch<b>24</b> stats</h1>
<p class="sub">${message}</p>
<form method="get" action="/stats" style="display:flex;gap:8px;max-width:420px">
<input name="key" type="password" placeholder="ADMIN_KEY password" autofocus required
 style="flex:1;padding:12px 14px;border-radius:10px;border:1px solid #333;background:#111;color:#fff;font:inherit">
<button style="padding:12px 18px;border:0;border-radius:10px;background:#e50914;color:#fff;font:inherit;font-weight:700">Open</button>
</form>`, 403)

async function getJson(auth, path, query = {}) {
  const q = new URLSearchParams({ ...query, access_token: auth.token })
  const res = await fetch(`${DATABASE_URL}/${path}.json?${q}`)
  if (!res.ok) throw new Error(`Database read failed (${path}): ${res.status}`)
  return (await res.json()) || {}
}

export async function onRequestGet({ request, env }) {
  const params = new URL(request.url).searchParams
  const key = (params.get('key') || '').trim()
  if (!env.ADMIN_KEY) return page('<h1>Stats are locked</h1><p>Add a secret named <b>ADMIN_KEY</b> in Cloudflare Pages → Settings → Variables and Secrets, redeploy, then open <code>/stats</code>.</p>', 403)
  if (!key) return loginForm('Enter your password to see the stats.')
  if (key !== String(env.ADMIN_KEY).trim()) return loginForm('Wrong password, try again. It must match the ADMIN_KEY secret in Cloudflare Pages exactly (capital letters count).')

  const tab = params.get('tab') in TABS ? params.get('tab') : 'overview'

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
    from = back === null ? '2024-01-01' : addDays(today, -back)
  }
  const last30 = addDays(today, -29)

  // ----- Load -----
  let installs, devices, daily, errors, cohorts, since
  try {
    const auth = await getAccessToken(env)
    ;[installs, devices, daily, errors, cohorts, since] = await Promise.all([
      db(auth, 'installs').then(v => v || {}),
      db(auth, 'devices').then(v => v || {}),
      getJson(auth, 'daily', { orderBy: '"$key"', startAt: `"${from < last30 ? from : last30}"`, endAt: `"${today}"` }),
      getJson(auth, 'notifyErrors', { orderBy: '"$key"', limitToLast: '40' }).catch(() => ({})),
      getJson(auth, 'cohort').catch(() => ({})),
      getJson(auth, 'retentionDays', { orderBy: '"$key"', limitToFirst: '1' }).then(v => Object.keys(v)[0] || null).catch(() => null),
    ])
  } catch (err) {
    return page(`<h1>Couldn't load stats</h1><p>${esc(err.message || err)}</p>`, 500)
  }

  const installList = Object.values(installs).filter(x => x && x.p in PLATFORMS && x.at)
  if (r === 'all') {
    const firsts = [...installList.map(x => x.at), ...Object.values(devices).map(x => x?.createdAt)].filter(Boolean).map(dayKey)
    from = [...firsts, ...Object.keys(daily)].sort()[0] || today
  }
  const start = dayStart(from), end = dayStart(to) + DAY
  const inRange = t => t >= start && t < end
  const days = []
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d)

  // ----- Installs -----
  const inst = { android: 0, ios: 0, desktop: 0 }
  const instCountry = {}, instCity = {}, installsByDay = {}
  for (const x of installList) {
    const d = dayKey(x.at)
    installsByDay[d] = (installsByDay[d] || 0) + 1
    if (!inRange(x.at)) continue
    inst[x.p]++
    const cc = x.c || 'XX'
    instCountry[cc] = (instCountry[cc] || 0) + 1
    if (x.city) { const k = `${x.city}|${cc}`; instCity[k] = (instCity[k] || 0) + 1 }
  }
  const instTotal = sumObj(inst), instAll = installList.length

  // ----- Usage (opens, people, time) -----
  const usage = (dayList) => {
    const o = { android: 0, ios: 0, desktop: 0 }, u = { android: 0, ios: 0, desktop: 0 }, t = { android: 0, ios: 0, desktop: 0 }
    const oc = {}, uc = {}
    const perDay = dayList.map(d => {
      const x = daily[d] || {}
      addInto(o, x.o); addInto(u, x.u); addInto(t, x.t); addInto(oc, x.oc); addInto(uc, x.uc)
      const people = sumObj(x.u)
      return { day: d, opens: sumObj(x.o), people, peopleSum: people, seconds: sumObj(x.t), installs: installsByDay[d] || 0 }
    })
    const opens = sumObj(o), peopleDays = sumObj(u), seconds = sumObj(t)
    return { o, u, t, oc, uc, perDay, opens, peopleDays, seconds,
      avgPeople: dayList.length ? peopleDays / dayList.length : 0,
      secPerPerson: peopleDays ? seconds / peopleDays : 0,
      secPerOpen: opens ? seconds / opens : 0,
      opensPerPerson: peopleDays ? opens / peopleDays : 0 }
  }
  const U = usage(days)
  const days30 = []; for (let d = last30; d <= today; d = addDays(d, 1)) days30.push(d)
  const U30 = usage(days30)
  const busiest = U.perDay.reduce((a, b) => (b.people > (a?.people || 0) ? b : a), null)

  // Day / week / month buckets for charts
  function buckets(perDay, pick, lines) {
    if (perDay.length <= 92) return perDay.map(p => ({ value: pick(p), label: `${shortDay(p.day)}, ${p.day.slice(0, 4)}`, short: shortDay(p.day), lines: lines(p) }))
    const size = perDay.length <= 731 ? 7 : 30
    const out = []
    for (let i = 0; i < perDay.length; i += size) {
      const g = perDay.slice(i, i + size)
      const sum = { day: g[0].day, opens: 0, people: 0, peopleSum: 0, seconds: 0, installs: 0 }
      for (const p of g) { sum.opens += p.opens; sum.peopleSum += p.people; sum.seconds += p.seconds; sum.installs += p.installs }
      sum.people = Math.round(sum.peopleSum / g.length)   // daily average
      out.push({ value: pick(sum), label: `${size === 7 ? 'Week' : 'Month'} of ${shortDay(g[0].day)}, ${g[0].day.slice(0, 4)}`, short: shortDay(g[0].day), lines: lines(sum) })
    }
    return out
  }
  const unit = days.length <= 92 ? 'per day' : days.length <= 731 ? 'per week' : 'per month'

  // ----- Return rate (retention), for phones installed in the range -----
  const sizeByDay = installsByDay
  const retention = {}
  let w7 = { back: 0, size: 0 }
  const cohortRows = []
  if (since) {
    for (const n of RETURN_DAYS) {
      let back = 0, size = 0
      for (const [d, c] of Object.entries(cohorts)) {
        if (d < since || d < from || d > to || daysBetween(d, today) <= n) continue
        back += Number(c?.[`d${n}`]) || 0
        size += sizeByDay[d] || 0
      }
      retention[n] = { back, size, w: wilson(back, size) }
    }
    for (const d of Object.keys(sizeByDay)) {
      if (d < since || d < from || d > to || daysBetween(d, today) <= 7) continue
      w7.back += Number(cohorts[d]?.w7) || 0
      w7.size += sizeByDay[d]
    }
    const cohortDays = Object.keys(sizeByDay).filter(d => d >= since && d >= from && d <= to).sort().reverse().slice(0, 21)
    for (const d of cohortDays) cohortRows.push({ day: d, size: sizeByDay[d], c: cohorts[d] || {}, age: daysBetween(d, today) })
  }

  // ----- Notifications -----
  const push = { 'android-app': 0, 'ios-app': 0, installed: 0, browser: 0 }
  let pushAll = 0
  for (const x of Object.values(devices)) {
    if (!x?.token) continue
    pushAll++
    if (inRange(x.createdAt)) push[x.platform in push ? x.platform : 'browser']++
  }
  const pushTotal = sumObj(push)
  const permOf = dayList => {
    const perm = { granted: 0, denied: 0, default: 0, unsupported: 0 }, steps = {}
    for (const d of dayList) {
      const x = daily[d] || {}
      for (const st of Object.keys(perm)) perm[st] += sumObj(x.perm?.[st])
      for (const [ev, byP] of Object.entries(x.n || {})) steps[ev] = (steps[ev] || 0) + sumObj(byP)
    }
    return { perm, steps, total: sumObj(perm) }
  }
  const P = permOf(days), P30 = permOf(days30)
  const recentErrors = Object.values(errors).filter(e => e && inRange(e.at)).sort((a, b) => b.at - a.at).slice(0, 15)

  // ----- Page shell -----
  const k = encodeURIComponent(key)
  const rangeQ = r === 'custom' ? `r=custom&from=${from}&to=${to}` : `r=${r}`
  const href = (t, q = rangeQ) => `/stats?key=${k}&tab=${t}&${q}`
  const label = r === 'custom' ? `${from} → ${to}` : RANGES[r]
  const header = `<div class="top"><div class="top-in"><h1>Dowatch<b>24</b> stats</h1>
<p class="sub">${esc(label)} · ${esc(from)} to ${esc(to)} · Nepal time</p>
<nav class="tabs">${Object.entries(TABS).map(([id, name]) => `<a href="${href(id)}" class="${tab === id ? 'on' : ''}">${name}</a>`).join('')}</nav></div></div>`
  const rangeBar = `<div class="range">${Object.entries(RANGES).map(([id, name]) => `<a href="${href(tab, `r=${id}`)}" class="${r === id ? 'on' : ''}">${name}</a>`).join('')}
<form method="get" action="/stats"><input type="hidden" name="key" value="${esc(key)}"><input type="hidden" name="tab" value="${tab}"><input type="hidden" name="r" value="custom">
<input type="date" name="from" value="${esc(from)}" max="${today}" aria-label="From"> to <input type="date" name="to" value="${esc(to)}" max="${today}" aria-label="To">
<button>Show</button></form></div>`
  const retTile = n => retention[n]?.size ? pct(retention[n].back, retention[n].size) : '–'
  const countryRows = obj => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([cc, n]) => ({ label: `${flag(cc)} ${esc(countryName(cc))}`, n }))
  const opensChart = () => U.opens
    ? barChart(buckets(U.perDay, p => p.opens, p => [`${fmt(p.opens)} opens`, `${fmt(p.people)} people${unit === 'per day' ? '' : ' per day (avg)'}`]), `App opens ${unit}`)
    : empty('No app opens in this period yet.')

  let body = ''

  if (tab === 'overview') {
    body = `${rangeBar}
<h2>At a glance</h2><div class="tiles">
${tile(fmt(instTotal), 'new installs', `${fmt(instAll)} all time`, { hero: true, href: href('installs') })}
${tile(fmt(Math.round(U.avgPeople)), 'people per day', 'average, opened the app', { href: href('usage') })}
${tile(U.seconds ? minutes(U.secPerPerson) : '–', 'time per person per day', 'average time in the app', { href: href('usage') })}
${tile(retTile(1), 'come back on day 1', retention[1]?.size ? `of ${fmt(retention[1].size)} installs` : 'needs a few days of data', { href: href('retention') })}
${tile(retTile(7), 'come back on day 7', retention[7]?.size ? `of ${fmt(retention[7].size)} installs` : 'needs a week of data', { href: href('retention') })}
${tile(P.total ? pct(P.perm.granted, P.total) : '–', 'have notifications on', 'of people opening the app', { href: href('notifications') })}
</div>
<h2>App opens</h2>${opensChart()}
<p class="note">Tap a box to open its tab. Use <b>Forecast</b> to see what 100k installs would look like.</p>`
  }

  if (tab === 'installs') {
    body = `${rangeBar}
<h2>Installs</h2><div class="tiles">
${tile(fmt(instTotal), 'new installs', `${fmt(instAll)} all time`, { hero: true })}
${Object.entries(PLATFORMS).map(([p, name]) => tile(fmt(inst[p]), name, pct(inst[p], instTotal) + ' of installs')).join('')}
</div>
<h2>Installs ${unit}</h2>${instTotal ? barChart(buckets(U.perDay, p => p.installs, p => [`${fmt(p.installs)} installs`]), `Installs ${unit}`) : empty('No installs in this period.')}
<p class="note">An install = the first time the app is opened on a device (counted once per device).</p>`
  }

  if (tab === 'usage') {
    body = `${rangeBar}
<h2>How much people use the app</h2><div class="tiles">
${tile(fmt(U.opens), 'times the app was opened', '', { hero: true })}
${tile(fmt(Math.round(U.avgPeople)), 'people per day (average)', busiest?.people ? `busiest: ${fmt(busiest.people)} on ${esc(busiest.day)}` : '')}
${tile(U.seconds ? minutes(U.secPerPerson) : '–', 'time per person per day', 'average time on screen')}
${tile(U.seconds ? minutes(U.secPerOpen) : '–', 'time per visit', 'average, each time it’s opened')}
${tile(U.peopleDays ? fmt1(U.opensPerPerson) : '–', 'opens per person per day', '')}
${tile(U.seconds ? minutes(U.seconds) : '–', 'total time in the app', 'everyone together')}
</div>
<h2>App opens ${unit}</h2>${opensChart()}
<h2>Time in the app ${unit}</h2>${U.seconds ? barChart(buckets(U.perDay, p => Math.round(p.seconds / 60), p => [`${minutes(p.seconds)} total`, p.peopleSum ? `${minutes(p.seconds / p.peopleSum)} per person per day` : '']), `Minutes in the app ${unit}`, v => `${fmt(v)} min`) : empty('Time in the app starts counting with this update.')}
<h2>By platform</h2><div class="tbl"><table><thead><tr><th></th><th class="num">Opens</th><th class="num">People (sum of days)</th><th class="num">Time</th><th class="num">Time / person / day</th></tr></thead><tbody>
${Object.entries(PLATFORMS).map(([p, name]) => `<tr><td>${name}</td><td class="num">${fmt(U.o[p])}</td><td class="num">${fmt(U.u[p])}</td><td class="num">${U.t[p] ? minutes(U.t[p]) : '–'}</td><td class="num">${U.t[p] && U.u[p] ? minutes(U.t[p] / U.u[p]) : '–'}</td></tr>`).join('')}
</tbody></table></div>
<p class="note">Time counts only while the app is on screen. People = devices that opened the app that day.</p>`
  }

  if (tab === 'retention') {
    const cell = (row, n) => {
      if (row.age <= n) return '<td class="heat" style="color:var(--ink3)">…</td>'
      const v = Number(row.c[`d${n}`]) || 0
      const share = row.size ? v / row.size : 0
      return `<td class="heat" style="background:rgba(229,9,20,${(0.08 + share * 0.7).toFixed(2)})" title="${v} of ${row.size}">${pct(v, row.size)}</td>`
    }
    body = `${rangeBar}
${!since ? empty('Return rate starts counting with this update. The first numbers (day 1) show up the day after people install.') : `
<h2>Of the people who installed, how many came back</h2><div class="tiles">
${RETURN_DAYS.map(n => tile(retTile(n), `come back on day ${n}`, retention[n]?.size ? `${fmt(retention[n].back)} of ${fmt(retention[n].size)} installs${retention[n].w ? ` · likely ${pct(retention[n].w.lo * 100, 100)}–${pct(retention[n].w.hi * 100, 100)}` : ''}` : 'not enough days yet', { hero: n === 1 })).join('')}
${tile(w7.size ? pct(w7.back, w7.size) : '–', 'came back within 7 days', w7.size ? `at least once, ${fmt(w7.back)} of ${fmt(w7.size)}` : 'needs a week of data')}
</div>
<h2>By install day</h2>
${cohortRows.length ? `<div class="tbl"><table><thead><tr><th>Installed on</th><th class="num">Installs</th>${RETURN_DAYS.map(n => `<th style="text-align:center">Day ${n}</th>`).join('')}<th style="text-align:center">Within 7 days</th></tr></thead><tbody>
${cohortRows.map(row => `<tr><td>${esc(row.day)}</td><td class="num">${fmt(row.size)}</td>${RETURN_DAYS.map(n => cell(row, n)).join('')}${row.age <= 7 ? '<td class="heat" style="color:var(--ink3)">…</td>' : `<td class="heat" style="background:rgba(229,9,20,${(0.08 + ((Number(row.c.w7) || 0) / row.size) * 0.7).toFixed(2)})">${pct(Number(row.c.w7) || 0, row.size)}</td>`}</tr>`).join('')}
</tbody></table></div>` : empty('No installs in this period since return-rate tracking started.')}`}
<p class="note">Day N = the share of phones that opened the app exactly N days after installing (day 1 = the next day).
“…” = that day hasn’t finished yet. Counted from ${since ? esc(since) : 'this update'}; earlier installs aren’t included.</p>`
  }

  if (tab === 'notifications') {
    const PERM_LABELS = { granted: ['Allowed', 'notifications on'], denied: ['Blocked', 'said no / turned off'], default: ['Not decided yet', 'not asked or no answer'], unsupported: ['Not possible', 'phone/browser can’t do notifications'] }
    const STEP_LABELS = [['shown', 'Card shown'], ['tap', 'Tapped “Turn on”'], ['allowed', 'Allowed'], ['saved', 'Signed up (saved)'], ['later', 'Tapped “Not now”'], ['denied', 'Chose “Don’t allow”'], ['closed', 'Closed the Allow box'], ['failed', 'Sign-up failed (error)']]
    const when = t => new Date(t + NEPAL_OFFSET).toISOString().slice(0, 16).replace('T', ' ')
    body = `${rangeBar}
<h2>Notifications turned on</h2><div class="tiles">
${tile(fmt(pushTotal), 'phones signed up', `${fmt(pushAll)} all time`, { hero: true })}
${Object.entries(PUSH_PLATFORMS).map(([p, name]) => tile(fmt(push[p]), name)).join('')}
</div>
<h2>Status of people opening the app</h2>
${P.total ? `<div class="tiles">${Object.entries(PERM_LABELS).map(([s, [name, hint]]) => tile(pct(P.perm[s], P.total), name, `${fmt(P.perm[s])} · ${hint}`, { hero: s === 'granted' })).join('')}</div>` : empty('No data yet for this period.')}
<h2>The notification card, step by step</h2>
<div class="tbl"><table><thead><tr><th>Step</th><th class="num">Count</th></tr></thead><tbody>
${STEP_LABELS.map(([s, name]) => `<tr><td>${name}</td><td class="num">${fmt(P.steps[s] || 0)}</td></tr>`).join('')}
</tbody></table></div>
${recentErrors.length ? `<h2>Latest sign-up errors</h2><div class="tbl"><table><thead><tr><th>When</th><th>Where</th><th>Error</th></tr></thead><tbody>
${recentErrors.map(e => `<tr><td style="white-space:nowrap">${esc(when(e.at))}</td><td>${esc(PLATFORMS[e.p] || e.p)} ${flag(e.c || 'XX')}</td><td>${esc(e.m)}<div style="color:var(--ink3);font-size:11px">${esc(e.ua)}</div></td></tr>`).join('')}
</tbody></table></div>` : ''}`
  }

  if (tab === 'locations') {
    const cityRows = Object.entries(instCity).sort((a, b) => b[1] - a[1]).map(([kk, n]) => { const [city, cc] = kk.split('|'); return { label: `${flag(cc)} ${esc(city)}`, n } })
    body = `${rangeBar}
<div class="cols">${rankTable('Installs by country', countryRows(instCountry), 'Installs')}${rankTable('App opens by country', countryRows(U.oc), 'Opens')}</div>
<div class="cols">${rankTable('Installs by city', cityRows, 'Installs')}${rankTable('People by country', countryRows(U.uc), 'Person-days')}</div>
<p class="note">Country and city come from Cloudflare. Installs from before location tracking show as Unknown.</p>`
  }

  if (tab === 'forecast') {
    // Install rate: last 30 days (or since the first install if newer)
    const firstInstallDay = installList.length ? dayKey(Math.min(...installList.map(x => x.at))) : today
    const basisDays = Math.max(1, Math.min(30, daysBetween(firstInstallDay, today) + 1))
    const basisFrom = addDays(today, -(basisDays - 1))
    const recent = installList.filter(x => dayKey(x.at) >= basisFrom).length
    const lambda = recent / basisDays
    const seLambda = Math.sqrt(Math.max(lambda, 0.5) / basisDays)   // how sure we are about the daily rate
    const project = h => {
      const mid = lambda * h
      const sd = Math.sqrt(lambda * h + h * h * seLambda * seLambda)
      return { mid, lo: Math.max(0, mid - Z90 * sd), hi: mid + Z90 * sd }
    }
    // Chart: last 30 days actual (cumulative), next 90 days expected
    const points = []
    let cum = installList.filter(x => dayKey(x.at) < last30).length
    for (const d of days30) { cum += installsByDay[d] || 0; points.push({ day: d, short: shortDay(d), label: `${shortDay(d)}, ${d.slice(0, 4)}`, actual: cum, today: d === today }) }
    for (let h = 1; h <= 90; h++) {
      const d = addDays(today, h), p = project(h)
      points.push({ day: d, short: shortDay(d), label: `${shortDay(d)}, ${d.slice(0, 4)}`, mid: instAll + p.mid, lo: instAll + p.lo, hi: instAll + p.hi })
    }
    const p30 = project(30), p90 = project(90)
    const target = 100000
    const daysTo = t => (lambda > 0 ? Math.ceil((t - instAll) / lambda) : null)
    const fastRate = lambda + Z90 * seLambda, slowRate = Math.max(0.0001, lambda - Z90 * seLambda)
    // "how long until": days → days / months / years, likely range underneath
    const span = d => (d == null || !Number.isFinite(d) ? 'never at this pace' : d <= 60 ? `${fmt(d)} days` : d <= 730 ? `${fmt1(d / 30.4)} months` : `${fmt1(d / 365)} years`)
    const reachTile = (t, name) => {
      if (instAll >= t) return tile('Reached', name, `${fmt(instAll)} installs so far`)
      if (!(lambda > 0)) return tile('–', name, 'needs installs in the last 30 days')
      const left = t - instAll
      const fast = Math.ceil(left / fastRate)
      const slow = lambda - Z90 * seLambda > 0 ? Math.ceil(left / slowRate) : null
      return tile(span(daysTo(t)), name, `around ${addDays(today, daysTo(t))} · likely ${span(fast)} – ${slow ? span(slow) : 'longer'}`)
    }

    // Rates for the "what if" calculator (last 30 days)
    const dau = wilson(Math.round(U30.avgPeople), Math.max(instAll, Math.round(U30.avgPeople)))
    const notif = wilson(P30.perm.granted, P30.total)
    const d7 = retention[7]?.size ? wilson(retention[7].back, retention[7].size) : null
    const rates = {
      dau: dau && { p: dau.p, lo: dau.lo, hi: dau.hi },
      opensPerPerson: U30.opensPerPerson || null,
      minPerPerson: U30.peopleDays && U30.seconds ? U30.secPerPerson / 60 : null,
      notif: notif && { p: notif.p, lo: notif.lo, hi: notif.hi },
      d7: d7 && { p: d7.p, lo: d7.lo, hi: d7.hi },
    }
    const enough = instAll >= 5
    body = `
<h2>Install growth</h2>
${!enough ? empty('Forecasts need at least 5 installs. Come back once more people have installed.') : `<div class="tiles">
${tile(fmt1(lambda), 'installs per day now', `average of the last ${basisDays} day${basisDays === 1 ? '' : 's'}`, { hero: true })}
${tile(fmt(instAll + p30.mid), 'installs in 30 days', `likely ${fmt(instAll + p30.lo)} – ${fmt(instAll + p30.hi)}`)}
${tile(fmt(instAll + p90.mid), 'installs in 90 days', `likely ${fmt(instAll + p90.lo)} – ${fmt(instAll + p90.hi)}`)}
${reachTile(10000, 'until 10k installs')}
${reachTile(target, 'until 100k installs')}
</div>
${forecastChart(points, 'Total installs: last 30 days and next 90 days')}
<p class="note">Assumes installs keep coming at today’s pace. The shaded “likely range” is wider when there is less data; promotions or viral moments would beat it.</p>`}

<h2>What if you had more installs?</h2>
<div class="calc">
<label>If Dowatch24 had <input id="wi" type="number" min="1" step="1000" value="${target}"> installs</label>
<div class="presets">${[10000, 50000, 100000, 500000, 1000000].map(v => `<button type="button" data-v="${v}">${v >= 1e6 ? v / 1e6 + 'M' : v / 1000 + 'k'}</button>`).join('')}</div>
<div class="tiles est" id="wo" style="margin-top:12px"></div>
<p class="note" id="wn"></p>
</div>
<script>(()=>{const R=${JSON.stringify(rates)};const i=document.getElementById('wi'),o=document.getElementById('wo'),note=document.getElementById('wn');
const f=n=>Math.round(n).toLocaleString('en');const t=(n,l,s)=>'<div class="tile"><div class="n">'+n+'</div><div class="l">'+l+'</div>'+(s?'<div class="s">'+s+'</div>':'')+'</div>';
const hrs=m=>m>=60?f(m/60)+' h':f(m)+' min';
function run(){const N=Math.max(0,Number(i.value)||0);let h='';const miss=[];
if(R.dau){const d=N*R.dau.p;h+=t(f(d),'people opening the app per day','likely '+f(N*R.dau.lo)+' – '+f(N*R.dau.hi));
 if(R.opensPerPerson)h+=t(f(d*R.opensPerPerson),'app opens per day','likely '+f(N*R.dau.lo*R.opensPerPerson)+' – '+f(N*R.dau.hi*R.opensPerPerson));
 if(R.minPerPerson)h+=t(hrs(d*R.minPerPerson),'watch time per day (everyone)','≈ '+(R.minPerPerson).toFixed(1)+' min per person');else miss.push('time in app');
}else miss.push('daily users');
if(R.notif)h+=t(f(N*R.notif.p),'can get your notifications','likely '+f(N*R.notif.lo)+' – '+f(N*R.notif.hi));else miss.push('notification share');
if(R.d7)h+=t(f(N*R.d7.p),'still opening it on day 7','likely '+f(N*R.d7.lo)+' – '+f(N*R.d7.hi));else miss.push('day-7 return rate');
o.innerHTML=h||'<div class="empty">Not enough data yet to estimate. Check back after a few days of app use.</div>';
note.textContent='Based on the last 30 days of real usage, scaled up. Likely range = 90% (the real number should land inside it 9 times out of 10 if behaviour stays the same).'+(miss.length?' Still collecting: '+miss.join(', ')+'.':'')}
i.addEventListener('input',run);document.querySelectorAll('.presets button').forEach(b=>b.addEventListener('click',()=>{i.value=b.dataset.v;run()}));run()})()</script>`
  }

  return page(body, 200, header)
}
