import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { apkUrl, canInstallWeb, getAppVersion, installKind, installWeb, isInstalled } from '../lib/install.js'
import { trackEvent } from '../lib/analytics.js'
import styles from './InstallApp.module.css'

const Download = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
  </svg>
)

// Header "Install App" button + the sheet that explains how (per device).
// Hidden inside the Android app and installed web app.
export default function InstallApp({ className = '' }) {
  const [open, setOpen] = useState(false)
  const [kind] = useState(installKind)
  const [downloaded, setDownloaded] = useState(false)
  const [app, setApp] = useState(null)

  // Latest version + what's new, from public/app-version.json
  useEffect(() => {
    if (open && !app) getAppVersion().then(setApp)
  }, [open, app])

  useEffect(() => {
    if (!open) return
    const onKey = e => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (isInstalled()) return null

  async function onClick() {
    trackEvent('install_button_click', { install_kind: kind })
    // Computer with the browser's install offer ready: install straight away
    if (kind === 'web' && canInstallWeb()) {
      const outcome = await installWeb()
      if (outcome !== 'unavailable') return
    }
    setOpen(true)
  }

  function downloadApk() {
    trackEvent('apk_download', { source: 'header' })
    setDownloaded(true)
  }

  return (
    <>
      <button className={`${styles.btn} ${className}`} onClick={onClick} aria-label="Install the Dowatch24 app">
        <Download />
        <span className={styles.long}>Install App</span>
        <span className={styles.short}>Get App</span>
      </button>

      {/* Rendered on <body>: the header's blur would otherwise trap the sheet inside the header */}
      {open && createPortal(
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={e => e.stopPropagation()}>
            <button className={styles.close} onClick={() => setOpen(false)} aria-label="Close">✕</button>
            <div className={styles.glow} />
            <img className={styles.icon} src="/icon-192.png" alt="" width="72" height="72" />
            <h2 id="install-title" className={styles.title}>Get the Dowatch24 app</h2>

            {kind === 'apk' && (
              <>
                <p className={styles.text}>Free · No sign-up · Opens full screen, faster than the website.</p>
                <a className={styles.primary} href={apkUrl(app)} download="Dowatch24.apk" onClick={downloadApk}>
                  <Download size={18} /> Download for Android
                </a>
                <p className={styles.size}>
                  {app?.versionName ? `Version ${app.versionName} · ` : ''}Android 7.0 or newer{app?.size ? ` · ${app.size}` : ''}
                </p>
                <ol className={`${styles.steps} ${downloaded ? styles.stepsHot : ''}`}>
                  <li>Open the downloaded <b>Dowatch24.apk</b></li>
                  <li>If asked, allow <b>Install unknown apps</b> for your browser</li>
                  <li>If Play Protect warns you, tap <b>More details → Install anyway</b></li>
                </ol>
              </>
            )}

            {kind === 'ios' && (
              <>
                <p className={styles.text}>On iPhone, add Dowatch24 to your Home Screen. It opens like an app.</p>
                <ol className={styles.steps}>
                  <li>Tap the <b>Share</b> button at the bottom of Safari</li>
                  <li>Choose <b>Add to Home Screen</b>, then tap <b>Add</b></li>
                  <li>Open <b>Dowatch24</b> from your Home Screen</li>
                </ol>
              </>
            )}

            {kind === 'web' && (
              <>
                <p className={styles.text}>Install Dowatch24 on this computer, or get the Android app on your phone.</p>
                <ol className={styles.steps}>
                  <li>In Chrome or Edge, click the <b>install icon</b> in the address bar (or menu <b>⋮ → Install Dowatch24</b>)</li>
                  <li>On your Android phone, open <b>dowatch24.com</b> and tap <b>Get App</b></li>
                </ol>
                <a className={styles.secondary} href={apkUrl(app)} download="Dowatch24.apk" onClick={downloadApk}>
                  <Download size={16} /> Download Android APK
                </a>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
