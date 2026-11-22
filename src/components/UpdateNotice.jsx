import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { APK_URL } from '../lib/install.js'
import { appVersionCode } from '../lib/push.js'
import { trackEvent } from '../lib/analytics.js'
import styles from './UpdateNotice.module.css'

// Inside the Android app: compares the app's version with /app-version.json and,
// if a newer APK is out, shows what changed + an Update button.
// To announce an update: replace public/download/Dowatch24.apk and edit public/app-version.json.
export default function UpdateNotice() {
  const [info, setInfo] = useState(null)
  const [downloaded, setDownloaded] = useState(false)
  const current = appVersionCode()

  useEffect(() => {
    let alive = true
    fetch(`/app-version.json?t=${Date.now()}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!alive || !data || !(data.versionCode > current)) return
        const required = current < (data.minVersionCode || 0)
        let skipped = null
        try { skipped = localStorage.getItem('dw_update_skipped') } catch {}
        if (!required && skipped === String(data.versionCode)) return
        setInfo({ ...data, required })
        trackEvent('app_update_shown', { from: current, to: data.versionCode, required })
      })
      .catch(() => {})
    return () => { alive = false }
  }, [current])

  if (!info) return null

  function later() {
    try { localStorage.setItem('dw_update_skipped', String(info.versionCode)) } catch {}
    setInfo(null)
  }

  return createPortal(
    <div className={styles.overlay}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="update-title">
        <div className={styles.glow} />
        <img className={styles.icon} src="/icon-192.png" alt="" width="64" height="64" />
        <h2 id="update-title" className={styles.title}>
          {info.required ? 'New update required' : 'Update available'}
        </h2>
        <p className={styles.version}>Version {info.versionName}</p>

        {info.notes?.length > 0 && (
          <>
            <p className={styles.label}>What's new</p>
            <ul className={styles.notes}>
              {info.notes.map(n => <li key={n}>{n}</li>)}
            </ul>
          </>
        )}

        <a
          className={styles.primary}
          href={APK_URL}
          download="Dowatch24.apk"
          onClick={() => { setDownloaded(true); trackEvent('apk_download', { source: 'update_notice' }) }}
        >
          {downloaded ? 'Downloading…' : 'Update now'}
        </a>
        {downloaded && (
          <p className={styles.hint}>When it finishes, open <b>Dowatch24.apk</b> and tap <b>Update</b>. Your list and settings stay.</p>
        )}
        {!info.required && (
          <button className={styles.later} onClick={later}>Later</button>
        )}
      </div>
    </div>,
    document.body,
  )
}
