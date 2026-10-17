import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Clean up the old push-notification service worker for visitors who turned it on
navigator.serviceWorker?.getRegistrations().then(regs => {
  regs.filter(r => r.scope.includes('firebase-cloud-messaging-push-scope')).forEach(r => r.unregister())
}).catch(() => {})
