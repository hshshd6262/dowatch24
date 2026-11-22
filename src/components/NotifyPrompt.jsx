import React, { useEffect, useState } from 'react'
import { enablePush, platform, pushSupported, resumePush } from '../lib/push.js'
import styles from './NotifyPrompt.module.css'

// "Not now" waits a week before asking again
const SNOOZE_KEY = 'dw_notify_snooze'
const WEEK = 7 * 24 * 60 * 60 * 1000
const snoozed = () => { try { return Date.now() < Number(localStorage.getItem(SNOOZE_KEY) || 0) } catch { return true } }
const snooze = () => { try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + WEEK)) } catch {} }

const canAsk = () => pushSupported() && Notification.permission === 'default' && !snoozed()

// Asks for notification permission at a good moment:
// right after someone saves a title, or once in the Android app.
export default function NotifyPrompt() {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState('ask') // ask | busy | done | error

  useEffect(() => {
    resumePush()

    const ask = () => { if (canAsk()) { setState('ask'); setOpen(true) } }
    window.addEventListener('dw:ask-notify', ask)

    // In the Android app, ask once ~20s after opening
    const t = platform() === 'android-app' ? setTimeout(ask, 20000) : null
    return () => { window.removeEventListener('dw:ask-notify', ask); clearTimeout(t) }
  }, [])

  useEffect(() => {
    if (!open || state === 'busy') return
    const onKey = e => e.key === 'Escape' && dismiss()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, state])

  function dismiss() {
    if (state === 'ask') snooze()
    setOpen(false)
  }

  async function turnOn() {
    setState('busy')
    try {
      const result = await enablePush()
      if (result === 'granted') {
        setState('done')
        setTimeout(() => setOpen(false), 2200)
      } else {
        snooze()
        setOpen(false)
      }
    } catch (err) {
      console.error(err)
      setState('error')
    }
  }

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={dismiss}>
      <div className={styles.card} role="dialog" aria-modal="true" aria-labelledby="notify-title" onClick={e => e.stopPropagation()}>
        <div className={styles.glow} />
        <div className={styles.bell}>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        </div>

        {state === 'done' ? (
          <>
            <h2 id="notify-title" className={styles.title}>You're in! 🎉</h2>
            <p className={styles.text}>A welcome notification is on its way to check everything works.</p>
          </>
        ) : (
          <>
            <h2 id="notify-title" className={styles.title}>Never miss a new episode</h2>
            <p className={styles.text}>Get a heads-up when new episodes drop and what's trending tonight. No spam, turn it off anytime.</p>
            {state === 'error' && <p className={styles.error}>Couldn't turn on notifications. Please try again.</p>}
            <button className={styles.on} onClick={turnOn} disabled={state === 'busy'}>
              {state === 'busy' ? 'Turning on…' : 'Turn on notifications'}
            </button>
            <button className={styles.later} onClick={dismiss} disabled={state === 'busy'}>Not now</button>
          </>
        )}
      </div>
    </div>
  )
}
