import { TMDB_KEY } from './api.js'

// Smart search: exact title matches + "related" titles from actors,
// keywords, genres/languages and recommendations. Also forgives typos.

async function tmdb(path) {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`https://api.themoviedb.org/3${path}${sep}api_key=${TMDB_KEY}`)
  if (!res.ok) throw new Error(`TMDB error: ${res.status}`)
  return res.json()
}

const enc = encodeURIComponent
const tag = (list, type) => (list || []).map(r => ({ ...r, media_type: r.media_type || type }))
const isTitle = r => (r.media_type === 'movie' || r.media_type === 'tv') && r.poster_path

const MOVIE_GENRES = {
  action: 28, adventure: 12, animation: 16, animated: 16, cartoon: 16, comedy: 35, funny: 35,
  crime: 80, documentary: 99, drama: 18, family: 10751, kids: 10751, fantasy: 14, history: 36,
  historical: 36, horror: 27, scary: 27, music: 10402, musical: 10402, mystery: 9648,
  romance: 10749, romantic: 10749, love: 10749, 'sci-fi': 878, scifi: 878, 'science fiction': 878,
  thriller: 53, war: 10752, western: 37,
}

const TV_GENRES = {
  action: 10759, adventure: 10759, animation: 16, animated: 16, cartoon: 16, comedy: 35,
  funny: 35, crime: 80, documentary: 99, drama: 18, family: 10751, kids: 10762, mystery: 9648,
  reality: 10764, 'sci-fi': 10765, scifi: 10765, 'science fiction': 10765, fantasy: 10765,
  war: 10768, western: 37, soap: 10766, talk: 10767,
}

const LANGUAGES = {
  korean: 'ko', kdrama: 'ko', 'k-drama': 'ko', japanese: 'ja', anime: 'ja', hindi: 'hi',
  bollywood: 'hi', indian: 'hi', tamil: 'ta', telugu: 'te', spanish: 'es', french: 'fr',
  chinese: 'zh', cdrama: 'zh', turkish: 'tr', german: 'de', italian: 'it', thai: 'th',
  nepali: 'ne', arabic: 'ar', russian: 'ru', portuguese: 'pt',
}

function findTerms(q, map) {
  const text = ` ${q.toLowerCase()} `
  return Object.keys(map).filter(k => text.includes(` ${k} `)).map(k => map[k])
}

async function multi(q) {
  const d = await tmdb(`/search/multi?query=${enc(q)}`)
  return d.results || []
}

// Spelling similarity (0–1) using letter pairs — "brekin bad" ≈ "breaking bad"
const norm = t => (t || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
function pairs(t) {
  const out = new Map()
  for (const w of norm(t).split(' ')) {
    for (let i = 0; i < w.length - 1; i++) {
      const p = w.slice(i, i + 2)
      out.set(p, (out.get(p) || 0) + 1)
    }
  }
  return out
}
function similarity(a, b) {
  const pa = pairs(a)
  const pb = pairs(b)
  let both = 0
  let total = 0
  for (const [k, n] of pa) { both += Math.min(n, pb.get(k) || 0); total += n }
  for (const n of pb.values()) total += n
  return total ? (2 * both) / total : 0
}

// Typos: search each word (and short prefixes of it), then rank everything
// found by how closely the title is spelled to what was typed
async function fuzzyTitles(q) {
  const words = norm(q).split(' ').filter(w => w.length >= 3 && !['the', 'and', 'of'].includes(w))
  const tries = new Set()
  for (const w of words) {
    tries.add(w)
    if (w.length > 4) tries.add(w.slice(0, 4))
    if (w.length > 5) tries.add(w.slice(0, w.length - 1))
    if (w.length > 7) tries.add(w.slice(0, Math.ceil(w.length * 0.65)))
  }
  tries.delete(norm(q))

  const lists = await Promise.all([...tries].slice(0, 8).map(t => multi(t).catch(() => [])))
  const seen = new Set()
  return lists.flat()
    .filter(isTitle)
    .filter(r => !seen.has(`${r.media_type}-${r.id}`) && seen.add(`${r.media_type}-${r.id}`))
    .map(r => ({ r, score: similarity(q, r.title || r.name) + fame(r) / 3 }))
    .filter(x => x.score > 0.35)
    .sort((a, b) => b.score - a.score)
    .map(x => x.r)
}

// How well-known a title is (0 to ~0.6): famous titles win close calls
const fame = r => Math.log10(1 + (r.vote_count || 0)) * 0.12 + Math.log10(1 + (r.popularity || 0)) * 0.05

// Merge exact + typo-tolerant hits, best spelling match first
function rankTitles(q, direct, fuzzy) {
  const seen = new Set()
  const lower = norm(q)
  return [...direct.map(r => [r, 0.15]), ...fuzzy.map(r => [r, 0])]
    .filter(([r]) => !seen.has(`${r.media_type}-${r.id}`) && seen.add(`${r.media_type}-${r.id}`))
    .map(([r, bonus]) => {
      const title = norm(r.title || r.name)
      const prefix = title.startsWith(lower) ? 0.25 : 0
      return { r, score: similarity(q, title) + bonus + prefix + fame(r) }
    })
    .sort((a, b) => b.score - a.score)
    .map(x => x.r)
}

async function personCredits(person) {
  const d = await tmdb(`/person/${person.id}/combined_credits`)
  const seen = new Set()
  return [...(d.cast || []), ...(d.crew || []).filter(c => c.job === 'Director')]
    .filter(c => (c.media_type === 'movie' || c.media_type === 'tv') && c.poster_path && c.vote_count > 30)
    // skip talk shows, news, reality, docs and guest spots where they play themselves
    .filter(c => !(c.genre_ids || []).some(g => [99, 10763, 10764, 10767].includes(g)))
    .filter(c => !/(himself|herself|self)/i.test(c.character || ''))
    .filter(c => c.media_type !== 'tv' || c.episode_count >= 3 || c.job === 'Director')
    .filter(c => !seen.has(`${c.media_type}-${c.id}`) && seen.add(`${c.media_type}-${c.id}`))
    .sort((a, b) => b.popularity - a.popularity)
}

async function discover(type, params) {
  const d = await tmdb(`/discover/${type}?sort_by=popularity.desc&vote_count.gte=40&${params}`)
  return tag(d.results, type)
}

async function keywordTitles(q) {
  const d = await tmdb(`/search/keyword?query=${enc(q)}`)
  const lower = q.toLowerCase()
  const ids = (d.results || [])
    .filter(k => k.name.toLowerCase() === lower || k.name.toLowerCase().startsWith(`${lower} `))
    .slice(0, 3)
    .map(k => k.id)
  if (!ids.length) return []
  const kw = `with_keywords=${ids.join('|')}`
  const [m, t] = await Promise.all([discover('movie', kw), discover('tv', kw)])
  return [...m, ...t]
}

async function genreTitles(q) {
  const lang = findTerms(q, LANGUAGES)[0]
  const mg = findTerms(q, MOVIE_GENRES)
  const tg = findTerms(q, TV_GENRES)
  if (!lang && !mg.length && !tg.length) return []

  const langParam = lang ? `&with_original_language=${lang}` : ''
  const jobs = []
  if (mg.length || lang) jobs.push(discover('movie', `with_genres=${[...new Set(mg)].join(',')}${langParam}`))
  if (tg.length || lang) jobs.push(discover('tv', `with_genres=${[...new Set(tg)].join(',')}${langParam}`))
  return (await Promise.all(jobs)).flat()
}

async function recommendations(item) {
  const d = await tmdb(`/${item.media_type}/${item.id}/recommendations`)
  return tag(d.results, item.media_type)
}

const safe = p => p.catch(() => [])

export async function smartSearch(query) {
  const q = query.trim()
  const raw = await multi(q)

  let results = raw.filter(isTitle)
  const lower = q.toLowerCase()
  // Only treat it as an actor search when the query really is a name ("tom cruise", not "zombie")
  const person = raw.find(r => {
    const name = r.media_type === 'person' && r.name?.toLowerCase()
    return name && (name === lower || (lower.includes(' ') && name.startsWith(lower)))
  })

  // Typos: nothing matched by title and it's not an actor's name or a topic
  const isTopic = findTerms(q, LANGUAGES).length || findTerms(q, MOVIE_GENRES).length || findTerms(q, TV_GENRES).length
  if (!person && !isTopic && q.length >= 5) results = rankTitles(q, results, await safe(fuzzyTitles(q)))

  const [credits, keywords, genres, recs] = await Promise.all([
    person ? safe(personCredits(person)) : [],
    safe(keywordTitles(q)),
    safe(genreTitles(q)),
    !person && results[0] ? safe(recommendations(results[0])) : [],
  ])

  // An actor search: their filmography is the main result
  if (person && credits.length) {
    const mainKeys = new Set(credits.map(c => `${c.media_type}-${c.id}`))
    results = [...credits, ...results.filter(r => !mainKeys.has(`${r.media_type}-${r.id}`))]
    const best = [...credits].sort((a, b) => b.vote_count - a.vote_count)[0]
    recs.push(...await safe(recommendations(best)))
  }

  // Topic search ("zombie", "korean drama") with no title hits: promote those
  if (!results.length) {
    results = [...genres, ...keywords]
  }

  const seen = new Set(results.map(r => `${r.media_type}-${r.id}`))
  const related = [...recs, ...keywords, ...genres]
    .filter(isTitle)
    .filter(r => !seen.has(`${r.media_type}-${r.id}`) && seen.add(`${r.media_type}-${r.id}`))
    .slice(0, 24)

  // Dedupe main results too (genre + keyword lists can overlap)
  const mainSeen = new Set()
  results = results.filter(r => isTitle(r) && !mainSeen.has(`${r.media_type}-${r.id}`) && mainSeen.add(`${r.media_type}-${r.id}`))

  return {
    results: results.slice(0, 40),
    related,
    personName: person && credits.length ? person.name : null,
  }
}

// Instant suggestions while typing (one request, plus a typo retry when empty)
export async function suggest(query) {
  const q = query.trim()
  if (q.length < 2) return { titles: [], people: [] }

  // Exact search and typo-tolerant search run together for 5+ letters
  const [raw, fuzzy] = await Promise.all([
    multi(q),
    q.length >= 5 ? safe(fuzzyTitles(q)) : [],
  ])
  const titles = rankTitles(q, raw.filter(isTitle), fuzzy)

  const people = raw
    .filter(r => r.media_type === 'person' && r.known_for_department === 'Acting' && r.popularity > 1)
    .slice(0, 2)

  return { titles: titles.slice(0, 7), people }
}
