import React, { useEffect, useRef, useState } from 'react'
import styles from './NotifyButton.module.css'

// Firebase is loaded on demand so it doesn't slow down the first page load
const push = () => import('../lib/notifications.js')
const configured = Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_APP_ID)

// "Not now" keeps the card from popping up on its own for 7 days
const SNOOZE_KEY = 'dw_notify_snooze'
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const AUTO_SHOW_DELAY = 6000

function snoozed() {
  try { return Date.now() < Number(localStorage.getItem(SNOOZE_KEY) || 0) } catch { return false }
}
function snooze() {
  try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + WEEK_MS)) } catch {}
}

const BellIcon = ({ size = 18, filled = false }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
)

export default function NotifyButton() {
  const [supported, setSupported] = useState(false)
  const [state, setState] = useState('default') // default | granted | denied | busy
  const [cardOpen, setCardOpen] = useState(false)
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!configured || !('Notification' in window)) return
    let timer
    push().then(async m => {
      const ok = await m.pushSupported()
      setSupported(ok)
      if (!ok) return
      setState(Notification.permission)
      m.resumePush()
      // Soft ask: show the card once by itself, never the browser prompt
      if (Notification.permission === 'default' && !snoozed()) {
        timer = setTimeout(() => setCardOpen(true), AUTO_SHOW_DELAY)
      }
    }).catch(() => {})
    return () => clearTimeout(timer)
  }, [])

  // Close on outside click / Escape (counts as "not now")
  useEffect(() => {
    if (!cardOpen) return
    const onDown = e => { if (!wrapRef.current?.contains(e.target)) dismiss() }
    const onKey = e => e.key === 'Escape' && dismiss()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [cardOpen])

  function flash(msg) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 3500)
  }

  function dismiss() {
    snooze()
    setCardOpen(false)
  }

  function onBellClick() {
    if (state === 'granted') return flash("You're subscribed to notifications 🔔")
    if (state === 'denied') return flash('Notifications are blocked. Allow them from the 🔒 icon in your address bar.')
    if (state === 'busy') return
    setCardOpen(o => !o)
  }

  async function turnOn() {
    setCardOpen(false)
    setState('busy')
    try {
      const result = await (await push()).enablePush()
      setState(result)
      if (result !== 'granted') snooze()
      flash(result === 'granted' ? "You're in! We'll let you know when something new drops 🎉" : 'Notifications were not enabled.')
    } catch (e) {
      console.error(e)
      setState(Notification.permission === 'granted' ? 'granted' : 'default')
      flash('Setup failed — please try again later.')
    }
  }

  if (!supported) return null

  const on = state === 'granted'

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        className={`${styles.btn} ${on ? styles.on : ''} ${state === 'default' ? styles.pulse : ''} ${cardOpen ? styles.btnOpen : ''}`}
        onClick={onBellClick}
        aria-label={on ? 'Notifications enabled' : 'Get notifications'}
        aria-expanded={cardOpen}
        title={on ? 'Notifications enabled' : 'Get notifications'}
        disabled={state === 'busy'}
      >
        {state === 'denied' ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13.7 21a2 2 0 0 1-3.4 0M18.6 13A17 17 0 0 1 18 8M6.3 6.3A6 6 0 0 0 6 8c0 7-3 9-3 9h14M18 8a6 6 0 0 0-9.3-5M3 3l18 18" /></svg>
        ) : (
          <BellIcon filled={on} />
        )}
        {state === 'busy' && <span className={styles.spinner} />}
      </button>

      {cardOpen && (
        <div className={styles.card} role="dialog" aria-labelledby="notify-title">
          <button className={styles.cardClose} onClick={dismiss} aria-label="Close">✕</button>

          <div className={styles.cardTop}>
            <div className={styles.bellBadge}>
              <span className={styles.ring} />
              <span className={styles.bellShake}><BellIcon size={24} filled /></span>
              <span className={styles.badgeDot}>1</span>
            </div>
            <div>
              <p className={styles.kicker}>Never miss a release</p>
              <h3 id="notify-title" className={styles.cardTitle}>Stay in the loop</h3>
            </div>
          </div>

          <p className={styles.cardText}>
            Get notified about the latest <b>movies</b>, <b>TV shows</b>, and <b>episodes</b> as soon as they're released.
          </p>

          <ul className={styles.perks}>
            <li><span>🎬</span>New movies</li>
            <li><span>📺</span>New episodes</li>
            <li><span>🔕</span>No spam</li>
          </ul>

          <div className={styles.cardActions}>
            <button className={styles.turnOn} onClick={turnOn}>
              <BellIcon size={16} filled />
              Turn on notifications
            </button>
            <button className={styles.notNow} onClick={dismiss}>Not now</button>
          </div>
        </div>
      )}

      {toast && <div className={styles.toast} role="status">{toast}</div>}
    </div>
  )
}
