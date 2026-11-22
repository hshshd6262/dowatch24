import React, { useEffect, useRef, useState } from 'react'
import { toggleSaved, useMyList } from '../lib/myList.js'
import styles from './BookmarkButton.module.css'

// The "save for later" tip shows by itself the first few times only
const TIP_KEY = 'dw_bookmark_tip_seen'
const TIP_TIMES = 3

function tipSeenCount() {
  try { return Number(localStorage.getItem(TIP_KEY) || 0) } catch { return TIP_TIMES }
}

const Icon = ({ filled }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.5L5 21V4.5a1 1 0 0 1 1-1z" />
  </svg>
)

export default function BookmarkButton({ item, className = '' }) {
  const list = useMyList()
  const saved = list.some(x => x.id === item.id && x.media_type === item.media_type)
  const [tip, setTip] = useState(null) // null | 'hint' | 'saved' | 'removed'
  const timer = useRef(null)

  function flash(kind, ms) {
    setTip(kind)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setTip(null), ms)
  }

  // Show the hint by itself a few times, for titles that aren't saved yet
  useEffect(() => {
    if (saved || tipSeenCount() >= TIP_TIMES) return
    const start = setTimeout(() => {
      try { localStorage.setItem(TIP_KEY, String(tipSeenCount() + 1)) } catch {}
      flash('hint', 5000)
    }, 900)
    return () => { clearTimeout(start); clearTimeout(timer.current) }
  }, [item.id, item.media_type])

  function onClick() {
    const nowSaved = toggleSaved(item)
    flash(nowSaved ? 'saved' : 'removed', 2200)
    // A good moment to offer notifications for new episodes
    if (nowSaved) setTimeout(() => window.dispatchEvent(new Event('dw:ask-notify')), 1400)
  }

  const label = saved ? 'Remove from Bookmarks' : 'Save to Bookmarks'

  return (
    <div className={`${styles.wrap} ${className}`}>
      <button
        className={`${styles.btn} ${saved ? styles.on : ''}`}
        onClick={onClick}
        onMouseEnter={() => !tip && setTip('hover')}
        onMouseLeave={() => tip === 'hover' && setTip(null)}
        aria-label={label}
        aria-pressed={saved}
      >
        <Icon filled={saved} />
      </button>

      {tip && (
        <div className={`${styles.tip} ${tip === 'saved' ? styles.tipSaved : ''}`} role="status">
          {tip === 'saved' && <><b>Saved ✓</b><span>Find it in Bookmarks (🔖)</span></>}
          {tip === 'removed' && <b>Removed from Bookmarks</b>}
          {(tip === 'hint' || tip === 'hover') && (saved
            ? <b>In your list · tap to remove</b>
            : <><b>Save this for later</b><span>Watch it anytime from Bookmarks</span></>)}
        </div>
      )}
    </div>
  )
}
