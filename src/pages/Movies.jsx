import React, { useState, useEffect, useRef } from 'react'
import { api, movieEmbedUrl, formatRating, getYear } from '../lib/api.js'
import MediaGrid from '../components/MediaGrid.jsx'
import Player from '../components/Player.jsx'
import Details from '../components/Details.jsx'
import { requestSharePopup } from '../lib/share.js'
import styles from './Movies.module.css'

function persist(key, val) {
  try { sessionStorage.setItem(key, JSON.stringify(val)) } catch {}
}
function hydrate(key) {
  try { const v = sessionStorage.getItem(key); return v ? JSON.parse(v) : null } catch { return null }
}

export default function Movies({ showSearch, playRequest, onOpen }) {
  const savedQuery = hydrate('search_query') || ''
  const savedPlayer = hydrate('mv_player')

  const [query, setQuery] = useState(savedQuery)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [label, setLabel] = useState(savedQuery ? 'Results' : 'Trending Now')
  const [player, setPlayer] = useState(savedPlayer)
  const [details, setDetails] = useState(() => hydrate('mv_details'))
  const detailsRef = useRef(null)
  const playerAnchorRef = useRef(null)
  const searchRef = useRef(null)

  useEffect(() => {
    if (!showSearch) return
    searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    searchRef.current?.querySelector('input')?.focus({ preventScroll: true })
  }, [showSearch])

  useEffect(() => {
    if (playRequest?.item.mediaType === 'movie') select(playRequest.item, { autoplay: playRequest.autoplay })
  }, [playRequest])

  useEffect(() => {
    if (savedQuery) {
      api.searchAll(savedQuery)
        .then(d => setResults(d.results || []))
        .finally(() => setLoading(false))
    } else {
      api.trendingMovies()
        .then(d => setResults(d.results || []))
        .finally(() => setLoading(false))
    }
  }, [])

  async function search(e) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setLabel('Results')
    setResults([])
    persist('search_query', q)
    const d = await api.searchAll(q)
    setResults(d.results || [])
    setLoading(false)
  }

  function select(item, { autoplay = false } = {}) {
    if (item.media_type && item.media_type !== 'movie') return onOpen(item)
    requestSharePopup()
    setDetails(item)
    persist('mv_details', item)
    if (autoplay) play(item)
    else if (player?.selectedId !== item.id) closePlayer()
    setTimeout(() => {
      detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  function showPlayer(p) {
    setPlayer(p)
    persist('mv_player', p)
    setTimeout(() => {
      playerAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  function play(item) {
    showPlayer({
      src: movieEmbedUrl(item.id),
      title: item.title,
      year: getYear(item.release_date),
      rating: formatRating(item.vote_average),
      selectedId: item.id,
    })
  }

  function playTrailer(src) {
    showPlayer({ src, title: `${details.title} — Trailer`, badge: 'Trailer', selectedId: details.id })
  }

  function closePlayer() {
    setPlayer(null)
    persist('mv_player', null)
  }

  function closeDetails() {
    setDetails(null)
    persist('mv_details', null)
    closePlayer()
  }

  return (
    <div>
      {showSearch && (
        <form ref={searchRef} className={styles.searchRow} onSubmit={search}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search movies & TV shows…"
            className={styles.input}
          />
          <button type="submit" className={styles.btn}>Search</button>
        </form>
      )}

      {details && (
        <div ref={detailsRef} className={styles.anchor}>
          <Details
            item={details}
            type="movie"
            onWatch={() => play(details)}
            onTrailer={playTrailer}
            onClose={closeDetails}
          />
        </div>
      )}

      {player && (
        <div ref={playerAnchorRef} className={styles.anchor}>
          <Player {...player} onClose={closePlayer} />
        </div>
      )}

      <p className={styles.sectionLabel}>{label}</p>
      <MediaGrid
        items={results}
        type="movie"
        loading={loading}
        onSelect={select}
        selectedId={details?.id}
      />
    </div>
  )
}
