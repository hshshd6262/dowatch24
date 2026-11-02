import React, { useState, useEffect, useRef } from 'react'
import { api, tvEmbedUrl, formatRating, getYear } from '../lib/api.js'
import MediaGrid from '../components/MediaGrid.jsx'
import SearchBox from '../components/SearchBox.jsx'
import { smartSearch } from '../lib/search.js'
import Player from '../components/Player.jsx'
import Details from '../components/Details.jsx'
import YouMayAlsoLike from '../components/YouMayAlsoLike.jsx'
import ShareBar from '../components/ShareBar.jsx'
import SeasonPicker from '../components/SeasonPicker.jsx'
import { requestSharePopup } from '../lib/share.js'
import styles from './TV.module.css'

function persist(key, val) { try { sessionStorage.setItem(key, JSON.stringify(val)) } catch {} }
function hydrate(key) { try { const v = sessionStorage.getItem(key); return v ? JSON.parse(v) : null } catch { return null } }

export default function TV({ showSearch, playRequest, onOpen, onTitleOpen }) {
  const [query, setQuery] = useState(() => hydrate('search_query') || '')
  const [results, setResults] = useState([])
  const [related, setRelated] = useState([])
  const [searchInfo, setSearchInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(() => hydrate('tv_selected'))
  const [player, setPlayer] = useState(null)
  const playerAnchorRef = useRef(null)
  const detailsRef = useRef(null)
  const pickerRef = useRef(null)
  const [showPicker, setShowPicker] = useState(false)
  const didRestore = useRef(false)
  const searchRef = useRef(null)

  // The hero only shows while browsing, not with a title open
  useEffect(() => { onTitleOpen(Boolean(selected)) }, [selected])

  useEffect(() => {
    if (!showSearch) return
    searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    searchRef.current?.querySelector('input')?.focus({ preventScroll: true })
  }, [showSearch])

  // Hero "Watch Now" on a TV show opens its details and season/episode selection
  useEffect(() => {
    if (playRequest?.item.mediaType === 'tv') {
      didRestore.current = true
      selectShow(playRequest.item)
      if (playRequest.autoplay) showEpisodes()
    }
  }, [playRequest])

  // Load trending or restore last search
  useEffect(() => {
    const savedQuery = hydrate('search_query') || ''
    if (savedQuery) {
      runSearch(savedQuery)
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

  async function search(text) {
    const q = text.trim()
    if (!q) return
    // Close whatever is open so the results sit right under the search bar
    closeDetails()
    document.activeElement?.blur()
    searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setLoading(true)
    setResults([])
    persist('search_query', q)
    await runSearch(q)
  }

  async function runSearch(q) {
    setLoading(true)
    setResults([])
    setRelated([])
    try {
      const d = await smartSearch(q)
      setResults(d.results)
      setRelated(d.related)
      setSearchInfo({ query: q, person: d.personName })
    } catch {
      setResults([])
      setSearchInfo({ query: q, person: null })
    } finally {
      setLoading(false)
    }
  }

  function selectShow(item) {
    if (item.media_type && item.media_type !== 'tv') return onOpen(item)
    requestSharePopup()
    setSelected(item)
    persist('tv_selected', item)
    setShowPicker(false)
    setPlayer(null)
    persist('tv_player', null)
    setTimeout(() => {
      detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  // Watch Now: show the season/episode selection; the video starts when one is picked
  function showEpisodes() {
    setShowPicker(true)
    setTimeout(() => {
      pickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  function closeDetails() {
    setSelected(null)
    setShowPicker(false)
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
    setShowPicker(true)
    const p = {
      src: tvEmbedUrl(selected.id, season, episode),
      embed: { type: 'tv', id: selected.id, season, episode },
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
        <SearchBox
          ref={searchRef}
          className={styles.anchor}
          value={query}
          onChange={setQuery}
          onSearch={search}
          onPick={onOpen}
        />
      )}

      {selected && (
        <div ref={detailsRef} className={styles.anchor}>
          <Details
            item={selected}
            type="tv"
            onWatch={showEpisodes}
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

      {/* Episode selection appears after Watch Now, or when an episode was restored */}
      {selected && (showPicker || player?.season) && (
        <div ref={pickerRef} className={styles.anchor}>
          {/* The player has its own share bar once an episode is playing */}
          {!player?.embed && (
            <div className={styles.shareGap}>
              <ShareBar title={selected.name} shareKey={`tv-${selected.id}`} />
            </div>
          )}
          <SeasonPicker
            key={selected.id}
            show={selected}
            onPlay={handlePlay}
            current={player}
          />
        </div>
      )}

      {selected && <YouMayAlsoLike item={selected} type="tv" onSelect={selectShow} />}

      {/* Trending gives way to "You may also like"; search results stay */}
      {(!selected || searchInfo) && (
        <>
          <p className={styles.sectionLabel}>
            {searchInfo
              ? searchInfo.person
                ? `Movies & shows with ${searchInfo.person}`
                : `Results for “${searchInfo.query}”`
              : hydrate('search_query') ? 'Results' : 'Trending Now'}
          </p>
          <MediaGrid
            items={results}
            type="tv"
            loading={loading}
            onSelect={selectShow}
            selectedId={selected?.id}
          />
        </>
      )}

      {!loading && related.length > 0 && (
        <>
          <p className={`${styles.sectionLabel} ${styles.relatedLabel}`}>Related to “{searchInfo?.query}”</p>
          <MediaGrid
            items={related}
            type="tv"
            onSelect={selectShow}
            selectedId={selected?.id}
          />
        </>
      )}
    </div>
  )
}
