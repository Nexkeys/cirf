import { ArrowRight, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router'
import { useAuth } from '../../auth/AuthContext.js'
import { Logo } from '../Logo.jsx'
import styles from './PublicHeader.module.css'

const LINKS = [
  { to: '/#how-it-works', label: 'How It Works' },
  { to: '/#features', label: 'Features' },
  { to: '/about', label: 'About' },
]

// The top of Home and About. `tone` is "dark" over a photo (white text) or "light" over
// the cream About hero. Signed-in people get a way back to their dashboard instead of
// Sign In and Get Started.
export function PublicHeader({ tone = 'dark' }) {
  const { status } = useAuth()
  const [open, setOpen] = useState(false)
  const signedIn = status === 'ready'
  const close = () => setOpen(false)

  return (
    <header className={`${styles.header} ${styles[tone]} ${open ? styles.open : ''}`}>
      <div className={styles.bar}>
        <Link to="/" className={styles.logo} onClick={close}>
          <Logo tone={tone === 'dark' ? 'splash' : 'light'} />
        </Link>

        <nav className={styles.nav} id="site-menu" aria-label="Main">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end
              onClick={close}
              className={({ isActive }) => `${styles.link} ${isActive && link.to === '/about' ? styles.current : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
          {!signedIn && (
            <Link to="/signin" className={styles.link} onClick={close}>
              Sign In
            </Link>
          )}
          <Link to={signedIn ? '/dashboard' : '/welcome'} className={`${styles.cta} ${styles.menuCta}`} onClick={close}>
            {signedIn ? 'Go to Dashboard' : 'Get Started'} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </nav>

        <Link to={signedIn ? '/dashboard' : '/welcome'} className={`${styles.cta} ${styles.barCta}`}>
          {signedIn ? 'Go to Dashboard' : 'Get Started'} <ArrowRight size={16} aria-hidden="true" />
        </Link>

        <button
          type="button"
          className={styles.menuButton}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="site-menu"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
    </header>
  )
}
