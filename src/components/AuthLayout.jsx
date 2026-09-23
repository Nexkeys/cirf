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
//   header="back"     back arrow (to `backTo`, labelled `backLabel`), then the logo (Reset Password)
//   header="logo"     logo only (Check Your Email)
// Every version also has "Back to Home": a glass pill over the photo on phones, a plain
// link on wide screens. It sits above the header, or on the header row beside the back arrow.
export function AuthLayout({ header = 'tagline', backTo = '/signin', backLabel = 'Back to Sign In', className = '', children }) {
  const homeLink = (
    <Link to="/" className={`${styles.home} ${header === 'back' ? styles.homeInline : ''}`}>
      <ArrowLeft size={17} strokeWidth={2} aria-hidden="true" />
      Back to Home
    </Link>
  )

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
        {header !== 'back' && homeLink}
        <header className={`${styles.header} ${header === 'back' ? styles.withBack : ''}`}>
          {header === 'back' && (
            <Link to={backTo} className={styles.back} aria-label={backLabel} title={backLabel}>
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
          {/* Beside the back arrow, so the screen doesn't stack two "back" controls. */}
          {header === 'back' && homeLink}
        </header>
        <div className={styles.body}>{children}</div>
      </main>
    </div>
  )
}
