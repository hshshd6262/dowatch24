import React, { useState } from 'react'
import { SERVERS, embedUrl } from '../lib/api.js'
import styles from './Player.module.css'

// The viewer's last chosen server is remembered between visits
const SERVER_KEY = 'dw_server'
function savedServer() {
  try {
    const id = localStorage.getItem(SERVER_KEY)
    return SERVERS.some(s => s.id === id) ? id : SERVERS[0].id
  } catch {
    return SERVERS[0].id
  }
}

export default function Player({ src, embed, title, year, rating, overview, badge, onClose }) {
  const [server, setServer] = useState(savedServer)

  // Movies / episodes come with `embed` and can switch servers; trailers just have `src`
  const frameSrc = embed ? embedUrl(embed, server) : src
  if (!frameSrc) return null

  function pickServer(id) {
    setServer(id)
    try { localStorage.setItem(SERVER_KEY, id) } catch {}
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.meta}>
        <div className={styles.metaTop}>
          <h2 className={styles.title}>{title}</h2>
          {onClose && (
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close player">✕</button>
          )}
        </div>
        <div className={styles.pills}>
          {year && <span className={styles.pill}>{year}</span>}
          {rating && <span className={`${styles.pill} ${styles.gold}`}>★ {rating}</span>}
          {badge && <span className={`${styles.pill} ${styles.badge}`}>{badge}</span>}
        </div>
        {overview && <p className={styles.overview}>{overview}</p>}
      </div>
      <div className={styles.playerBox}>
        <iframe
          key={frameSrc}
          src={frameSrc}
          allowFullScreen
          // "*" so fullscreen still works when the player redirects to a new domain
          // (framextv.xyz → framextv.cc); plain "fullscreen" only covers the original one
          allow="autoplay *; encrypted-media *; fullscreen *; picture-in-picture *"
          // Lets the player run but blocks pop-ups, new tabs and redirects away from the site
          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-orientation-lock allow-pointer-lock"
          title={title}
        />
      </div>

      {embed && (
        <div className={styles.servers}>
          <div className={styles.serverRow} role="radiogroup" aria-label="Video server">
            <span className={styles.serverLabel}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></svg>
              Servers
            </span>
            {SERVERS.map(s => (
              <button
                key={s.id}
                role="radio"
                aria-checked={server === s.id}
                className={`${styles.serverBtn} ${server === s.id ? styles.serverActive : ''}`}
                onClick={() => pickServer(s.id)}
              >
                {server === s.id && <span className={styles.liveDot} />}
                {s.name}
              </button>
            ))}
          </div>
          <p className={styles.serverNote}>
            <span aria-hidden="true">💡</span>
            <span>If the video doesn't load, keeps buffering or shows an error, <b>switch to another server</b>.</span>
          </p>
        </div>
      )}
    </div>
  )
}
