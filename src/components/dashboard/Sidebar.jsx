import { BadgeCheck, Coins, FileText, House, LogOut, Scale, Settings, Store, X } from 'lucide-react'
import { NavLink } from 'react-router'
import { useAuth } from '../../auth/AuthContext.js'
import sidebarPhoto from '../../assets/images/poles-street-800.webp'
import { Logo } from '../Logo.jsx'
import styles from './Sidebar.module.css'

const MAIN_LINKS = [
  { to: '/dashboard', label: 'Overview', icon: House },
  { to: '/campaigns', label: 'Campaigns', icon: BadgeCheck },
  { to: '/contributions', label: 'Contributions', icon: Coins },
  { to: '/vendors', label: 'Vendors & Quotes', icon: Store },
  { to: '/reconciliation', label: 'Reconciliation', icon: Scale },
  { to: '/reports', label: 'Transparency Report', icon: FileText },
]

export function Sidebar({ open, onClose }) {
  const { signOut } = useAuth()

  return (
    <>
      <div className={`${styles.backdrop} ${open ? styles.show : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`${styles.sidebar} ${open ? styles.open : ''}`} aria-label="Main menu">
        <div className={styles.top}>
          <Logo tone="splash" className={styles.logo} />
          <button type="button" className={styles.close} aria-label="Close menu" onClick={onClose}>
            <X size={22} />
          </button>
        </div>

        <nav className={styles.nav}>
          <ul className={styles.list}>
            {MAIN_LINKS.map((link) => (
              <li key={link.to}>
                <Item {...link} onClick={onClose} />
              </li>
            ))}
          </ul>
          <ul className={`${styles.list} ${styles.secondary}`}>
            <li>
              <Item to="/settings" label="Settings" icon={Settings} onClick={onClose} />
            </li>
            <li>
              <button type="button" className={styles.link} onClick={signOut}>
                <LogOut className={styles.icon} aria-hidden="true" />
                Log Out
              </button>
            </li>
          </ul>
        </nav>

        <div className={styles.promo}>
          <img src={sidebarPhoto} alt="" className={styles.promoPhoto} />
          <p className={styles.promoTitle}>Building Stronger Communities Together</p>
          <p className={styles.promoText}>Fair levies. Transparent process. Lasting infrastructure.</p>
        </div>
      </aside>
    </>
  )
}

// Links close the phone drawer as they're followed.
function Item({ to, label, icon: Icon, onClick }) {
  return (
    <NavLink to={to} onClick={onClick} className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}>
      <Icon className={styles.icon} aria-hidden="true" />
      {label}
    </NavLink>
  )
}
