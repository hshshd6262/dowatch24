// Building blocks for the private /stats page (styles, tiles, tables, charts).
// Lives outside functions/ so it isn't a web address of its own.

export const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
export const fmt = n => Number(n || 0).toLocaleString('en', { maximumFractionDigits: 0 })
export const fmt1 = n => Number(n || 0).toLocaleString('en', { maximumFractionDigits: 1 })
export const pct = (n, of, digits = 0) => (of ? `${((n / of) * 100).toFixed(digits)}%` : '–')

export const flag = cc => (/^[A-Z]{2}$/.test(cc) && cc !== 'XX' ? String.fromCodePoint(...[...cc].map(ch => 0x1f1a5 + ch.charCodeAt(0))) : '🌐')
let regionNames = null
try { regionNames = new Intl.DisplayNames(['en'], { type: 'region' }) } catch {}
export const countryName = cc => {
  if (!cc || cc === 'XX') return 'Unknown'
  if (cc === 'T1') return 'Tor network'
  try { return regionNames?.of(cc) || cc } catch { return cc }
}

const STYLE = `
:root{color-scheme:dark;--bg:#050505;--card:#111;--card2:#0b0b0b;--line:#222;--ink:#f2f2f2;--ink2:#a8a8a8;--ink3:#7a7a7a;--red:#e50914;--red2:#ff4d57;--band:rgba(229,9,20,.16)}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
a{color:inherit}
.top{position:sticky;top:0;z-index:5;background:rgba(5,5,5,.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.top-in{max-width:960px;margin:0 auto;padding:14px 16px 0}
h1{margin:0;font-size:20px}h1 b{color:var(--red)}
.sub{color:var(--ink3);margin:2px 0 10px;font-size:12.5px}
.tabs{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;margin:0 -16px;padding:0 16px}
.tabs::-webkit-scrollbar{display:none}
.tabs a{flex:none;padding:10px 12px;color:var(--ink2);text-decoration:none;font-size:14px;font-weight:600;border-bottom:2px solid transparent;white-space:nowrap}
.tabs a.on{color:var(--ink);border-bottom-color:var(--red)}
main{max-width:960px;margin:0 auto;padding:16px 16px 56px}
h2{margin:28px 0 10px;font-size:12.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink2)}
h2:first-child{margin-top:8px}
.range{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:14px;background:var(--card2)}
.range a{padding:6px 12px;border-radius:999px;border:1px solid #2a2a2a;color:var(--ink2);text-decoration:none;font-size:13px;font-weight:600}
.range a.on{background:var(--red);border-color:var(--red);color:#fff}
.range form{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-left:auto;font-size:13px;color:var(--ink3)}
input[type=date],input[type=number]{padding:6px 8px;border-radius:8px;border:1px solid #333;background:#151515;color:var(--ink);font:inherit}
.range button,.btn{padding:7px 12px;border:0;border-radius:8px;background:#2a2a2a;color:#fff;font:inherit;font-weight:700;cursor:pointer}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}
.tile{display:block;padding:14px 16px;border-radius:14px;background:var(--card);border:1px solid var(--line);text-decoration:none}
a.tile:hover{border-color:#3a3a3a}
.tile.hero{background:linear-gradient(135deg,#2a0507,#120203);border-color:#3a0a0d}
.tile .n{font-size:28px;font-weight:800;line-height:1.15;font-variant-numeric:tabular-nums}
.tile .l{color:var(--ink2);font-size:13px}.tile .s{color:var(--ink3);font-size:12px;margin-top:2px}
.chart{position:relative;margin-top:10px;padding:14px 14px 6px;border-radius:14px;background:var(--card);border:1px solid var(--line)}
.chart svg{display:block;width:100%;height:auto;overflow:visible;touch-action:pan-y}
.chart .cap{display:flex;flex-wrap:wrap;gap:4px 14px;justify-content:space-between;color:var(--ink3);font-size:12px;margin-bottom:6px}
.legend{display:flex;gap:14px;flex-wrap:wrap}.legend i{display:inline-block;width:14px;height:3px;border-radius:2px;margin-right:6px;vertical-align:middle;background:var(--red)}
.legend i.dash{background:repeating-linear-gradient(90deg,var(--red) 0 5px,transparent 5px 8px)}.legend i.band{height:10px;background:var(--band)}
.bar{fill:var(--red);pointer-events:none}.hit{fill:transparent}.bar.hov{fill:var(--red2)}
.axis{stroke:#333;stroke-width:1}.grid{stroke:#1c1c1c;stroke-width:1}.tick{fill:var(--ink3);font-size:11px}
.cross{stroke:#555;stroke-width:1;opacity:0;pointer-events:none}
.tip{position:absolute;z-index:3;pointer-events:none;padding:7px 10px;border-radius:8px;background:#1e1e1e;border:1px solid #333;font-size:12px;line-height:1.45;white-space:nowrap;opacity:0;transform:translate(-50%,-100%);transition:opacity .1s}
.tip b{display:block;color:var(--ink)}.tip span{display:block;color:var(--ink2)}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.tbl{overflow-x:auto;border-radius:14px;border:1px solid var(--line)}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;background:var(--card)}
th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #1b1b1b;font-size:13.5px}
th{color:var(--ink3);font-weight:600;font-size:12px;white-space:nowrap}td.num,th.num{text-align:right}
tr:last-child td{border-bottom:0}.meter{height:4px;margin-top:4px;border-radius:2px;background:var(--red);opacity:.85}
td.heat{text-align:center;font-weight:700}
.empty{color:var(--ink3);font-size:13px;padding:14px;background:var(--card);border:1px solid var(--line);border-radius:14px}
.note{color:var(--ink3);font-size:12px;margin-top:8px}
.calc{padding:16px;border-radius:14px;background:var(--card);border:1px solid var(--line)}
.calc label{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-weight:700}
.calc input[type=number]{width:140px;font-size:16px}
.calc .presets{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.calc .presets button{padding:5px 10px;border-radius:999px;border:1px solid #2a2a2a;background:transparent;color:var(--ink2);font:inherit;font-size:12.5px;cursor:pointer}
.est .n small{font-size:13px;font-weight:600;color:var(--ink3)}
@media(max-width:640px){.cols{grid-template-columns:1fr}.range form{margin-left:0}.tick{font-size:24px}.tile .n{font-size:24px}}
`

export const page = (body, status = 200, head = '') => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Dowatch24 stats</title><style>${STYLE}</style></head><body>${head}<main>${body}</main></body></html>`,
{ status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })

export const tile = (n, label, sub = '', { hero = false, href = '' } = {}) => {
  const tag = href ? 'a' : 'div'
  return `<${tag} class="tile${hero ? ' hero' : ''}"${href ? ` href="${href}"` : ''}><div class="n">${n}</div><div class="l">${label}</div>${sub ? `<div class="s">${sub}</div>` : ''}</${tag}>`
}

export const empty = text => `<div class="empty">${text}</div>`

// Ranked table with a small magnitude bar per row
export function rankTable(title, rows, unit) {
  if (!rows.length) return `<div><h2>${title}</h2>${empty('No data in this period yet.')}</div>`
  const max = Math.max(...rows.map(r => r.n))
  const total = rows.reduce((a, r) => a + r.n, 0)
  return `<div><h2>${title}</h2><div class="tbl"><table><thead><tr><th></th><th class="num">${unit}</th><th class="num">Share</th></tr></thead><tbody>
${rows.slice(0, 15).map(r => `<tr><td>${r.label}<div class="meter" style="width:${Math.max(3, (r.n / max) * 100).toFixed(1)}%"></div></td>
<td class="num">${fmt(r.n)}</td><td class="num">${pct(r.n, total)}</td></tr>`).join('')}
</tbody></table></div>${rows.length > 15 ? `<p class="note">+ ${rows.length - 15} more</p>` : ''}</div>`
}

// Hover script shared by the charts: each .hit carries data-l (title) and data-t (lines, "|" separated)
const HOVER = `<script>(()=>{const c=document.currentScript.previousElementSibling,t=c.querySelector('.tip'),s=c.querySelector('svg'),x=c.querySelector('.cross');
const off=()=>{t.style.opacity=0;if(x)x.style.opacity=0;c.querySelectorAll('.hov').forEach(b=>b.classList.remove('hov'))};
s.addEventListener('pointermove',e=>{const h=e.target.closest('.hit');if(!h){off();return}
c.querySelectorAll('.hov').forEach(b=>b.classList.remove('hov'));const b=h.nextElementSibling;if(b&&b.classList.contains('bar'))b.classList.add('hov');
if(x){const cx=h.getAttribute('data-x');x.setAttribute('x1',cx);x.setAttribute('x2',cx);x.style.opacity=1}
const r=c.getBoundingClientRect();t.innerHTML='<b>'+h.dataset.l+'</b>'+h.dataset.t.split('|').map(v=>'<span>'+v+'</span>').join('');
t.style.left=Math.min(Math.max(e.clientX-r.left,80),r.width-80)+'px';t.style.top=(e.clientY-r.top-12)+'px';t.style.opacity=1});
s.addEventListener('pointerleave',off)})()</script>`

// Bar chart, one series (no legend). buckets: [{ value, label, short, lines: [] }]
export function barChart(buckets, caption, maxLabel = v => fmt(v)) {
  if (!buckets.length) return ''
  const W = 800, H = 200, padB = 22, padT = 8
  const n = buckets.length
  const max = Math.max(1, ...buckets.map(b => b.value))
  const slot = W / n
  const gap = n > 60 ? 1 : 2
  const bw = Math.min(48, Math.max(1, slot - gap))
  const r = Math.min(4, bw / 2)
  const y = v => padT + (H - padB - padT) * (1 - v / max)
  const base = H - padB
  const bars = buckets.map((b, i) => {
    const x = i * slot + (slot - bw) / 2
    const top = y(b.value), h = base - top
    const shape = h <= 0 ? '' : h < r
      ? `<rect class="bar" x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}"/>`
      : `<path class="bar" d="M${x.toFixed(1)},${base}V${(top + r).toFixed(1)}q0,-${r} ${r},-${r}h${(bw - 2 * r).toFixed(1)}q${r},0 ${r},${r}V${base}Z"/>`
    return `<g><rect class="hit" x="${(i * slot).toFixed(1)}" y="0" width="${slot.toFixed(1)}" height="${H}" data-l="${esc(b.label)}" data-t="${esc(b.lines.join('|'))}"/>${shape}</g>`
  }).join('')
  const ticks = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i)
    .map(i => `<text class="tick" x="${(i * slot + slot / 2).toFixed(1)}" y="${H - 6}" text-anchor="${n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${esc(buckets[i].short)}</text>`).join('')
  return `<div class="chart"><div class="cap"><span>${caption}</span><span>max ${maxLabel(max)}</span></div>
<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(caption)}">${bars}<line class="axis" x1="0" x2="${W}" y1="${base}" y2="${base}"/>${ticks}</svg>
<div class="tip"></div></div>${HOVER}`
}

// Line chart: actual (solid) + projection (dashed) with a shaded likely range. points: [{ day, short, actual?, mid?, lo?, hi? }]
export function forecastChart(points, caption) {
  const W = 800, H = 240, padB = 24, padT = 10, padL = 4
  const n = points.length
  const max = Math.max(1, ...points.map(p => Math.max(p.actual ?? 0, p.hi ?? 0)))
  const x = i => padL + (W - padL * 2) * (n === 1 ? 0.5 : i / (n - 1))
  const y = v => padT + (H - padB - padT) * (1 - v / max)
  const path = key => points.map((p, i) => (p[key] == null ? null : `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`)).filter(Boolean)
  const actual = path('actual'), mid = path('mid')
  const bandIdx = points.map((p, i) => (p.lo == null ? -1 : i)).filter(i => i >= 0)
  const band = bandIdx.length
    ? `M${bandIdx.map(i => `${x(i).toFixed(1)},${y(points[i].hi).toFixed(1)}`).join('L')}L${bandIdx.slice().reverse().map(i => `${x(i).toFixed(1)},${y(points[i].lo).toFixed(1)}`).join('L')}Z` : ''
  const grid = [0.25, 0.5, 0.75, 1].map(f => `<line class="grid" x1="0" x2="${W}" y1="${y(max * f).toFixed(1)}" y2="${y(max * f).toFixed(1)}"/><text class="tick" x="${W}" y="${(y(max * f) - 4).toFixed(1)}" text-anchor="end">${fmt(max * f)}</text>`).join('')
  const slot = (W - padL * 2) / Math.max(1, n - 1)
  const hits = points.map((p, i) => {
    const lines = p.actual != null ? [`${fmt(p.actual)} installs (actual)`] : [`${fmt(p.mid)} installs expected`, `likely ${fmt(p.lo)} – ${fmt(p.hi)}`]
    return `<rect class="hit" x="${(x(i) - slot / 2).toFixed(1)}" y="0" width="${slot.toFixed(1)}" height="${H}" data-x="${x(i).toFixed(1)}" data-l="${esc(p.label)}" data-t="${esc(lines.join('|'))}"/>`
  }).join('')
  const tickIdx = [0, points.findIndex(p => p.today), n - 1].filter((v, i, a) => v >= 0 && a.indexOf(v) === i)
  const ticks = tickIdx.map(i => `<text class="tick" x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${esc(points[i].today ? 'Today' : points[i].short)}</text>`).join('')
  const todayX = points.findIndex(p => p.today)
  return `<div class="chart"><div class="cap"><span>${caption}</span><span class="legend"><span><i></i>Actual</span><span><i class="dash"></i>Expected</span><span><i class="band"></i>Likely range (90%)</span></span></div>
<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(caption)}">${grid}
${band ? `<path d="${band}" fill="var(--band)" stroke="none"/>` : ''}
${todayX >= 0 ? `<line class="axis" x1="${x(todayX).toFixed(1)}" x2="${x(todayX).toFixed(1)}" y1="${padT}" y2="${H - padB}" stroke-dasharray="2 4"/>` : ''}
${actual.length ? `<polyline points="${actual.join(' ')}" fill="none" stroke="var(--red)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
${mid.length ? `<polyline points="${mid.join(' ')}" fill="none" stroke="var(--red)" stroke-width="2" stroke-dasharray="6 5" stroke-linecap="round"/>` : ''}
<line class="axis" x1="0" x2="${W}" y1="${H - padB}" y2="${H - padB}"/>${ticks}
<line class="cross" x1="0" x2="0" y1="${padT}" y2="${H - padB}"/>${hits}</svg>
<div class="tip"></div></div>${HOVER}`
}
