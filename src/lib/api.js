export const TMDB_KEY = import.meta.env.VITE_TMDB_KEY
export const EMBED_BASE = 'https://framextv.xyz'
export const IMG_BASE = 'https://image.tmdb.org/t/p/w300'
export const IMG_BASE_LG = 'https://image.tmdb.org/t/p/w780'

async function tmdbFetch(path) {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`https://api.themoviedb.org/3${path}${sep}api_key=${TMDB_KEY}`)
  if (!res.ok) throw new Error(`TMDB error: ${res.status}`)
  return res.json()
}

export const api = {
  trendingMovies: () => tmdbFetch('/trending/movie/week'),
  trendingTV: () => tmdbFetch('/trending/tv/week'),
  searchMovies: (q) => tmdbFetch(`/search/movie?query=${encodeURIComponent(q)}`),
  searchTV: (q) => tmdbFetch(`/search/tv?query=${encodeURIComponent(q)}`),
  movieDetails: (id) => tmdbFetch(`/movie/${id}?append_to_response=videos`),
  tvDetails: (id) => tmdbFetch(`/tv/${id}?append_to_response=videos`),
  seasonDetails: (id, season) => tmdbFetch(`/tv/${id}/season/${season}`),
}

export function movieEmbedUrl(tmdbId) {
  return `${EMBED_BASE}/embed/movie/${tmdbId}`
}

export function tvEmbedUrl(tmdbId, season, episode) {
  return `${EMBED_BASE}/embed/tv/${tmdbId}/${season}/${episode}`
}

// Video servers viewers can switch between under the player
export const SERVERS = [
  {
    id: 'server1',
    name: 'Server 1',
    movie: id => movieEmbedUrl(id),
    tv: (id, s, e) => tvEmbedUrl(id, s, e),
  },
  {
    id: 'server2',
    name: 'Server 2',
    movie: id => `https://cinesrc.st/embed/movie/${id}?color=%23e50914`,
    tv: (id, s, e) => `https://cinesrc.st/embed/tv/${id}?s=${s}&e=${e}&color=%23e50914`,
  },
]

// embed = { type: 'movie' | 'tv', id, season, episode }
export function embedUrl(embed, serverId) {
  const server = SERVERS.find(s => s.id === serverId) || SERVERS[0]
  return embed.type === 'movie'
    ? server.movie(embed.id)
    : server.tv(embed.id, embed.season, embed.episode)
}

export function posterUrl(path, large = false) {
  if (!path) return null
  return (large ? IMG_BASE_LG : IMG_BASE) + path
}

export function formatRating(rating) {
  if (!rating) return null
  return parseFloat(rating).toFixed(1)
}

export function getYear(dateStr) {
  return (dateStr || '').slice(0, 4)
}
