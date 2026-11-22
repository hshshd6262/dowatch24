import React, { useLayoutEffect, useRef, useState } from 'react'
import { useMyList } from '../lib/myList.js'
import DiscordIcon, { DISCORD_URL } from './DiscordIcon.jsx'
import styles from './MobileNav.module.css'

const ICONS = {
  movies: <path d="M4 5h16v14H4zM8 5v14M16 5v14M4 9.5h4M4 14.5h4M16 9.5h4M16 14.5h4" />,
  tv: <><path d="M3 6.5h18v11H3z" /><path d="M8 21h8M12 17.5V21M8.5 2.5 12 6l3.5-3.5" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  list: <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.5L5 21V4.5a1 1 0 0 1 1-1z" />,
}

const ITEMS = [
  { id: 'movies', label: 'Movies' },
  { id: 'tv', label: 'TV' },
  { id: 'search', label: 'Search' },
  { id: 'list', label: 'Bookmarks' },
]

// Floating Liquid Glass tab bar for phones. The glass bubble behind the active
// tab stretches like liquid toward the next one, then settles with a wobble.
export default function MobileNav({ active, onSelect }) {
  const count = useMyList().length
  const barRef = useRef(null)
  const itemRefs = useRef({})
  const [blob, setBlob] = useState(null)       // { x, w }
  const [phase, setPhase] = useState('rest')   // rest | stretch | settle
  const timers = useRef([])

  // Move the bubble: stretch across both tabs first, then shrink onto the new one
  useLayoutEffect(() => {
    const bar = barRef.current
    const el = itemRefs.current[active]
    if (!bar || !el) return
    const b = bar.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    const target = { x: r.left - b.left, w: r.width }

    timers.current.forEach(clearTimeout)
    if (!blob) { setBlob(target); return }
    if (blob.x === target.x) return

    const left = Math.min(blob.x, target.x)
    const right = Math.max(blob.x + blob.w, target.x + target.w)
    setPhase('stretch')
    setBlob({ x: left, w: right - left })
    timers.current = [
      setTimeout(() => { setPhase('settle'); setBlob(target) }, 170),
      setTimeout(() => setPhase('rest'), 620),
    ]
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the bubble in place if the screen rotates / resizes
  useLayoutEffect(() => {
    const onResize = () => {
      const bar = barRef.current, el = itemRefs.current[active]
      if (!bar || !el) return
      const b = bar.getBoundingClientRect(), r = el.getBoundingClientRect()
      setBlob({ x: r.left - b.left, w: r.width })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [active])

  function tap(id) {
    navigator.vibrate?.(8)
    onSelect(id)
  }

  return (
    <nav className={styles.wrap} aria-label="Main">
      <svg className={styles.defs} aria-hidden="true" focusable="false">
        <filter id="dw-nav-glass" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="3" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="2" result="soft" />
          <feDisplacementMap in="SourceGraphic" in2="soft" scale="18" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      <div className={styles.bar} ref={barRef}>
        {blob && (
          <span
            className={`${styles.blob} ${styles[phase]}`}
            style={{ transform: `translateX(${blob.x}px)`, width: blob.w }}
            aria-hidden="true"
          />
        )}

        {ITEMS.map(item => (
          <button
            key={item.id}
            ref={el => { itemRefs.current[item.id] = el }}
            className={`${styles.item} ${active === item.id ? styles.on : ''}`}
            onClick={() => tap(item.id)}
            aria-label={item.label}
            aria-current={active === item.id ? 'page' : undefined}
          >
            <span className={styles.icon}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill={item.id === 'list' && count ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                {ICONS[item.id]}
              </svg>
              {item.id === 'list' && count > 0 && <span className={styles.badge}>{count > 99 ? '99+' : count}</span>}
            </span>
            <span className={styles.label}>{item.label}</span>
          </button>
        ))}

        <a
          className={styles.item}
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Join our Discord"
          onClick={() => navigator.vibrate?.(8)}
        >
          <span className={styles.icon}><DiscordIcon size={22} /></span>
          <span className={styles.label}>Discord</span>
        </a>
      </div>
    </nav>
  )
}
