// New name so the community popup also shows to people who closed the old share popup
const COOKIE = 'dw_community_hide'
const WEEK = 7 * 24 * 60 * 60

export function shareHidden() {
  return document.cookie.split('; ').some(c => c.startsWith(`${COOKIE}=`))
}

// Closing the popup or joining hides it for 7 days
export function hideShareForAWeek() {
  document.cookie = `${COOKIE}=1; max-age=${WEEK}; path=/; SameSite=Lax`
}

// Called when someone opens a movie / TV show
export function requestSharePopup() {
  if (!shareHidden()) window.dispatchEvent(new Event('dw:share'))
}
