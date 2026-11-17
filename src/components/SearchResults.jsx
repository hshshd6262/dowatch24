import React, { useEffect, useMemo, useState } from 'react'
import { api, posterUrl, formatRating, getYear } from '../lib/api.js'
import MediaGrid from './MediaGrid.jsx'
import styles from './SearchResults.module.css'

const isAnime = r => (r.genre_ids || []).includes(16) && r.original_language === 'ja'

const FILTERS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'movie', label: 'Movies', test: r => r.media_type === 'movie' },
  { id: 'tv', label: 'TV Shows', test: r => r.media_type === 'tv' },
  { id: 'anime', label: 'Anime', test: isAnime },
]

const ICONS = {
  all: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  movie: <path d="M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4" />,
  tv: <path d="M3 6h18v12H3zM8 21h8M12 18v3" />,
  anime: <path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" />,
}

function runtimeLabel(full, type) {
  const mins = type === 'movie' ? full?.runtime : full?.episode_run_time?.[0] || full?.last_episode_to_air?.runtime
  if (!mins) return null
  const h = Math.floor(mins / 60)
  return h ? `${h}h ${mins % 60}m` : `${mins}m`
}

function TopResult({ item, onSelect }) {
  const [full, setFull] = useState(null)
  const type = item.media_type

  useEffect(() => {
    setFull(null)
    const load = type === 'movie' ? api.movieDetails : api.tvDetails
    load(item.id).then(setFull).catch(() => {})
  }, [item.id, type])

  const title = item.title || item.name
  const image = item.backdrop_path
    ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
    : posterUrl(item.poster_path, true)
  const meta = [
    getYear(item.release_date || item.first_air_date),
    runtimeLabel(full, type),
    type === 'movie' ? 'Movie' : 'Series',
  ].filter(Boolean)
  const rating = formatRating(item.vote_average)

  return (
    <div className={styles.top}>
      <button className={styles.topImage} onClick={() => onSelect(item)} aria-label={`Open ${title}`}>
        {image ? <img src={image} alt="" /> : <span>{title?.slice(0, 2)}</span>}
      </button>
      <div className={styles.topInfo}>
        <h3 className={styles.topTitle}>{title}</h3>
        <p className={styles.topMeta}>
          {meta.map((m, i) => <span key={i}>{m}</span>)}
          {rating && <span className={styles.topRating}>★ {rating}</span>}
        </p>
        {item.overview && <p className={styles.topOverview}>{item.overview}</p>}
        <button className={styles.watch} onClick={() => onSelect(item)}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
          Watch Now
        </button>
      </div>
    </div>
  )
}

// Search page: filter chips, a big "Top result", then everything else as "More Like This"
export default function SearchResults({ query, person, results, related, loading, type, onSelect, selectedId }) {
  const [filter, setFilter] = useState('all')
  useEffect(() => setFilter('all'), [query])

  const all = useMemo(() => {
    const seen = new Set()
    return [...results, ...related].filter(r => {
      const key = `${r.media_type}-${r.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [results, related])

  const counts = Object.fromEntries(FILTERS.map(f => [f.id, all.filter(f.test).length]))
  const shown = all.filter(FILTERS.find(f => f.id === filter).test)
  const [top, ...rest] = shown

  return (
    <section className={styles.wrap}>
      <div className={styles.filters} role="tablist" aria-label="Filter results">
        {FILTERS.filter(f => f.id !== 'anime' || counts.anime > 0).map(f => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            className={`${styles.chip} ${filter === f.id ? styles.chipOn : ''}`}
            onClick={() => setFilter(f.id)}
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">{ICONS[f.id]}</svg>
            {f.label}
            {!loading && <span className={styles.count}>{counts[f.id]}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <>
          <p className={styles.label}>Top result</p>
          <div className={`${styles.top} ${styles.skeleton}`} />
          <MediaGrid items={[]} type={type} loading onSelect={onSelect} />
        </>
      ) : !top ? (
        <p className={styles.empty}>No {filter === 'all' ? '' : FILTERS.find(f => f.id === filter).label.toLowerCase() + ' '}results for “{query}”</p>
      ) : (
        <>
          <p className={styles.label}>{person ? `Top result · ${person}` : 'Top result'}</p>
          <TopResult key={`${top.media_type}-${top.id}`} item={top} onSelect={onSelect} />
          {rest.length > 0 && (
            <>
              <h2 className={styles.more}>{person ? `More with ${person}` : 'More Like This'}</h2>
              <MediaGrid items={rest} type={type} onSelect={onSelect} selectedId={selectedId} />
            </>
          )}
        </>
      )}
    </section>
  )
}
