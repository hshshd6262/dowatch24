import React, { useEffect, useState } from 'react'
import { api, posterUrl } from '../lib/api'
import styles from './Hero.module.css'

export default function Hero() {
  const [items, setItems] = useState([])
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadTrending() {
      try {
        const [movies, tv] = await Promise.all([
          api.trendingMovies(),
          api.trendingTV(),
        ])

        const combined = [
          ...(movies.results || []).map(item => ({
            ...item,
            mediaType: 'movie',
          })),
          ...(tv.results || []).map(item => ({
            ...item,
            mediaType: 'tv',
          })),
        ]

        const valid = combined.filter(item => item.backdrop_path)

        // Shuffle the trending results
        const shuffled = [...valid].sort(() => Math.random() - 0.5)

        setItems(shuffled.slice(0, 10))
      } catch (error) {
        console.error('Failed to load trending content:', error)
      } finally {
        setLoading(false)
      }
    }

    loadTrending()
  }, [])

  useEffect(() => {
    if (items.length <= 1) return

    const timer = setInterval(() => {
      setCurrent(prev => (prev + 1) % items.length)
    }, 7000)

    return () => clearInterval(timer)
  }, [items])

  if (loading || !items.length) return null

  const item = items[current]

  const title = item.title || item.name
  const date = item.release_date || item.first_air_date
  const year = date ? date.slice(0, 4) : ''
  const rating = item.vote_average
    ? item.vote_average.toFixed(1)
    : null

  return (
    <section className={styles.hero}>
      <img
        className={styles.backdrop}
        src={`https://image.tmdb.org/t/p/original${item.backdrop_path}`}
        alt=""
      />

      <div className={styles.overlay} />

      <div className={styles.content}>
        <div className={styles.badge}>
          TRENDING NOW
        </div>

        <h1>{title}</h1>

        <div className={styles.meta}>
          <span className={styles.type}>
            {item.mediaType === 'movie' ? 'Movie' : 'TV Series'}
          </span>

          {year && <span>{year}</span>}

          {rating && (
            <span className={styles.rating}>
              ★ {rating}
            </span>
          )}
        </div>

        <p>
          {item.overview || 'Discover what everyone is watching right now.'}
        </p>

        <button className={styles.watchButton}>
          ▶ Watch Now
        </button>
      </div>

      <div className={styles.dots}>
        {items.map((_, index) => (
          <button
            key={index}
            className={index === current ? styles.dotActive : ''}
            onClick={() => setCurrent(index)}
            aria-label={`Show trending item ${index + 1}`}
          />
        ))}
      </div>
    </section>
  )
}