import React, { useEffect, useState } from 'react'
import { posterUrl, formatRating, getYear } from '../lib/api.js'
import { toggleSaved, useMyList } from '../lib/myList.js'
import styles from './MyListDrawer.module.css'

const BookmarkIcon = ({ size = 18, filled = false }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.5L5 21V4.5a1 1 0 0 1 1-1z" />
  </svg>
)

// Header button with a live count; opens the My List panel
export function MyListButton({ className, onClick }) {
  const count = useMyList().length
  const [bump, setBump] = useState(false)

  // Little bounce whenever something is saved or removed
  useEffect(() => {
    setBump(true)
    const t = setTimeout(() => setBump(false), 450)
    return () => clearTimeout(t)
  }, [count])

  return (
    <button
      className={`${className} ${styles.headerBtn} ${bump ? styles.bump : ''}`}
      onClick={onClick}
      aria-label={`My List${count ? `, ${count} saved` : ''}`}
      title="My List"
    >
      <BookmarkIcon filled={count > 0} />
      {count > 0 && <span className={styles.badge}>{count > 99 ? '99+' : count}</span>}
    </button>
  )
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'movie', label: 'Movies' },
  { id: 'tv', label: 'TV Shows' },
]

// Slide-in panel listing everything saved
export default function MyListDrawer({ open, onClose, onOpenTitle }) {
  const list = useMyList()
  const [filter, setFilter] = useState('all')
  const [leaving, setLeaving] = useState(null)

  useEffect(() => {
    if (!open) return
    const onKey = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  const shown = filter === 'all' ? list : list.filter(x => x.media_type === filter)
  const count = id => (id === 'all' ? list.length : list.filter(x => x.media_type === id).length)

  // Slide the row out, then remove it
  function remove(item) {
    const key = `${item.media_type}-${item.id}`
    setLeaving(key)
    setTimeout(() => { toggleSaved(item); setLeaving(null) }, 220)
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <aside className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="mylist-title" onClick={e => e.stopPropagation()}>
        <div className={styles.glow} />

        <header className={styles.head}>
          <div className={styles.headIcon}><BookmarkIcon size={20} filled /></div>
          <div>
            <h2 id="mylist-title" className={styles.title}>My List</h2>
            <p className={styles.sub}>{list.length ? `${list.length} saved to watch later` : 'Your watch-later shelf'}</p>
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Close My List">✕</button>
        </header>

        {list.length > 0 && (
          <div className={styles.filters}>
            {FILTERS.map(f => (
              <button
                key={f.id}
                className={`${styles.chip} ${filter === f.id ? styles.chipOn : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label} <span>{count(f.id)}</span>
              </button>
            ))}
          </div>
        )}

        <div className={styles.body}>
          {list.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}><BookmarkIcon size={34} /></div>
              <h3>Nothing saved yet</h3>
              <p>Tap the <BookmarkIcon size={14} /> on any movie or show while watching, and it'll wait for you here.</p>
              <button className={styles.browse} onClick={onClose}>Browse trending</button>
            </div>
          ) : shown.length === 0 ? (
            <p className={styles.none}>No {filter === 'movie' ? 'movies' : 'TV shows'} saved yet.</p>
          ) : (
            <ul className={styles.list}>
              {shown.map((item, i) => {
                const key = `${item.media_type}-${item.id}`
                const title = item.title || item.name
                const poster = posterUrl(item.poster_path)
                const rating = formatRating(item.vote_average)
                return (
                  <li
                    key={key}
                    className={`${styles.row} ${leaving === key ? styles.leaving : ''}`}
                    style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}
                  >
                    <button className={styles.open} onClick={() => { onOpenTitle(item); onClose() }}>
                      <span className={styles.poster}>
                        {poster ? <img src={poster} alt="" loading="lazy" /> : <span>{title?.slice(0, 1)}</span>}
                        <span className={styles.play}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
                        </span>
                      </span>
                      <span className={styles.info}>
                        <span className={styles.name}>{title}</span>
                        <span className={styles.meta}>
                          <span className={styles.type}>{item.media_type === 'movie' ? 'Movie' : 'TV'}</span>
                          {getYear(item.release_date || item.first_air_date)}
                          {rating && <span className={styles.rating}>★ {rating}</span>}
                        </span>
                      </span>
                    </button>
                    <button className={styles.remove} onClick={() => remove(item)} aria-label={`Remove ${title} from My List`} title="Remove">
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <footer className={styles.foot}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
          Saved on this device only
        </footer>
      </aside>
    </div>
  )
}
