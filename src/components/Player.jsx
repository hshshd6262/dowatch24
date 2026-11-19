import React, { useCallback, useEffect, useState } from 'react'
import { SERVERS, embedUrl } from '../lib/api.js'
import ShareBar from './ShareBar.jsx'
import AdBanner from './AdBanner.jsx'
import ServerWarning from './ServerWarning.jsx'
import { titlePath } from '../lib/links.js'
import styles from './Player.module.css'

export default function Player({ src, embed, title, year, rating, overview, badge, onClose }) {
  // Every movie / show starts on Server 1; episodes of the same show keep the chosen server
  const titleKey = embed ? `${embed.type}-${embed.id}` : null
  const [server, setServer] = useState(SERVERS[0].id)
  const [agreedFor, setAgreedFor] = useState(null) // title the ad warning was accepted for
  const [askFor, setAskFor] = useState(null) // server waiting for the ad warning
  const current = SERVERS.find(s => s.id === server) || SERVERS[0]

  useEffect(() => {
    setServer(SERVERS[0].id)
    setAgreedFor(null)
    setAskFor(null)
  }, [titleKey])

  const cancelAsk = useCallback(() => setAskFor(null), [])

  // Movies / episodes come with `embed` and can switch servers; trailers just have `src`
  const frameSrc = embed ? embedUrl(embed, server) : src
  if (!frameSrc) return null

  // The ad warning shows again for every new movie / show
  function pickServer(id) {
    const s = SERVERS.find(x => x.id === id)
    if (s.warning && agreedFor !== titleKey && id !== server) return setAskFor(s)
    setServer(id)
  }

  function agree() {
    setAgreedFor(titleKey)
    setServer(askFor.id)
    setAskFor(null)
  }

  return (
    <div className={styles.wrap}>
      {/* Banner ads above the player and between the share bar and servers (not for trailers) */}
      {embed && <AdBanner className={styles.adTop} />}

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
          // (servers marked sandbox: false can't play inside it)
          sandbox={embed && current.sandbox === false ? undefined : 'allow-scripts allow-same-origin allow-forms allow-presentation allow-orientation-lock allow-pointer-lock'}
          title={title}
        />
      </div>

      {embed && (
        <ShareBar
          title={embed.type === 'tv' ? `${title} S${embed.season} E${embed.episode}` : title}
          shareKey={`${embed.type}-${embed.id}`}
          sharePath={titlePath(embed.type, embed.id, embed.type === 'tv' ? embed : null)}
        />
      )}

      {embed && <AdBanner className={styles.adMiddle} />}

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
                {s.tag && <span className={styles.serverTag}>⚡ {s.tag}</span>}
              </button>
            ))}
          </div>
          <p className={styles.serverNote}>
            <span aria-hidden="true">💡</span>
            <span>If the video doesn't load, keeps buffering or shows an error, <b>switch to another server</b>.</span>
          </p>
        </div>
      )}

      {askFor && <ServerWarning server={askFor} onAgree={agree} onCancel={cancelAsk} />}
    </div>
  )
}
