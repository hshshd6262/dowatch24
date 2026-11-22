import { useEffect, useState } from 'react'

// "My List" bookmarks live in this browser's localStorage: they stay until the
// visitor clears site data, and aren't shared between devices or browsers.
const KEY = 'dw_my_list'
const EVENT = 'dw:mylist'

export function getMyList() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
}

function save(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch {}
  window.dispatchEvent(new Event(EVENT))
}

const keyOf = item => `${item.media_type}-${item.id}`

export function isSaved(item) {
  return getMyList().some(x => keyOf(x) === keyOf(item))
}

// Keeps just what a poster card needs
export function toListItem(item, type) {
  return {
    id: item.id,
    media_type: item.media_type || type,
    title: item.title,
    name: item.name,
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path,
    release_date: item.release_date,
    first_air_date: item.first_air_date,
    vote_average: item.vote_average,
    genre_ids: item.genre_ids || (item.genres || []).map(g => g.id),
  }
}

export function toggleSaved(item) {
  const list = getMyList()
  const saved = list.some(x => keyOf(x) === keyOf(item))
  save(saved ? list.filter(x => keyOf(x) !== keyOf(item)) : [{ ...item, savedAt: Date.now() }, ...list])
  return !saved
}

// Re-renders when the list changes in this tab or another one
export function useMyList() {
  const [list, setList] = useState(getMyList)
  useEffect(() => {
    const update = () => setList(getMyList())
    const onStorage = e => e.key === KEY && update()
    window.addEventListener(EVENT, update)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(EVENT, update)
      window.removeEventListener('storage', onStorage)
    }
  }, [])
  return list
}
