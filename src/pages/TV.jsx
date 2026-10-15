import React, { useState, useEffect, useRef } from 'react'
import { api, tvEmbedUrl, formatRating, getYear } from '../lib/api.js'
import MediaGrid from '../components/MediaGrid.jsx'
import Player from '../components/Player.jsx'
import Details from '../components/Details.jsx'
import SeasonPicker from '../components/SeasonPicker.jsx'
import { requestSharePopup } from '../lib/share.js'
import styles from './TV.module.css'

function persist(key, val) { try { sessionStorage.setItem(key, JSON.stringify(val)) } catch {} }
function hydrate(key) { try { const v = sessionStorage.getItem(key); return v ? JSON.parse(v) : null } catch { return null } }

export default function TV({ showSearch, playRequest, onOpen }) {
  const [query, setQuery] = useState(() => hydrate('search_query') || '')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(() => hydrate('tv_selected'))
  const [player, setPlayer] = useState(null)
  const playerAnchorRef = useRef(null)
  const detailsRef = useRef(null)
  const didRestore = useRef(false)
  const searchRef = useRef(null)

  useEffect(() => {
    if (!showSearch) return
    searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    searchRef.current?.querySelector('input')?.focus({ preventScroll: true })
  }, [showSearch])

  // Hero "Watch Now" on a TV show opens its season/episode picker
  useEffect(() => {
    if (playRequest?.item.mediaType === 'tv') {
      didRestore.current = true
      selectShow(playRequest.item)
    }
  }, [playRequest])

  // Load trending or restore last search
  useEffect(() => {
    const savedQuery = hydrate('search_query') || ''
    if (savedQuery) {
      api.searchAll(savedQuery)
        .then(d => setResults(d.results || []))
        .finally(() => setLoading(false))
    } else {
      api.trendingTV()
        .then(d => setResults(d.results || []))
        .finally(() => setLoading(false))
    }
  }, [])

  // If user had a show selected + episode playing on last visit, restore it
  useEffect(() => {
    if (didRestore.current) return
    const savedPlayer = hydrate('tv_player')
    if (savedPlayer) {
      setPlayer(savedPlayer)
      didRestore.current = true
    }
  }, [])

  async function search(e) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    // Close whatever is open so the results sit right under the search bar
    closeDetails()
    document.activeElement?.blur()
    searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setLoading(true)
    setResults([])
    persist('search_query', q)
    const d = await api.searchAll(q)
    setResults(d.results || [])
    setLoading(false)
  }

  function selectShow(item) {
    if (item.media_type && item.media_type !== 'tv') return onOpen(item)
    requestSharePopup()
    setSelected(item)
    persist('tv_selected', item)
    setPlayer(null)
    persist('tv_player', null)
    setTimeout(() => {
      detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  function closeDetails() {
    setSelected(null)
    setPlayer(null)
    persist('tv_selected', null)
    persist('tv_player', null)
  }

  function playTrailer(src) {
    const p = { src, title: `${selected.name} — Trailer`, badge: 'Trailer', selectedId: selected.id }
    setPlayer(p)
    persist('tv_player', p)
    setTimeout(() => {
      playerAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  function handlePlay(season, episode) {
    if (!selected) return
    const p = {
      src: tvEmbedUrl(selected.id, season, episode),
      title: selected.name,
      year: getYear(selected.first_air_date),
      rating: formatRating(selected.vote_average),
      badge: `S${season} · E${episode}`,
      season,
      episode,
      selectedId: selected.id,
    }
    setPlayer(p)
    persist('tv_player', p)
    setTimeout(() => {
      playerAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  return (
    <div>
      {showSearch && (
        <form ref={searchRef} className={`${styles.searchRow} ${styles.anchor}`} onSubmit={search}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search movies & TV shows…"
            className={styles.input}
          />
          <button type="submit" className={styles.btn}>Search</button>
        </form>
      )}

      {selected && (
        <div ref={detailsRef} className={styles.anchor}>
          <Details
            item={selected}
            type="tv"
            onWatch={handlePlay}
            onTrailer={playTrailer}
            onClose={closeDetails}
          />
        </div>
      )}

      {player && (
        <div ref={playerAnchorRef} className={styles.anchor}>
          <Player {...player} onClose={() => { setPlayer(null); persist('tv_player', null) }} />
        </div>
      )}

      {/* Episode list only shows once an episode is playing (not for trailers) */}
      {selected && player?.season && player.selectedId === selected.id && (
        <SeasonPicker
          key={selected.id}
          show={selected}
          onPlay={handlePlay}
          current={player}
        />
      )}

      <p className={styles.sectionLabel}>{hydrate('search_query') ? 'Results' : 'Trending Now'}</p>
      <MediaGrid
        items={results}
        type="tv"
        loading={loading}
        onSelect={selectShow}
        selectedId={selected?.id}
      />
    </div>
  )
}
