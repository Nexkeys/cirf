import { Link } from 'react-router'
import { Logo } from '../Logo.jsx'
import { Photo } from '../Photo.jsx'
import styles from './PublicFooter.module.css'

// The dark footer under Home and About.
export function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Logo tone="splash" className={styles.logo} />
          <p className={styles.tagline}>
            Community Infrastructure
            <br />
            Repair Fund Tracker
          </p>
        </div>

        <nav className={styles.columns} aria-label="Footer">
          <div>
            <h2 className={styles.heading}>Product</h2>
            <ul className={styles.links}>
              <li>
                <Link to="/#how-it-works">How It Works</Link>
              </li>
              <li>
                <Link to="/#features">Features</Link>
              </li>
              <li>
                <Link to="/signin">Sign In</Link>
              </li>
              <li>
                <Link to="/welcome">Get Started</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className={styles.heading}>Company</h2>
            <ul className={styles.links}>
              <li>
                <Link to="/about">About</Link>
              </li>
              <li>
                <Link to="/guide">User Guide</Link>
              </li>
            </ul>
          </div>
        </nav>

        <div className={styles.note}>
          <Photo name="evening-street" sizes="120px" className={styles.notePhoto} />
          <p>CIRF: giving Nigerian communities a fair, transparent way to fund and track their own infrastructure repairs.</p>
        </div>

        <p className={styles.copyright}>© {new Date().getFullYear()} CIRF. All rights reserved.</p>
      </div>
    </footer>
  )
}
