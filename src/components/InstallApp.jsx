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

// iPhone icons, drawn like Safari's
const ShareIcon = () => (
  <svg className={styles.inlineIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Share">
    <path d="M12 15V3M8 7l4-4 4 4" /><path d="M8 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2" />
  </svg>
)
const AddIcon = () => (
  <svg className={styles.inlineIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-label="Add to Home Screen">
    <rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8.5v7M8.5 12h7" />
  </svg>
)

// Which iPhone browser: Instagram/Facebook/TikTok's built-in browsers can't add to the Home Screen
function iosBrowser() {
  const ua = navigator.userAgent
  if (/FBAN|FBAV|Instagram|musical_ly|BytedanceWebview|TikTok|Snapchat|Line[/]|Twitter|LinkedInApp|GSA[/]/.test(ua)) return 'inapp'
  if (/CriOS/.test(ua)) return 'chrome'
  if (/FxiOS|EdgiOS|OPiOS/.test(ua)) return 'other'
  return 'safari'
}

function IosSteps() {
  const [browser] = useState(iosBrowser)
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    try { await navigator.clipboard.writeText('https://dowatch24.com') } catch {}
    setCopied(true)
    trackEvent('ios_copy_link')
  }

  if (browser === 'inapp' || browser === 'other') {
    return (
      <>
        <p className={styles.text}>
          {browser === 'inapp' ? 'This app’s built-in browser can’t install Dowatch24.' : 'Installing works in Safari.'} Open it in <b>Safari</b> first:
        </p>
        <ol className={styles.steps}>
          <li>Copy the link below</li>
          <li>Open <b>Safari</b>, paste it in the address bar and go</li>
          <li>Tap <b>Get App</b> again</li>
        </ol>
        <button className={styles.primary} onClick={copyLink}>{copied ? 'Link copied ✓' : 'Copy dowatch24.com'}</button>
      </>
    )
  }

  return (
    <>
      <p className={styles.text}>Add Dowatch24 to your Home Screen. It opens full screen like an app, with notifications.</p>
      <ol className={styles.steps}>
        {browser === 'chrome' ? (
          <li>Tap <ShareIcon /> <b>Share</b> in the address bar at the top</li>
        ) : (
          <li>Tap <ShareIcon /> <b>Share</b> at the bottom of Safari <span className={styles.hint}>(on newer iPhones, tap <b>⋯</b> first)</span></li>
        )}
        <li>Scroll down and tap <AddIcon /> <b>Add to Home Screen</b></li>
        <li>Tap <b>Add</b>, then open <b>Dowatch24</b> from your Home Screen</li>
      </ol>
      <p className={styles.size}>Notifications need iOS 16.4 or newer</p>
      {browser === 'safari' && <div className={styles.pointDown} aria-hidden="true">↓</div>}
    </>
  )
}

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

            {kind === 'ios' && <IosSteps />}

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
