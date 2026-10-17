import React, { useEffect, useRef, useState } from 'react'
import styles from './NotifyButton.module.css'

// Firebase is loaded on demand so it doesn't slow down the first page load
const push = () => import('../lib/notifications.js')
const configured = Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_APP_ID)

export default function NotifyButton() {
  const [supported, setSupported] = useState(false)
  const [state, setState] = useState('default') // default | granted | denied | busy
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  useEffect(() => {
    if (!configured || !('Notification' in window)) return
    push().then(async m => {
      const ok = await m.pushSupported()
      setSupported(ok)
      if (ok) {
        setState(Notification.permission)
        m.resumePush()
      }
    }).catch(() => {})
  }, [])

  function flash(msg) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 3500)
  }

  async function onClick() {
    if (state === 'granted') return flash("You're subscribed to notifications 🔔")
    if (state === 'denied') return flash('Notifications are blocked. Allow them from the 🔒 icon in your address bar.')
    if (state === 'busy') return

    setState('busy')
    try {
      const result = await (await push()).enablePush()
      setState(result)
      flash(result === 'granted' ? 'Notifications enabled! 🎉' : 'Notifications were not enabled.')
    } catch (e) {
      console.error(e)
      setState(Notification.permission === 'granted' ? 'granted' : 'default')
      flash('Setup failed — please try again later.')
    }
  }

  if (!supported) return null

  const on = state === 'granted'

  return (
    <div className={styles.wrap}>
      <button
        className={`${styles.btn} ${on ? styles.on : ''} ${state === 'default' ? styles.pulse : ''}`}
        onClick={onClick}
        aria-label={on ? 'Notifications enabled' : 'Enable notifications'}
        title={on ? 'Notifications enabled' : 'Enable notifications'}
        disabled={state === 'busy'}
      >
        {state === 'denied' ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13.7 21a2 2 0 0 1-3.4 0M18.6 13A17 17 0 0 1 18 8M6.3 6.3A6 6 0 0 0 6 8c0 7-3 9-3 9h14M18 8a6 6 0 0 0-9.3-5M3 3l18 18" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        )}
        {state === 'busy' && <span className={styles.spinner} />}
      </button>
      {toast && <div className={styles.toast} role="status">{toast}</div>}
    </div>
  )
}
