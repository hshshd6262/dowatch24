import React, { useEffect, useState } from 'react'
import { enablePush, permissionState, platform, pushSupported, resumePush, sendTestPush } from '../lib/push.js'
import styles from './NotifyPrompt.module.css'

// "Not now" waits a week before the card pops up by itself again (the bell always opens it)
const SNOOZE_KEY = 'dw_notify_snooze'
const WEEK = 7 * 24 * 60 * 60 * 1000
const snoozed = () => { try { return Date.now() < Number(localStorage.getItem(SNOOZE_KEY) || 0) } catch { return true } }
const snooze = () => { try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + WEEK)) } catch {} }

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

const Bell = () => (
  <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
)

// Notification card. Opens by itself after saving a title (or once in the Android app),
// and always when the header bell is tapped (event "dw:open-notify").
export default function NotifyPrompt() {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState('ask') // ask | done | on | blocked | unsupported
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  function show() {
    const p = permissionState()
    setMessage('')
    setView(p === 'granted' ? 'on' : p === 'denied' ? 'blocked' : p === 'unsupported' ? 'unsupported' : 'ask')
    setOpen(true)
  }

  useEffect(() => {
    resumePush()

    // Automatic moments: only when it makes sense to ask
    const autoAsk = () => { if (pushSupported() && Notification.permission === 'default' && !snoozed()) show() }
    window.addEventListener('dw:ask-notify', autoAsk)
    window.addEventListener('dw:open-notify', show)

    // In the Android app and iPhone Home Screen app: offer it ~20 s after opening.
    // Phones only show their real "Allow notifications?" box after a tap, so the card's button does that.
    const where = platform()
    const t = where === 'android-app' || where === 'ios-app' ? setTimeout(autoAsk, 20000) : null
    return () => {
      window.removeEventListener('dw:ask-notify', autoAsk)
      window.removeEventListener('dw:open-notify', show)
      clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    if (!open || busy) return
    const onKey = e => e.key === 'Escape' && dismiss()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, view, busy])

  function dismiss() {
    if (view === 'ask') snooze()
    setOpen(false)
    window.dispatchEvent(new Event('dw:notify-changed'))
  }

  async function turnOn() {
    setBusy(true)
    setMessage('')
    try {
      const result = await enablePush()
      if (result === 'granted') setView('done')
      else if (result === 'denied') setView('blocked')
      else { setView('ask'); setMessage('You closed the permission box. Tap the button and choose Allow.') }
    } catch (err) {
      console.error(err)
      setView('ask')
      setMessage(`Couldn't turn on notifications: ${err.message || err}`)
    }
    setBusy(false)
    window.dispatchEvent(new Event('dw:notify-changed'))
  }

  async function test() {
    setBusy(true)
    setMessage('')
    try {
      await sendTestPush()
      setView('on')
      setMessage('Test sent ✅ It should arrive in a few seconds.')
    } catch (err) {
      console.error(err)
      setView('on')
      setMessage(`Test failed: ${err.message || err}`)
    }
    setBusy(false)
  }

  if (!open) return null

  const where = platform()

  return (
    <div className={styles.overlay} onClick={() => !busy && dismiss()}>
      <div className={styles.card} role="dialog" aria-modal="true" aria-labelledby="notify-title" onClick={e => e.stopPropagation()}>
        <div className={styles.glow} />
        <div className={`${styles.bell} ${view === 'blocked' ? styles.bellOff : ''}`}><Bell /></div>

        {view === 'done' && (
          <>
            <h2 id="notify-title" className={styles.title}>You're in! 🎉</h2>
            <p className={styles.text}>A welcome notification is on its way. You'll hear about new episodes and what's trending.</p>
            <button className={styles.on} onClick={dismiss}>Done</button>
          </>
        )}

        {view === 'ask' && (
          <>
            <h2 id="notify-title" className={styles.title}>Never miss a new episode</h2>
            <p className={styles.text}>Get a heads-up when new episodes drop and what's trending tonight. No spam, turn it off anytime.</p>
            {message && <p className={styles.error}>{message}</p>}
            <button className={styles.on} onClick={turnOn} disabled={busy}>{busy ? 'Turning on…' : 'Turn on notifications'}</button>
            <button className={styles.later} onClick={dismiss} disabled={busy}>Not now</button>
          </>
        )}

        {view === 'on' && (
          <>
            <h2 id="notify-title" className={styles.title}>Notifications are on ✅</h2>
            <p className={styles.text}>You'll get new episodes and tonight's trending pick on this device.</p>
            {message && <p className={message.startsWith('Test sent') ? styles.ok : styles.error}>{message}</p>}
            <button className={styles.on} onClick={test} disabled={busy}>{busy ? 'Sending…' : 'Send me a test notification'}</button>
            <button className={styles.later} onClick={dismiss} disabled={busy}>Close</button>
          </>
        )}

        {view === 'blocked' && (
          <>
            <h2 id="notify-title" className={styles.title}>Notifications are blocked</h2>
            <p className={styles.text}>Your phone is blocking notifications from Dowatch24. To turn them on:</p>
            <ol className={styles.steps}>
              {where === 'ios-app' ? (
                <>
                  <li>Open your iPhone's <b>Settings → Notifications</b></li>
                  <li>Find <b>Dowatch24</b> and turn on <b>Allow Notifications</b></li>
                  <li>Come back to the app, notifications start automatically</li>
                </>
              ) : where === 'android-app' ? (
                <>
                  <li>Open your phone's <b>Settings → Apps → Dowatch24</b></li>
                  <li>Tap <b>Notifications</b> and turn them <b>on</b></li>
                  <li>Come back and tap the 🔔 again</li>
                </>
              ) : (
                <>
                  <li>Tap the <b>🔒 / ⚙ icon</b> next to dowatch24.com in the address bar</li>
                  <li>Go to <b>Permissions → Notifications</b> and choose <b>Allow</b></li>
                  <li>Reload the page and tap the 🔔 again</li>
                </>
              )}
            </ol>
            <button className={styles.on} onClick={dismiss}>Got it</button>
          </>
        )}

        {view === 'unsupported' && (
          <>
            <h2 id="notify-title" className={styles.title}>Notifications aren't available here</h2>
            <p className={styles.text}>
              {isIOS
                ? 'Notifications need iOS 16.4 or newer. Update your iPhone in Settings → General → Software Update, then open Dowatch24 from your Home Screen.'
                : 'This browser can’t receive notifications. Try Chrome, or install the Dowatch24 app.'}
            </p>
            <button className={styles.on} onClick={dismiss}>Got it</button>
          </>
        )}
      </div>
    </div>
  )
}
