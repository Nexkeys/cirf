import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import styles from './AuthLayout.module.css'
import { HeroBackground } from './HeroBackground.jsx'
import { Logo } from './Logo.jsx'
import { WelcomeStory } from './WelcomeStory.jsx'

// The cream screens: Sign In, Create Account, Reset Password and Check Your Email.
// Phones get the design exactly. Wide screens add the Welcome photo panel on the left.
//   header="tagline"  logo on the left, "Community Infrastructure / Repair Fund Tracker" on the right
//   header="back"     back arrow, then the logo (Reset Password)
//   header="logo"     logo only (Check Your Email)
export function AuthLayout({ header = 'tagline', backTo = '/signin', className = '', children }) {
  return (
    <div className={styles.page}>
      <aside className={styles.panel} aria-hidden="true">
        <HeroBackground photo="skyline" />
        <div className={styles.panelInner}>
          <div className={styles.panelTop}>
            <Logo tone="splash" />
            <p className={styles.panelTagline}>
              Transparent Funds.
              <br />
              Stronger Communities.
            </p>
          </div>
          <WelcomeStory />
        </div>
      </aside>

      <main className={`${styles.main} ${className}`}>
        <header className={`${styles.header} ${header === 'back' ? styles.withBack : ''}`}>
          {header === 'back' && (
            <Link to={backTo} className={styles.back} aria-label="Back">
              <ArrowLeft size={22} strokeWidth={1.75} />
            </Link>
          )}
          <Link to="/" className={styles.logoLink}>
            <Logo />
          </Link>
          {header === 'tagline' && (
            <p className={styles.tagline}>
              Community Infrastructure
              <br />
              Repair Fund Tracker
            </p>
          )}
        </header>
        <div className={styles.body}>{children}</div>
      </main>
    </div>
  )
}
