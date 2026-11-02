// Sends events through the GA4 tag set up in index.html (no second tag or config here)
export function trackEvent(name, params) {
  window.gtag?.('event', name, params)
}

const standaloneQuery = window.matchMedia('(display-mode: standalone)')

function isPwa() {
  return standaloneQuery.matches || window.navigator.standalone === true
}

// Once per launch: reloading the app doesn't count as opening it again
function trackPwaOpen() {
  try {
    if (sessionStorage.getItem('dw_pwa_open_sent')) return
    sessionStorage.setItem('dw_pwa_open_sent', '1')

    // First launch stands in for an install on iPhone, which has no install event
    const firstLaunch = !localStorage.getItem('dw_pwa_launched')
    localStorage.setItem('dw_pwa_launched', '1')
    trackEvent('pwa_open', { first_launch: firstLaunch })
  } catch {
    trackEvent('pwa_open')
  }
}

export function initPwaTracking() {
  if (isPwa()) trackPwaOpen()

  // Chrome can move the open tab into the app window right after installing
  standaloneQuery.addEventListener?.('change', event => {
    if (!event.matches) return
    window.gtag?.('set', 'user_properties', { app_mode: 'pwa' })
    trackPwaOpen()
  })
}
