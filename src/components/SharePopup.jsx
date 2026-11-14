import React, { useEffect, useRef, useState } from 'react'
import { hideShareForAWeek, shareHidden } from '../lib/share.js'
import DiscordIcon, { DISCORD_URL } from './DiscordIcon.jsx'
import styles from './SharePopup.module.css'

// "Join our community" popup: shows a moment after someone opens a movie / TV show.
// Closing it or joining hides it for 7 days.
export default function SharePopup() {
  const [open, setOpen] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    function onRequest() {
      if (open || shareHidden()) return
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setOpen(true), 1200)
    }
    window.addEventListener('dw:share', onRequest)
    return () => {
      window.removeEventListener('dw:share', onRequest)
      clearTimeout(timer.current)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = e => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function close() {
    hideShareForAWeek()
    setOpen(false)
  }

  function join() {
    hideShareForAWeek()
    window.open(DISCORD_URL, '_blank', 'noopener,noreferrer')
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={close}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-title"
        onClick={e => e.stopPropagation()}
      >
        <button className={styles.close} onClick={close} aria-label="Close">✕</button>

        <div className={`${styles.glow} ${styles.glowDiscord}`} />
        <div className={styles.discordBadge}>
          <DiscordIcon size={34} />
        </div>

        <h2 id="community-title" className={styles.title}>Join our community</h2>
        <p className={styles.text}>
          Hang out with other Dowatch24 viewers on Discord. Be the first to know about new releases, request movies and shows, and get help if something isn't playing.
        </p>

        <ul className={styles.perks}>
          <li><span>🎬</span>New releases</li>
          <li><span>🙋</span>Requests</li>
          <li><span>🛠️</span>Help &amp; support</li>
        </ul>

        <button className={styles.joinBtn} onClick={join}>
          <DiscordIcon size={20} />
          Join our Discord
        </button>

        <button className={styles.later} onClick={close}>Maybe later</button>
      </div>
    </div>
  )
}
