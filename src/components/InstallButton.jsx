import { useEffect, useState } from 'react'
import styles from './InstallButton.module.css'
import InstallButton from './components/InstallButton.jsx'

export default function InstallButton() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault()

      setInstallPrompt(event)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      )
    }
  }, [])

  async function installApp() {
    if (!installPrompt) return

    installPrompt.prompt()

    const result = await installPrompt.userChoice

    if (result.outcome === 'accepted') {
      setVisible(false)
      setInstallPrompt(null)
    }
  }

  function closeBanner() {
    setVisible(false)
  }

  if (!visible || !installPrompt) return null

  return (
    <div className={styles.installCard}>
      <InstallButton />
      <button
        className={styles.close}
        onClick={closeBanner}
        aria-label="Close install prompt"
      >
        ×
      </button>

      <div className={styles.icon}>▶</div>

      <div className={styles.content}>
        <strong>Install dowatch24</strong>
        <span>Get quick access without opening your browser.</span>
      </div>

      <button className={styles.installButton} onClick={installApp}>
        Install App
      </button>
    </div>
  )
}