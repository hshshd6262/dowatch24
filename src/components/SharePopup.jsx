import React, { useEffect, useRef, useState } from 'react'
import { hideShareForAWeek, shareHidden } from '../lib/share.js'
import styles from './SharePopup.module.css'

const SHARE_TEXT = 'Watch movies & TV shows on Dowatch24'

const icons = {
  facebook: <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" fill="currentColor" />,
  x: <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" fill="currentColor" />,
  whatsapp: (
    <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 20.5l1.3-4.2A8.6 8.6 0 1 1 8 19.3z" />
      <path d="M9.2 8.6c.3 1.9 2.2 4.2 4.6 5.1l1.1-1.1 1.7.9c-.2 1-1 1.6-2 1.6-3 0-6.4-3.4-6.4-6.4 0-1 .6-1.8 1.6-2l.9 1.7z" fill="currentColor" stroke="none" />
    </g>
  ),
  telegram: <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" fill="currentColor" />,
  more: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M7.5 7.5L12 3l4.5 4.5" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </g>
  ),
}

export default function SharePopup() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)
  const url = window.location.origin

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

  function shareTo(link) {
    hideShareForAWeek()
    window.open(link, '_blank', 'noopener,noreferrer,width=620,height=560')
    setOpen(false)
  }

  async function copyLink() {
    hideShareForAWeek()
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => { setCopied(false); setOpen(false) }, 1100)
    } catch {
      setOpen(false)
    }
  }

  async function nativeShare() {
    hideShareForAWeek()
    try { await navigator.share({ title: 'Dowatch24', text: SHARE_TEXT, url }) } catch {}
    setOpen(false)
  }

  if (!open) return null

  const u = encodeURIComponent(url)
  const t = encodeURIComponent(SHARE_TEXT)
  const targets = [
    { id: 'facebook', label: 'Facebook', link: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { id: 'x', label: 'X', link: `https://twitter.com/intent/tweet?text=${t}&url=${u}` },
    { id: 'whatsapp', label: 'WhatsApp', link: `https://wa.me/?text=${t}%20${u}` },
    { id: 'telegram', label: 'Telegram', link: `https://t.me/share/url?url=${u}&text=${t}` },
  ]

  return (
    <div className={styles.overlay} onClick={close}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        onClick={e => e.stopPropagation()}
      >
        <button className={styles.close} onClick={close} aria-label="Close">✕</button>

        <div className={styles.glow} />
        <div className={styles.heart}>
          <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.7 4.5c2.1 0 3.6 1.1 4.3 2.4l1 1.6 1-1.6c.7-1.3 2.2-2.4 4.3-2.4 3.7 0 5.8 3.7 4.3 7.2C19.5 16.4 12 21 12 21z" /></svg>
        </div>

        <h2 id="share-title" className={styles.title}>Sharing is caring</h2>
        <p className={styles.text}>
          Enjoying Dowatch24? Share it with your friends. It's the biggest motivation for us to keep making the site better.
        </p>

        <div className={styles.grid}>
          {targets.map(s => (
            <button key={s.id} className={styles.target} onClick={() => shareTo(s.link)}>
              <span className={`${styles.icon} ${styles[s.id]}`}>
                <svg viewBox="0 0 24 24" width="22" height="22">{icons[s.id]}</svg>
              </span>
              <span className={styles.label}>{s.label}</span>
            </button>
          ))}
          {typeof navigator.share === 'function' && (
            <button className={styles.target} onClick={nativeShare}>
              <span className={`${styles.icon} ${styles.more}`}>
                <svg viewBox="0 0 24 24" width="22" height="22">{icons.more}</svg>
              </span>
              <span className={styles.label}>More</span>
            </button>
          )}
        </div>

        <div className={styles.copyRow}>
          <span className={styles.url}>{url.replace(/^https?:\/\//, '')}</span>
          <button className={`${styles.copy} ${copied ? styles.copied : ''}`} onClick={copyLink}>
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>

        <button className={styles.later} onClick={close}>Maybe later</button>
      </div>
    </div>
  )
}
