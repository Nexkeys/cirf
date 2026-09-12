import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext.js'
import { Button } from '../components/Button.jsx'
import { FeatureList } from '../components/FeatureList.jsx'
import { HeroBackground } from '../components/HeroBackground.jsx'
import { Logo } from '../components/Logo.jsx'
import { usePageTitle } from '../lib/usePageTitle.js'
import styles from './Home.module.css'

// Home: the photo hero from the auth screen designs. The rest of the landing page
// (HOME-PAGE-DESIGN.png) gets built below this later.
export default function Home() {
  usePageTitle(null)
  const { status } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const signedIn = status === 'ready'

  return (
    <div className={styles.page}>
      <HeroBackground photo="street" />

      <header className={styles.header}>
        <Link to="/" className={styles.logoLink}>
          <Logo tone="white" />
        </Link>
        <button
          type="button"
          className={styles.menuButton}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="home-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={26} strokeWidth={1.75} /> : <Menu size={26} strokeWidth={1.75} />}
        </button>
        {menuOpen && (
          <nav id="home-menu" className={styles.menu}>
            {signedIn ? (
              <Link to="/account">My Account</Link>
            ) : (
              <>
                <Link to="/signin">Sign In</Link>
                <Link to="/signup">Create Account</Link>
              </>
            )}
          </nav>
        )}
      </header>

      <main className={styles.content}>
        <h1 className={styles.heading}>
          Stronger
          <br />
          Communities
          <br />
          Through
          <br />
          <span className={styles.accent}>Transparency</span>
        </h1>
        <p className={styles.intro}>
          Track contributions. Verify repair costs.
          <br />
          Reconcile funds. Build trust.
        </p>
        <Button variant="bright" arrow to={signedIn ? '/account' : '/welcome'} className={styles.cta}>
          Get Started
        </Button>
        <div className={styles.features}>
          <FeatureList />
        </div>
      </main>
    </div>
  )
}
