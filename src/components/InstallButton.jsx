import { useEffect, useState } from 'react'
import styles from './InstallButton.module.css'

const DISMISS_KEY = 'dowatch24_install_dismissed'
const DISMISS_DAYS = 7

export default function InstallButton() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    if (isStandalone) return

    const dismissedUntil = localStorage.getItem(DISMISS_KEY)
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) return

    // only one instance may own the install card
    if (window.__installCardOwner) return
    window.__installCardOwner = true

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.__installCardOwner = false
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  useEffect(() => {
    const handleAppInstalled = () => {
      setVisible(false)
      setInstallPrompt(null)
      localStorage.removeItem(DISMISS_KEY)
    }

    window.addEventListener('appinstalled', handleAppInstalled)
    return () => window.removeEventListener('appinstalled', handleAppInstalled)
  }, [])

  async function installApp() {
    if (!installPrompt) return

    installPrompt.prompt()
    await installPrompt.userChoice

    setVisible(false)
    setInstallPrompt(null)
  }

  function closeBanner() {
    setVisible(false)
    const dismissUntil = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000
    localStorage.setItem(DISMISS_KEY, String(dismissUntil))
  }

  if (!visible || !installPrompt) return null

  return (
    <div className={styles.installCard}>
      <button
        className={styles.close}
        onClick={closeBanner}
        aria-label="Close"
      >
        ×
      </button>

      <div className={styles.content}>
        <strong>Install dowatch24</strong>
        <span>Add dowatch24 to your device for quick access.</span>
      </div>

      <button className={styles.installButton} onClick={installApp}>
        Install App
      </button>
    </div>
  )
}