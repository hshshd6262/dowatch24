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

const ua = navigator.userAgent
const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
const isAndroid = /Android/i.test(ua)
const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true

const BellIcon = ({ size = 18, filled = false }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
)
const BellOffIcon = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13.7 21a2 2 0 0 1-3.4 0M18.6 13A17 17 0 0 1 18 8M6.3 6.3A6 6 0 0 0 6 8c0 7-3 9-3 9h14M18 8a6 6 0 0 0-9.3-5M3 3l18 18" /></svg>
)
const ShareIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px' }}><path d="M12 3v12M7.5 7.5L12 3l4.5 4.5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
)

export default function NotifyButton() {
  // mode: hidden | ios (needs Home Screen install) | push (normal web push)
  const [mode, setMode] = useState('hidden')
  const [state, setState] = useState('default') // default | granted | denied | busy
  const [card, setCard] = useState(null) // null | 'ask' | 'blocked' | 'ios'
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!configured) return
    let timer

    // iPhone/iPad in a normal Safari tab: push only works once added to the Home Screen
    if (isIOS && !isStandalone) {
      setMode('ios')
      if (!snoozed()) timer = setTimeout(() => setCard('ios'), AUTO_SHOW_DELAY)
      return () => clearTimeout(timer)
    }

    if (!('Notification' in window)) return
    push().then(async m => {
      if (!(await m.pushSupported())) return
      setMode('push')
      setState(Notification.permission)
      m.resumePush()
      // Soft ask: show the card once by itself, never the browser prompt
      if (Notification.permission === 'default' && !snoozed()) {
        timer = setTimeout(() => setCard('ask'), AUTO_SHOW_DELAY)
      }
    }).catch(() => {})

    return () => clearTimeout(timer)
  }, [])

  // Notice when they unblock / allow from the browser's site settings
  useEffect(() => {
    if (mode !== 'push' || !navigator.permissions?.query) return
    let status
    const onChange = () => {
      const p = Notification.permission
      setState(p)
      if (p === 'granted') {
        setCard(null)
        push().then(m => m.resumePush())
        flash("You're in! We'll let you know when something new drops 🎉")
      }
    }
    navigator.permissions.query({ name: 'notifications' })
      .then(s => { status = s; s.addEventListener('change', onChange) })
      .catch(() => {})
    // Fallback for browsers that don't fire "change": re-check when the tab comes back
    const onVisible = () => document.visibilityState === 'visible' && Notification.permission !== state && onChange()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      status?.removeEventListener('change', onChange)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [mode, state])

  // Close on outside click / Escape (counts as "not now")
  useEffect(() => {
    if (!card) return
    const onDown = e => { if (!wrapRef.current?.contains(e.target)) dismiss() }
    const onKey = e => e.key === 'Escape' && dismiss()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [card])

  function flash(msg) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 3500)
  }

  function dismiss() {
    if (card !== 'blocked') snooze()
    setCard(null)
  }

  function onBellClick() {
    if (card) return setCard(null)
    if (mode === 'ios') return setCard('ios')
    if (state === 'granted') return flash("You're subscribed to notifications 🔔")
    if (state === 'denied') return setCard('blocked')
    if (state === 'busy') return
    setCard('ask')
  }

  async function turnOn() {
    setCard(null)
    setState('busy')
    try {
      const result = await (await push()).enablePush()
      setState(result)
      if (result === 'granted') flash("You're in! We'll let you know when something new drops 🎉")
      else if (result === 'denied') setCard('blocked')
      else { snooze(); flash('Notifications were not enabled.') }
    } catch (e) {
      console.error(e)
      setState(Notification.permission === 'granted' ? 'granted' : Notification.permission)
      flash('Setup failed — please try again later.')
    }
  }

  function recheck() {
    const p = Notification.permission
    setState(p)
    if (p === 'granted') {
      setCard(null)
      push().then(m => m.resumePush())
      flash("You're in! We'll let you know when something new drops 🎉")
    } else if (p === 'default') {
      turnOn()
    } else {
      flash('Still blocked — follow the steps above, then reload the page.')
    }
  }

  if (mode === 'hidden') return null

  const on = mode === 'push' && state === 'granted'
  const blocked = mode === 'push' && state === 'denied'

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        className={`${styles.btn} ${on ? styles.on : ''} ${!on && !blocked ? styles.pulse : ''} ${card ? styles.btnOpen : ''}`}
        onClick={onBellClick}
        aria-label={on ? 'Notifications enabled' : 'Get notifications'}
        aria-expanded={Boolean(card)}
        title={on ? 'Notifications enabled' : 'Get notifications'}
        disabled={state === 'busy'}
      >
        {blocked ? <BellOffIcon /> : <BellIcon filled={on} />}
        {state === 'busy' && <span className={styles.spinner} />}
      </button>

      {card && (
        <div className={styles.card} role="dialog" aria-labelledby="notify-title">
          <button className={styles.cardClose} onClick={dismiss} aria-label="Close">✕</button>

          <div className={styles.cardTop}>
            <div className={`${styles.bellBadge} ${card === 'blocked' ? styles.bellBadgeMuted : ''}`}>
              {card !== 'blocked' && <span className={styles.ring} />}
              <span className={card === 'blocked' ? '' : styles.bellShake}>
                {card === 'blocked' ? <BellOffIcon size={24} /> : <BellIcon size={24} filled />}
              </span>
              {card !== 'blocked' && <span className={styles.badgeDot}>1</span>}
            </div>
            <div>
              <p className={styles.kicker}>{card === 'blocked' ? 'Notifications are off' : 'Never miss a release'}</p>
              <h3 id="notify-title" className={styles.cardTitle}>
                {card === 'blocked' ? 'Unblock notifications' : 'Stay in the loop'}
              </h3>
            </div>
          </div>

          <p className={styles.cardText}>
            Get notified about the latest <b>movies</b>, <b>TV shows</b>, and <b>episodes</b> as soon as they're released.
          </p>

          {card === 'ask' && (
            <>
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
            </>
          )}

          {card === 'blocked' && (
            <>
              <ol className={styles.steps}>
                {isAndroid ? (
                  <>
                    <li>Tap the <b>⚙ settings icon</b> left of <b>{location.host}</b> in the address bar</li>
                    <li>Tap <b>Permissions → Notifications</b> and choose <b>Allow</b></li>
                    <li>Still blocked? Open phone <b>Settings → Apps → Chrome → Notifications</b> and turn them on</li>
                  </>
                ) : (
                  <>
                    <li>Click the <b>🔒 / ⚙ icon</b> left of <b>{location.host}</b> in the address bar</li>
                    <li>Set <b>Notifications</b> to <b>Allow</b></li>
                    <li>Come back here and tap the button below</li>
                  </>
                )}
              </ol>
              <div className={styles.cardActions}>
                <button className={styles.turnOn} onClick={recheck}>I've allowed it — check again</button>
                <button className={styles.notNow} onClick={dismiss}>Close</button>
              </div>
            </>
          )}

          {card === 'ios' && (
            <>
              <ol className={styles.steps}>
                <li>Tap the <b>Share</b> button <ShareIcon /> at the bottom of Safari</li>
                <li>Choose <b>Add to Home Screen</b>, then tap <b>Add</b></li>
                <li>Open <b>Dowatch24</b> from your Home Screen and tap the 🔔 bell</li>
              </ol>
              <p className={styles.note}>iPhone only allows website notifications for apps on the Home Screen (iOS 16.4 or newer).</p>
              <div className={styles.cardActions}>
                <button className={styles.notNow} onClick={dismiss}>Got it</button>
              </div>
            </>
          )}
        </div>
      )}

      {toast && <div className={styles.toast} role="status">{toast}</div>}
    </div>
  )
}
