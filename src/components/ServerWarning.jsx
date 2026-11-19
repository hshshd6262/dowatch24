import React, { useEffect, useId, useState } from 'react'
import styles from './ServerWarning.module.css'

// Shown before switching to a server that has heavy ads; continuing needs the box ticked
export default function ServerWarning({ server, onAgree, onCancel }) {
  const [agreed, setAgreed] = useState(false)
  const checkId = useId()

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="server-warning-title"
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.glow} />
        <div className={styles.badge}>
          <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6z" /></svg>
        </div>

        <p className={styles.kicker}>{server.name} · Fastest server</p>
        <h2 id="server-warning-title" className={styles.title}>Speed comes with ads</h2>

        <ul className={styles.list}>
          <li className={styles.warn}>
            <span aria-hidden="true">⚠️</span>
            <div className={styles.plain}>This server has lots of ads &amp; pop-ups.</div>
          </li>
          <li className={styles.tip}>
            <span aria-hidden="true">💡</span>
            <div><b>Tip</b>If a new tab opens, just close it and come back. Never download or install anything it asks for.</div>
          </li>
          <li className={`${styles.good} ${styles.wiggle}`}>
            <span aria-hidden="true">🛡️</span>
            <div><b>Prefer no ads?</b>Server 1 and Server 2 have no ads, but new movies and episodes are uploaded there a little later.</div>
          </li>
        </ul>

        <label className={`${styles.check} ${agreed ? styles.checkOn : ''}`} htmlFor={checkId}>
          <input id={checkId} type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
          <span className={styles.box} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17 19 7" /></svg>
          </span>
          <span>I understand this server shows ads and pop-ups, and I agree to continue.</span>
        </label>

        <div className={styles.actions}>
          <button className={styles.cancel} onClick={onCancel}>Stay on current server</button>
          <button className={styles.go} onClick={onAgree} disabled={!agreed}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6z" /></svg>
            Continue to {server.name}
          </button>
        </div>
      </div>
    </div>
  )
}
