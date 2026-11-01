import React, { useEffect, useState } from 'react'
import { similarTitles } from '../lib/search.js'
import MediaGrid from './MediaGrid.jsx'
import styles from './YouMayAlsoLike.module.css'

export default function YouMayAlsoLike({ item, type, onSelect }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let stale = false
    setLoading(true)
    setItems([])
    similarTitles(item, type)
      .then(list => { if (!stale) setItems(list) })
      .catch(() => {})
      .finally(() => { if (!stale) setLoading(false) })
    return () => { stale = true }
  }, [item.id, type])

  if (!loading && items.length === 0) return null

  return (
    <section className={styles.wrap}>
      <h2 className={styles.title}>You may also like</h2>
      <MediaGrid items={items} type={type} loading={loading} onSelect={onSelect} />
    </section>
  )
}
