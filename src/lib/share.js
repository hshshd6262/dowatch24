const COOKIE = 'dw_share_hide'
const WEEK = 7 * 24 * 60 * 60

export function shareHidden() {
  return document.cookie.split('; ').some(c => c.startsWith(`${COOKIE}=`))
}

// Any interaction with the popup (close, share, copy) hides it for 7 days
export function hideShareForAWeek() {
  document.cookie = `${COOKIE}=1; max-age=${WEEK}; path=/; SameSite=Lax`
}

// Called when someone opens a movie / TV show
export function requestSharePopup() {
  if (!shareHidden()) window.dispatchEvent(new Event('dw:share'))
}
