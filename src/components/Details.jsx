import React, { useEffect, useState } from 'react'
import { api, posterUrl, formatRating, getYear } from '../lib/api.js'
import styles from './Details.module.css'

function formatRuntime(mins) {
  if (!mins) return null
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

function pickTrailer(videos) {
  const yt = (videos?.results || []).filter(v => v.site === 'YouTube')
  return (
    yt.find(v => v.type === 'Trailer' && v.official) ||
    yt.find(v => v.type === 'Trailer') ||
    yt.find(v => v.type === 'Teaser') ||
    null
  )
}

export default function Details({ item, type, onWatch, onTrailer, onClose }) {
  const [full, setFull] = useState(null)

  useEffect(() => {
    setFull(null)
    const load = type === 'movie' ? api.movieDetails : api.tvDetails
    load(item.id).then(setFull).catch(() => setFull({}))
  }, [item.id, type])

  const data = { ...item, ...(full || {}) }
  const title = data.title || data.name
  const year = getYear(data.release_date || data.first_air_date)
  const rating = formatRating(data.vote_average)
  const poster = posterUrl(data.poster_path, true)
  const genres = data.genres || []
  const trailer = full ? pickTrailer(full.videos) : null

  const extra = type === 'movie'
    ? formatRuntime(data.runtime)
    : data.number_of_seasons
      ? `${data.number_of_seasons} Season${data.number_of_seasons > 1 ? 's' : ''}`
      : null

  const firstSeason = (data.seasons || []).find(s => s.season_number > 0)?.season_number || 1

  return (
    <section className={styles.wrap}>
      {data.backdrop_path && (
        <img
          className={styles.backdrop}
          src={`https://image.tmdb.org/t/p/w1280${data.backdrop_path}`}
          alt=""
        />
      )}
      <div className={styles.shade} />

      {onClose && (
        <button className={styles.close} onClick={onClose} aria-label="Close details">✕</button>
      )}

      <div className={styles.inner}>
        <div className={styles.posterBox}>
          {poster
            ? <img src={poster} alt={title} />
            : <div className={styles.noPoster}>{title?.slice(0, 2)}</div>
          }
        </div>

        <div className={styles.info}>
          <div className={styles.pills}>
            <span className={`${styles.pill} ${styles.typePill}`}>{type === 'movie' ? 'MOVIE' : 'TV SERIES'}</span>
            {year && <span className={styles.pill}>{year}</span>}
            {rating && <span className={`${styles.pill} ${styles.ratingPill}`}>★ {rating}</span>}
            {extra && <span className={styles.pill}>{extra}</span>}
          </div>

          <h2 className={styles.title}>{title}</h2>
          {data.tagline && <p className={styles.tagline}>“{data.tagline}”</p>}

          {genres.length > 0 && (
            <div className={styles.genres}>
              {genres.map(g => <span key={g.id} className={styles.genre}>{g.name}</span>)}
            </div>
          )}

          {data.overview && <p className={styles.overview}>{data.overview}</p>}

          <div className={styles.actions}>
            <button
              className={styles.primary}
              onClick={() => (type === 'movie' ? onWatch() : onWatch(firstSeason, 1))}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
              {type === 'movie' ? 'Watch Movie' : 'Watch Now'}
            </button>
            <button
              className={styles.secondary}
              disabled={!trailer}
              onClick={() => trailer && onTrailer(`https://www.youtube.com/embed/${trailer.key}?autoplay=1`)}
            >
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10.5l5-3v9l-5-3z" /></svg>
              {full && !trailer ? 'No Trailer Available' : 'Watch Trailer'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
