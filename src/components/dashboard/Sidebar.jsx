import { BadgeCheck, CirclePlus, Coins, FileText, House, LogOut, Scale, Settings, Store, X } from 'lucide-react'
import { NavLink, useLocation } from 'react-router'
import { useAuth } from '../../auth/AuthContext.js'
import sidebarPhoto from '../../assets/images/poles-street-800.webp'
import { Logo } from '../Logo.jsx'
import styles from './Sidebar.module.css'

const MAIN_LINKS = [
  { to: '/dashboard', label: 'Overview', icon: House },
  { to: '/campaigns', label: 'Campaigns', icon: BadgeCheck },
  { to: '/campaigns/new', label: 'Create Campaign', icon: CirclePlus, adminOnly: true },
  { to: '/contributions', label: 'Contributions', icon: Coins },
  { to: '/vendors', label: 'Vendors & Quotes', icon: Store },
  { to: '/reconciliation', label: 'Reconciliation', icon: Scale },
  { to: '/reports', label: 'Transparency Report', icon: FileText },
]

export function Sidebar({ open, onClose }) {
  const { signOut, profile } = useAuth()
  const links = MAIN_LINKS.filter((link) => !link.adminOnly || profile?.role === 'admin')

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
            {links.map((link) => (
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

// Links close the phone drawer as they're followed. Campaigns stays highlighted on a
// campaign's own pages, but not on Create Campaign, which has its own link.
function Item({ to, label, icon: Icon, onClick }) {
  const { pathname } = useLocation()
  const highlighted = (isActive) => isActive && !(to === '/campaigns' && pathname === '/campaigns/new')
  return (
    <NavLink to={to} end={to === '/campaigns/new'} onClick={onClick} className={({ isActive }) => `${styles.link} ${highlighted(isActive) ? styles.active : ''}`}>
      <Icon className={styles.icon} aria-hidden="true" />
      {label}
    </NavLink>
  )
}
