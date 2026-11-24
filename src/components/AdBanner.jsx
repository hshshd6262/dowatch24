import React, { useEffect, useRef, useState } from 'react'
import { countAd } from '../lib/adStats.js'
import styles from './AdBanner.module.css'

const AD_WIDTH = 728
const AD_HEIGHT = 90
const AD_KEY = 'a8b415494cd55515f01f32b098d9f2b1'

// The ad script uses document.write, so it gets its own little document
const adDoc = `<!doctype html>
<html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}</style></head>
<body>
<script>
  atOptions = {
    'key' : '${AD_KEY}',
    'format' : 'iframe',
    'height' : ${AD_HEIGHT},
    'width' : ${AD_WIDTH},
    'params' : {}
  };
</script>
<script src="https://bauval.org/22/${AD_KEY}"></script>
</body></html>`

// slot: which position on the page (for the ad counts on /stats)
export default function AdBanner({ className = '', slot = 'other' }) {
  const boxRef = useRef(null)
  const frameRef = useRef(null)
  const [scale, setScale] = useState(1)

  // Count it once when at least half of it has been on screen for 1 second,
  // and note whether the ad network actually put an ad inside
  useEffect(() => {
    const el = boxRef.current
    if (!el || !('IntersectionObserver' in window)) return
    let timer = null
    let done = false
    const io = new IntersectionObserver(([entry]) => {
      clearTimeout(timer)
      if (done || !entry.isIntersecting) return
      timer = setTimeout(() => {
        done = true
        io.disconnect()
        let filled = false
        try {
          const doc = frameRef.current?.contentDocument
          filled = Boolean(doc?.querySelector('iframe, img, ins, a[href]'))
        } catch {}
        countAd(slot, filled)
      }, 1000)
    }, { threshold: 0.5 })
    io.observe(el)
    return () => { clearTimeout(timer); io.disconnect() }
  }, [slot])

  // Shrink the 728×90 banner to fit narrow screens
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const fit = () => setScale(Math.min(1, el.clientWidth / AD_WIDTH))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className={`${styles.wrap} ${className}`} ref={boxRef} style={{ height: AD_HEIGHT * scale }}>
      <iframe
        ref={frameRef}
        title="Advertisement"
        srcDoc={adDoc}
        width={AD_WIDTH}
        height={AD_HEIGHT}
        scrolling="no"
        className={styles.frame}
        style={{ transform: `scale(${scale})` }}
      />
    </div>
  )
}
