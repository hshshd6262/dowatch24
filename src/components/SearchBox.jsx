import React, { forwardRef, useEffect, useRef, useState } from 'react'
import { suggest } from '../lib/search.js'
import { getYear } from '../lib/api.js'
import styles from './SearchBox.module.css'

// Bold the part of the title that matches what was typed, like Google
function Highlight({ text, query }) {
  const i = text.toLowerCase().indexOf(query.trim().toLowerCase())
  if (!query.trim() || i < 0) return text
  const end = i + query.trim().length
  return <>{text.slice(0, i)}<mark>{text.slice(i, end)}</mark>{text.slice(end)}</>
}

const SearchBox = forwardRef(function SearchBox({ value, onChange, onSearch, onPick, className }, ref) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState({ titles: [], people: [] })
  const [active, setActive] = useState(-1)
  const reqId = useRef(0)
  const boxRef = useRef(null)

  const items = [
    ...data.titles.map(t => ({ kind: 'title', item: t })),
    ...data.people.map(p => ({ kind: 'person', item: p })),
  ]

  // Debounced live suggestions
  useEffect(() => {
    const q = value.trim()
    if (q.length < 2) {
      setData({ titles: [], people: [] })
      setLoading(false)
      return
    }
    setLoading(true)
    const id = ++reqId.current
    const t = setTimeout(() => {
      suggest(q)
        .then(d => { if (id === reqId.current) { setData(d); setActive(-1) } })
        .catch(() => {})
        .finally(() => { if (id === reqId.current) setLoading(false) })
    }, 220)
    return () => clearTimeout(t)
  }, [value])

  useEffect(() => {
    if (!open) return
    const onDown = e => { if (!boxRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function runSearch(q) {
    setOpen(false)
    if (q.trim()) onSearch(q.trim())
  }

  function choose(entry) {
    setOpen(false)
    if (entry.kind === 'person') {
      onChange(entry.item.name)
      onSearch(entry.item.name)
    } else {
      document.activeElement?.blur()
      onPick(entry.item)
    }
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive(a => Math.min(a + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(a => Math.max(a - 1, -1))
    } else if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'Enter' && open && active >= 0 && items[active]) {
      e.preventDefault()
      choose(items[active])
    }
  }

  const q = value.trim()
  const showPanel = open && q.length >= 2

  return (
    <form
      ref={el => { boxRef.current = el; if (typeof ref === 'function') ref(el); else if (ref) ref.current = el }}
      className={`${styles.form} ${className || ''}`}
      onSubmit={e => { e.preventDefault(); runSearch(value) }}
      role="search"
    >
      <div className={`${styles.field} ${showPanel ? styles.fieldOpen : ''}`}>
        <svg className={styles.icon} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <input
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search movies, TV shows, actors…"
          className={styles.input}
          autoComplete="off"
          spellCheck="false"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="search-suggestions"
        />
        {loading && <span className={styles.spinner} aria-hidden="true" />}
        {value && !loading && (
          <button type="button" className={styles.clear} onClick={() => { onChange(''); setOpen(true) }} aria-label="Clear search">✕</button>
        )}
        <button type="submit" className={styles.btn}>Search</button>
      </div>

      {showPanel && (
        <div className={styles.panel} id="search-suggestions" role="listbox">
          {items.length === 0 && !loading && (
            <p className={styles.empty}>No quick matches — press Enter to search everything for “{q}”</p>
          )}

          {data.titles.length > 0 && <p className={styles.group}>Titles</p>}
          {items.map((entry, i) => {
            const it = entry.item
            const isPerson = entry.kind === 'person'
            const name = it.title || it.name
            const img = isPerson ? it.profile_path : it.poster_path
            return (
              <React.Fragment key={`${entry.kind}-${it.media_type}-${it.id}`}>
                {isPerson && i === data.titles.length && <p className={styles.group}>People</p>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  className={`${styles.row} ${i === active ? styles.rowActive : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => choose(entry)}
                >
                  <span className={`${styles.thumb} ${isPerson ? styles.thumbRound : ''}`}>
                    {img
                      ? <img src={`https://image.tmdb.org/t/p/w92${img}`} alt="" loading="lazy" />
                      : <span>{name?.slice(0, 1)}</span>}
                  </span>
                  <span className={styles.text}>
                    <span className={styles.name}><Highlight text={name || ''} query={q} /></span>
                    <span className={styles.meta}>
                      {isPerson
                        ? (it.known_for || []).slice(0, 2).map(k => k.title || k.name).join(', ') || 'Actor'
                        : <>
                            <span className={styles.type}>{it.media_type === 'movie' ? 'Movie' : 'TV'}</span>
                            {getYear(it.release_date || it.first_air_date)}
                            {it.vote_average > 0 && <span className={styles.rating}>★ {it.vote_average.toFixed(1)}</span>}
                          </>}
                    </span>
                  </span>
                  <svg className={styles.go} viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                </button>
              </React.Fragment>
            )
          })}

          <button
            type="button"
            className={styles.all}
            onMouseDown={e => e.preventDefault()}
            onClick={() => runSearch(value)}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            See all results for “{q}”
          </button>
        </div>
      )}
    </form>
  )
})

export default SearchBox
