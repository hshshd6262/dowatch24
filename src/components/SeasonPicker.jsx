import React, { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api.js'
import styles from './SeasonPicker.module.css'

export default function SeasonPicker({ show, onPlay, current }) {
  const [seasons, setSeasons] = useState([])
  const [activeSeason, setActiveSeason] = useState(current?.season || 1)
  const [episodes, setEpisodes] = useState([])
  const [epLoading, setEpLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  // Season list (specials / season 0 left out)
  useEffect(() => {
    api.tvDetails(show.id).then(details => {
      let s = (details.seasons || []).filter(s => s.season_number > 0)
      if (s.length === 0) {
        s = Array.from({ length: details.number_of_seasons || 1 }, (_, i) => ({ season_number: i + 1 }))
      }
      setSeasons(s)
      setActiveSeason(prev => s.some(x => x.season_number === prev) ? prev : s[0].season_number)
    }).catch(() => setSeasons([{ season_number: 1 }]))
  }, [show.id])

  // Follow the playing episode's season
  useEffect(() => {
    if (current?.season) setActiveSeason(current.season)
  }, [current?.season])

  useEffect(() => {
    setEpLoading(true)
    setEpisodes([])
    api.seasonDetails(show.id, activeSeason)
      .then(data => setEpisodes(data.episodes || []))
      .catch(() => setEpisodes([]))
      .finally(() => setEpLoading(false))
  }, [show.id, activeSeason])

  // Close the dropdown on outside click / Escape
  useEffect(() => {
    if (!menuOpen) return
    const onDown = e => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false) }
    const onKey = e => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  function pickSeason(n) {
    setActiveSeason(n)
    setMenuOpen(false)
  }

  const isPlaying = ep => current?.season === activeSeason && current?.episode === ep.episode_number

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.dropdown} ref={menuRef}>
          <button
            className={`${styles.dropBtn} ${menuOpen ? styles.dropBtnOpen : ''}`}
            onClick={() => setMenuOpen(o => !o)}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            disabled={seasons.length === 0}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>
            Season {activeSeason}
            <svg className={styles.chevron} viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
          </button>

          {menuOpen && (
            <ul className={styles.menu} role="listbox">
              {seasons.map(s => (
                <li key={s.season_number}>
                  <button
                    role="option"
                    aria-selected={s.season_number === activeSeason}
                    className={`${styles.option} ${s.season_number === activeSeason ? styles.optionActive : ''}`}
                    onClick={() => pickSeason(s.season_number)}
                  >
                    <span>Season {s.season_number}</span>
                    {s.episode_count > 0 && <span className={styles.optionCount}>{s.episode_count} eps</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!epLoading && episodes.length > 0 && (
          <span className={styles.count}>{episodes.length} Episodes</span>
        )}
      </div>

      {epLoading ? (
        <div className={styles.grid}>
          {Array.from({ length: 10 }).map((_, i) => <div key={i} className={styles.skeleton} />)}
        </div>
      ) : episodes.length > 0 ? (
        <div className={styles.grid}>
          {episodes.map(ep => (
            <button
              key={ep.episode_number}
              className={`${styles.ep} ${isPlaying(ep) ? styles.epActive : ''}`}
              onClick={() => onPlay(activeSeason, ep.episode_number)}
              title={`Episode ${ep.episode_number}: ${ep.name}`}
            >
              <span className={styles.play}>
                {isPlaying(ep)
                  ? <span className={styles.bars}><i /><i /><i /></span>
                  : <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
                }
              </span>
              <span className={styles.epText}>
                <b>Ep {ep.episode_number}:</b> {ep.name}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className={styles.empty}>No episode data available.</p>
      )}
    </div>
  )
}
