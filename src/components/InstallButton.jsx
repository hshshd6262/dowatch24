import { useEffect, useState } from 'react'
import styles from './InstallButton.module.css'

export default function InstallButton() {
  const [installPrompt, setInstallPrompt] = useState(null)

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  async function installApp() {
    if (!installPrompt) return

    installPrompt.prompt()

    const result = await installPrompt.userChoice

    if (result.outcome === 'accepted') {
      setInstallPrompt(null)
    }
  }

  if (!installPrompt) return null

  return (
    <button className={styles.installButton} onClick={installApp}>
      <span>＋</span>
      Install
    </button>
  )
}