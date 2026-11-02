// Live share counts in a Firebase Realtime Database (REST + streaming, no SDK).
// Without VITE_SHARES_DB_URL the count just stays at its starting number.
const DB = (import.meta.env.VITE_SHARES_DB_URL || '').replace(/\/+$/, '')
const DAY_MS = 24 * 60 * 60 * 1000

const countUrl = key => `${DB}/shares/${key}.json`

// Calls back with the stored count now and every time anyone adds a share
export function subscribeShares(key, onCount) {
  if (!DB) return () => {}
  const source = new EventSource(countUrl(key))
  source.addEventListener('put', event => {
    const { data } = JSON.parse(event.data)
    onCount(typeof data === 'number' ? data : 0)
  })
  source.addEventListener('cancel', () => source.close())
  return () => source.close()
}

// The database rules only accept "current value + 1", so a write that loses
// a race with another visitor is rejected and retried with the new value
export async function addShare(key) {
  if (!DB) return false
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(countUrl(key))
    if (!res.ok) return false
    const current = (await res.json()) || 0
    const put = await fetch(countUrl(key), { method: 'PUT', body: JSON.stringify(current + 1) })
    if (put.ok) return true
    await new Promise(r => setTimeout(r, 100 + Math.random() * 300 * (attempt + 1)))
  }
  return false
}

// One count per title, per platform, per browser, per day
export function claimShare(key, platform) {
  try {
    const name = `dw_shared_${key}_${platform}`
    if (Date.now() < Number(localStorage.getItem(name) || 0)) return false
    localStorage.setItem(name, String(Date.now() + DAY_MS))
  } catch {}
  return true
}

export function releaseShare(key, platform) {
  try { localStorage.removeItem(`dw_shared_${key}_${platform}`) } catch {}
}

export const liveSharesEnabled = Boolean(DB)
