// How to install Dowatch24 on this device:
// Android → download the APK, iPhone → Add to Home Screen, computer → install the web app.
import { platform } from './push.js'

export const APK_URL = '/download/Dowatch24.apk'

const ua = navigator.userAgent
export const isAndroid = /Android/i.test(ua)
export const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)

// Already running as the Android app or an installed web app? Then there's nothing to install.
export function isInstalled() {
  return platform() === 'android-app' ||
    window.matchMedia?.('(display-mode: standalone)').matches ||
    navigator.standalone === true
}

export function installKind() {
  if (isAndroid) return 'apk'
  if (isIOS) return 'ios'
  return 'web'
}

// Keep the browser's own install offer (desktop Chrome / Edge) for our button
let deferred = null
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e })
window.addEventListener('appinstalled', () => { deferred = null })

export const canInstallWeb = () => Boolean(deferred)

export async function installWeb() {
  if (!deferred) return 'unavailable'
  deferred.prompt()
  const { outcome } = await deferred.userChoice
  deferred = null
  return outcome
}

// Latest Android app (public/app-version.json): version, size, what's new. Loaded once.
let versionPromise = null
export function getAppVersion() {
  if (!versionPromise) {
    versionPromise = fetch(`/app-version.json?t=${Date.now()}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null)
  }
  return versionPromise
}

// Download link that always points at the newest APK (never an old cached copy)
export const apkUrl = info => (info?.versionCode ? `${APK_URL}?v=${info.versionCode}` : APK_URL)
