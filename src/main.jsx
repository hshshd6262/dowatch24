import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initPwaTracking } from './lib/analytics.js'

initPwaTracking()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Clean up the old push-notification service worker for visitors who turned it on
navigator.serviceWorker?.getRegistrations().then(regs => {
  regs.filter(r => r.scope.includes('firebase-cloud-messaging-push-scope')).forEach(r => r.unregister())
}).catch(() => {})

// Offline page for the app / installed site (see public/sw.js)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
