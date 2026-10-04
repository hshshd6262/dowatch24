import { useEffect, useState } from 'react'
import styles from './InstallButton.module.css'

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

    // Show the card after the page loads.
    // The actual Install button only works when Chrome provides the prompt.
    const timer = setTimeout(() => {
      if (!window.matchMedia('(display-mode: standalone)').matches) {
        setVisible(true)
      }
    }, 1500)

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      )
      clearTimeout(timer)
    }
  }, [])

  async function installApp() {
    if (!installPrompt) {
      alert('Use Chrome’s Install button in the address bar to install dowatch24.')
      return
    }

    installPrompt.prompt()

    const result = await installPrompt.userChoice

    if (result.outcome === 'accepted') {
      setVisible(false)
      setInstallPrompt(null)
    }
  }

  if (!visible) return null

  return (
    <div className={styles.installCard}>
      <button
        className={styles.close}
        onClick={() => setVisible(false)}
        aria-label="Close"
      >
        ×
      </button>

      <div className={styles.icon}>▶</div>

      <div className={styles.content}>
        <strong>Install dowatch24</strong>
        <span>Get quick access from your desktop.</span>
      </div>

      <button className={styles.installButton} onClick={installApp}>
        Install App
      </button>
    </div>
  )
}