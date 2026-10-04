import Hero from './components/Hero.jsx'
import React, { useState } from 'react'
import Movies from './pages/Movies.jsx'
import TV from './pages/TV.jsx'
import styles from './App.module.css'

function clearMovieSession() {
  ['mv_query', 'mv_player'].forEach(k => sessionStorage.removeItem(k))
}

export default function App() {
  const [tab, setTab] = useState(() => sessionStorage.getItem('cs_tab') || 'movies')
  const [homeKey, setHomeKey] = useState(0)

  function goTab(t) {
    setTab(t)
    sessionStorage.setItem('cs_tab', t)
  }

  function goHome() {
    clearMovieSession()
    setTab('movies')
    sessionStorage.setItem('cs_tab', 'movies')
    setHomeKey(k => k + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <button className={styles.logo} onClick={goHome} aria-label="Go to home">
          <span className={styles.logoAccent}>Dowatch</span><span className={styles.logoDot}>·</span>24
        </button>
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
            TV Series
          </button>
        </nav>
      </header>

      <main className={styles.main}>
  <Hero />

  {tab === 'movies'
    ? <Movies key={homeKey} />
    : <TV />
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
    </div>
  )
}
