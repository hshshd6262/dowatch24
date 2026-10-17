import React, { useEffect, useRef, useState } from 'react'
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

export default function AdBanner() {
  const boxRef = useRef(null)
  const [scale, setScale] = useState(1)

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
    <div className={styles.wrap} ref={boxRef} style={{ height: AD_HEIGHT * scale }}>
      <iframe
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
