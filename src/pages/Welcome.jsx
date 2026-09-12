import { Link } from 'react-router'
import { Button } from '../components/Button.jsx'
import { HeroBackground } from '../components/HeroBackground.jsx'
import { Logo } from '../components/Logo.jsx'
import { WelcomeStory } from '../components/WelcomeStory.jsx'
import { usePageTitle } from '../lib/usePageTitle.js'
import styles from './Welcome.module.css'

// Welcome: the introduction someone sees after tapping Get Started on Home.
export default function Welcome() {
  usePageTitle('Welcome')

  return (
    <div className={styles.page}>
      <HeroBackground photo="skyline" />

      <header className={styles.header}>
        <Link to="/" className={styles.logoLink}>
          <Logo tone="splash" />
        </Link>
        <p className={styles.tagline}>
          Transparent Funds.
          <br />
          Stronger Communities.
        </p>
      </header>

      <main className={styles.content}>
        <WelcomeStory isPageHeading />
        <Button variant="glass" arrow to="/signup" className={styles.cta}>
          Get Started
        </Button>
      </main>
    </div>
  )
}
