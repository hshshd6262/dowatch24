import InstallButton from './components/InstallButton.jsx'
import Hero from './components/Hero.jsx'
import SharePopup from './components/SharePopup.jsx'
import AdBanner from './components/AdBanner.jsx'
import React, { useState } from 'react'
import Movies from './pages/Movies.jsx'
import TV from './pages/TV.jsx'
import styles from './App.module.css'

function clearMovieSession() {
  ['search_query', 'mv_player', 'mv_details'].forEach(k => sessionStorage.removeItem(k))
}

export default function App() {
  const [tab, setTab] = useState(() => sessionStorage.getItem('cs_tab') || 'movies')
  const [homeKey, setHomeKey] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [playRequest, setPlayRequest] = useState(null)

  function goTab(t) {
    setTab(t)
    setPlayRequest(null)
    sessionStorage.setItem('cs_tab', t)
  }

  function goHome() {
    clearMovieSession()
    setTab('movies')
    setPlayRequest(null)
    sessionStorage.setItem('cs_tab', 'movies')
    setHomeKey(k => k + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Open a title in its own tab; autoplay starts movies straight away
  function openItem(item, autoplay = false) {
    const mediaType = item.mediaType || item.media_type
    const t = mediaType === 'movie' ? 'movies' : 'tv'
    setTab(t)
    sessionStorage.setItem('cs_tab', t)
    setPlayRequest({ item: { ...item, mediaType }, autoplay, nonce: Date.now() })
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <button className={styles.logo} onClick={goHome} aria-label="Go to home">
          <span className={styles.logoAccent}>Dowatch</span><span className={styles.logoDot}>·</span>24
        </button>
        <div className={styles.navGroup}>
          <nav className={styles.tabs}>
            <button
              className={`${styles.tab} ${tab === 'movies' ? styles.active : ''}`}
              onClick={() => goTab('movies')}
            >
              Movies
            </button>
            <button
              className={`${styles.tab} ${tab === 'tv' ? styles.active : ''}`}
              onClick={() => goTab('tv')}
            >
              TV<span className={styles.tabLong}> Series</span>
            </button>
          </nav>
          <button
            className={`${styles.searchToggle} ${searchOpen ? styles.searchToggleOn : ''}`}
            onClick={() => setSearchOpen(o => !o)}
            aria-label={searchOpen ? 'Close search' : 'Open search'}
            aria-pressed={searchOpen}
          >
            {searchOpen ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            )}
          </button>
        </div>
      </header>

      <main className={styles.main}>
  <AdBanner />
  <Hero onPlay={item => openItem(item, true)} />

  {tab === 'movies'
    ? <Movies key={homeKey} showSearch={searchOpen} playRequest={playRequest} onOpen={openItem} />
    : <TV showSearch={searchOpen} playRequest={playRequest} onOpen={openItem} />
  }
</main>

      <footer className={styles.footer}>
  <p className={styles.footerText}>
    dowatch24 does not store any files on our server, we only link to the
    media which is hosted on 3rd party services.
  </p>

  <p className={styles.footerText}>
    © dowatch24
  </p>
</footer>
<InstallButton />
<SharePopup />
    </div>
  )
}
