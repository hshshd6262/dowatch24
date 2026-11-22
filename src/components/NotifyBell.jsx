import React, { useEffect, useState } from 'react'
import { permissionState } from '../lib/push.js'
import styles from './NotifyBell.module.css'

// Header bell: always opens the notification card (turn on / test / how to unblock).
// Green dot = notifications on, red dot = off or blocked.
export default function NotifyBell({ className = '' }) {
  const [state, setState] = useState(permissionState)

  useEffect(() => {
    const update = () => setState(permissionState())
    window.addEventListener('dw:notify-changed', update)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.removeEventListener('dw:notify-changed', update)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  const on = state === 'granted'
  const label = on ? 'Notifications are on' : state === 'denied' ? 'Notifications are blocked' : 'Turn on notifications'

  return (
    <button
      className={`${styles.bell} ${className}`}
      onClick={() => window.dispatchEvent(new Event('dw:open-notify'))}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      <span className={`${styles.dot} ${on ? styles.dotOn : styles.dotOff}`} />
    </button>
  )
}
