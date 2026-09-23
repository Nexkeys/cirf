import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import styles from './AuthLayout.module.css'
import { HeroBackground } from './HeroBackground.jsx'
import { Logo } from './Logo.jsx'
import { Photo } from './Photo.jsx'
import { WelcomeStory } from './WelcomeStory.jsx'

// The form screens: Sign In, Create Account, Reset Password, Check Your Email and the
// account status page. On phones the photo fills the screen and the form sits on a
// frosted card over it. Wide screens show the photo panel with the welcome story on the
// left and the form on the cream right-hand side.
//   header="tagline"  logo on the left, "Community Infrastructure / Repair Fund Tracker" on the right
//   header="back"     back arrow, then the logo (Reset Password)
//   header="logo"     logo only (Check Your Email)
export function AuthLayout({ header = 'tagline', backTo = '/signin', className = '', children }) {
  return (
    <div className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true">
        <Photo name="skyline" sizes="100vw" priority className={styles.backdropPhoto} />
      </div>

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
          <Link to="/" className={styles.logoLink} aria-label="CIRF home">
            <Logo tone="splash" />
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
