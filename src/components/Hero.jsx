import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import styles from './Hero.module.css'

const AUTOPLAY_MS = 7000
const BACKDROP = 'https://image.tmdb.org/t/p/'

// Trending slider: swipe with a finger (follows it), glides between slides,
// loops forever and auto-advances every 7 s (paused while touched).
export default function Hero({ onPlay }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadTrending() {
      try {
        const [movies, tv] = await Promise.all([api.trendingMovies(), api.trendingTV()])
        const combined = [
          ...(movies.results || []).map(item => ({ ...item, mediaType: 'movie' })),
          ...(tv.results || []).map(item => ({ ...item, mediaType: 'tv' })),
        ]
        const valid = combined.filter(item => item.backdrop_path)
        setItems([...valid].sort(() => Math.random() - 0.5).slice(0, 10))
      } catch (error) {
        console.error('Failed to load trending content:', error)
      } finally {
        setLoading(false)
      }
    }
    loadTrending()
  }, [])

  if (loading || !items.length) return null
  return <Slider items={items} onPlay={onPlay} />
}

function Slider({ items, onPlay }) {
  const n = items.length
  const loop = n > 1
  // A copy of the last slide sits before the first, and of the first after the last,
  // so the slider can glide past the ends and then silently jump back.
  const slides = loop ? [items[n - 1], ...items, items[0]] : items
  const first = loop ? 1 : 0

  const [pos, setPos] = useState(first)
  const [animate, setAnimate] = useState(true)
  const [drag, setDrag] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [tick, setTick] = useState(0)
  const [loaded, setLoaded] = useState(() => new Set([first, first + 1, first - 1]))
  const heroRef = useRef(null)
  const gesture = useRef(null)
  const moved = useRef(false)

  const current = loop ? (pos - 1 + n) % n : pos

  // Load the picture of this slide and its neighbours (once loaded, keep it)
  useEffect(() => {
    setLoaded(prev => {
      if (prev.has(pos) && prev.has(pos + 1) && prev.has(pos - 1)) return prev
      const next = new Set(prev)
      next.add(pos).add(pos + 1).add(pos - 1)
      return next
    })
  }, [pos])

  const go = useCallback(step => {
    setAnimate(true)
    setPos(p => {
      if (!loop) return Math.max(0, Math.min(n - 1, p + step))
      // still finishing a jump around the ends: ignore
      if (p <= 0 || p >= n + 1) return p
      return p + step
    })
  }, [loop, n])

  // After gliding onto a copy, jump to the real slide without animation
  function onTransitionEnd(e) {
    if (e.target !== e.currentTarget || !loop) return
    if (pos === 0) { setAnimate(false); setPos(n) }
    else if (pos === n + 1) { setAnimate(false); setPos(1) }
  }

  useEffect(() => {
    if (animate) return
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)))
    return () => cancelAnimationFrame(id)
  }, [animate])

  // Auto-advance (restarts after every change, waits while touched or tab hidden)
  useEffect(() => {
    if (!loop || dragging) return
    const timer = setTimeout(() => {
      if (document.visibilityState === 'visible') go(1)
      else setTick(t => t + 1) // tab hidden: try again later
    }, AUTOPLAY_MS)
    return () => clearTimeout(timer)
  }, [pos, tick, dragging, loop, go])

  // ----- Swipe -----
  function onPointerDown(e) {
    if (!loop || (e.pointerType === 'mouse' && e.button !== 0)) return
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), axis: null }
    moved.current = false
  }

  function onPointerMove(e) {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (!g.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (g.axis === 'y') { gesture.current = null; return } // let the page scroll
      e.currentTarget.setPointerCapture?.(e.pointerId)
      setDragging(true)
      // finishing a jump around the ends: settle on the real slide first
      if (pos <= 0 || pos >= n + 1) { setAnimate(false); setPos(pos <= 0 ? n : 1) }
    }
    moved.current = true
    setDrag(dx)
  }

  function onPointerUp(e) {
    const g = gesture.current
    gesture.current = null
    if (!g || g.axis !== 'x') return
    const width = heroRef.current?.offsetWidth || 1
    const dx = e.clientX - g.x
    const speed = Math.abs(dx) / Math.max(1, performance.now() - g.t) // px per ms
    setDragging(false)
    setDrag(0)
    if (Math.abs(dx) > width * 0.18 || (speed > 0.35 && Math.abs(dx) > 20)) go(dx < 0 ? 1 : -1)
    else setAnimate(true)
  }

  function onClickCapture(e) {
    // a swipe that ends on the button shouldn't press it
    if (moved.current) { e.stopPropagation(); e.preventDefault(); moved.current = false }
  }

  function goTo(index) {
    setAnimate(true)
    setPos(index + first)
  }

  const transform = `translate3d(calc(${-pos * 100}% + ${drag}px), 0, 0)`

  return (
    <section
      ref={heroRef}
      className={styles.hero}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
      aria-roledescription="carousel"
    >
      <div
        className={`${styles.track} ${animate && !dragging ? styles.trackAnimate : ''}`}
        style={{ transform }}
        onTransitionEnd={onTransitionEnd}
      >
        {slides.map((item, index) => (
          <Slide
            key={`${index}-${item.id}`}
            item={item}
            active={index === pos}
            showImage={loaded.has(index)}
            onPlay={onPlay}
          />
        ))}
      </div>

      {loop && (
        <div className={styles.dots}>
          {items.map((_, index) => (
            <button
              key={index}
              className={index === current ? styles.dotActive : ''}
              onClick={() => goTo(index)}
              aria-label={`Show trending item ${index + 1}`}
            >
              {index === current && (
                <span key={pos} className={`${styles.dotFill} ${dragging ? styles.dotPaused : ''}`} />
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function Slide({ item, active, showImage, onPlay }) {
  const title = item.title || item.name
  const date = item.release_date || item.first_air_date
  const year = date ? date.slice(0, 4) : ''
  const rating = item.vote_average ? item.vote_average.toFixed(1) : null
  const path = item.backdrop_path

  return (
    <div className={`${styles.slide} ${active ? styles.slideActive : ''}`} aria-hidden={!active}>
      {showImage && (
        <img
          className={styles.backdrop}
          src={`${BACKDROP}w1280${path}`}
          srcSet={`${BACKDROP}w780${path} 780w, ${BACKDROP}w1280${path} 1280w, ${BACKDROP}original${path} 1920w`}
          sizes="(max-width: 1200px) 100vw, 1200px"
          alt=""
          draggable="false"
          decoding="async"
        />
      )}

      <div className={styles.overlay} />

      <div className={styles.content}>
        <div className={styles.badge}>TRENDING NOW</div>
        <h1>{title}</h1>
        <div className={styles.meta}>
          <span className={styles.type}>{item.mediaType === 'movie' ? 'Movie' : 'TV Series'}</span>
          {year && <span>{year}</span>}
          {rating && <span className={styles.rating}>★ {rating}</span>}
        </div>
        <p>{item.overview || 'Discover what everyone is watching right now.'}</p>
        <button className={styles.watchButton} onClick={() => onPlay?.(item)} tabIndex={active ? 0 : -1}>
          ▶ Watch Now
        </button>
      </div>
    </div>
  )
}
