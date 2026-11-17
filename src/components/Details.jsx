import React, { useEffect, useRef, useState } from 'react'
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

// Trailer preview: starts muted in the background a moment after the panel opens
const PREVIEW_FALLBACK = 2500
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const saveData = () => navigator.connection?.saveData === true

function previewSrc(key) {
  const params = new URLSearchParams({
    autoplay: 1, mute: 1, controls: 0, loop: 1, playlist: key, playsinline: 1,
    rel: 0, modestbranding: 1, iv_load_policy: 3, disablekb: 1, fs: 0, enablejsapi: 1,
    origin: window.location.origin,
  })
  return `https://www.youtube-nocookie.com/embed/${key}?${params}`
}

// preview: false while the real player is open, so two videos never play at once
export default function Details({ item, type, onWatch, onTrailer, onClose, preview = true }) {
  const [full, setFull] = useState(null)
  const [previewShown, setPreviewShown] = useState(false) // shade + sound button
  const [videoVisible, setVideoVisible] = useState(false)  // the video itself
  const lastState = useRef(null)
  const [muted, setMuted] = useState(true)
  const previewRef = useRef(null)
  const showTimer = useRef(null)

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
  const playPreview = Boolean(preview && trailer && !reducedMotion() && !saveData())

  // Start hidden (muted) for each title; fade in once YouTube has had time to start
  useEffect(() => {
    setPreviewShown(false)
    setVideoVisible(false)
    setMuted(true)
    lastState.current = null
    return () => clearTimeout(showTimer.current)
  }, [item.id, trailer?.key, playPreview])

  // YouTube reports its player state once we say we're listening;
  // the preview fades in the moment it starts playing (state 1)
  useEffect(() => {
    if (!playPreview) return
    function onMessage(event) {
      if (!/youtube(-nocookie)?\.com$/.test(new URL(event.origin).hostname)) return
      let msg
      try { msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data } catch { return }
      const state = msg?.event === 'onStateChange' ? msg.info : msg?.info?.playerState
      if (typeof state !== 'number' || state === lastState.current) return
      lastState.current = state
      // Show the instant it starts playing, and keep it on screen from then on
      if (state === 1) {
        clearTimeout(showTimer.current)
        setPreviewShown(true)
        setVideoVisible(true)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [playPreview, trailer?.key])

  function onPreviewLoad() {
    previewRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*')
    clearTimeout(showTimer.current)
    showTimer.current = setTimeout(() => { setPreviewShown(true); setVideoVisible(true) }, PREVIEW_FALLBACK)
  }

  function toggleSound() {
    const command = func => previewRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args: [] }), '*',
    )
    command(muted ? 'unMute' : 'mute')
    setMuted(m => !m)
  }

  const extra = type === 'movie'
    ? formatRuntime(data.runtime)
    : data.number_of_seasons
      ? `${data.number_of_seasons} Season${data.number_of_seasons > 1 ? 's' : ''}`
      : null


  return (
    <section className={styles.wrap}>
      <svg className={styles.glassDefs} aria-hidden="true" focusable="false">
        <filter id="dw-liquid-glass" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="2" seed="7" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="2" result="soft" />
          <feDisplacementMap in="SourceGraphic" in2="soft" scale="14" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      {data.backdrop_path && (
        <img
          className={styles.backdrop}
          src={`https://image.tmdb.org/t/p/w1280${data.backdrop_path}`}
          alt=""
        />
      )}
      {playPreview && (
        <div className={`${styles.preview} ${videoVisible ? styles.previewOn : ''}`} aria-hidden="true">
          <iframe
            key={trailer.key}
            ref={previewRef}
            src={previewSrc(trailer.key)}
            title={`${title} trailer preview`}
            allow="autoplay; encrypted-media"
            tabIndex={-1}
            onLoad={onPreviewLoad}
          />
        </div>
      )}
      <div className={`${styles.shade} ${previewShown ? styles.shadeLight : ''}`} />

      {previewShown && (
        <button
          className={`${styles.sound} ${styles.glass}`}
          onClick={toggleSound}
          aria-label={muted ? 'Turn trailer sound on' : 'Mute trailer'}
          title={muted ? 'Sound on' : 'Mute'}
        >
          {muted ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="m22 9-6 6M16 9l6 6" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></svg>
          )}
        </button>
      )}

      {onClose && (
        <button className={`${styles.close} ${styles.glass}`} onClick={onClose} aria-label="Close details">✕</button>
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
            <span className={`${styles.pill} ${styles.typePill} ${styles.glass}`}>{type === 'movie' ? 'MOVIE' : 'TV SERIES'}</span>
            {year && <span className={`${styles.pill} ${styles.glass}`}>{year}</span>}
            {rating && <span className={`${styles.pill} ${styles.ratingPill} ${styles.glass}`}>★ {rating}</span>}
            {extra && <span className={`${styles.pill} ${styles.glass}`}>{extra}</span>}
          </div>

          <h2 className={styles.title}>{title}</h2>
          {data.tagline && <p className={styles.tagline}>“{data.tagline}”</p>}

          {genres.length > 0 && (
            <div className={styles.genres}>
              {genres.map(g => <span key={g.id} className={`${styles.genre} ${styles.glass}`}>{g.name}</span>)}
            </div>
          )}

          {data.overview && <p className={styles.overview}>{data.overview}</p>}

          <div className={styles.actions}>
            <button
              className={styles.primary}
              onClick={() => onWatch()}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
              {type === 'movie' ? 'Watch Movie' : 'Watch Now'}
            </button>
            <button
              className={`${styles.secondary} ${styles.glass}`}
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
