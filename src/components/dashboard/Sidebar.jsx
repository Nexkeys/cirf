import { BadgeCheck, CirclePlus, Coins, FileText, House, LogOut, Scale, Settings, Store, X } from 'lucide-react'
import { Link, useLocation } from 'react-router'
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

// Sidebar links that open one section of a campaign (see CampaignSection).
const SECTION_OF = { '/contributions': 'contributions', '/vendors': 'quotes', '/reconciliation': 'reconciliation', '/reports': 'report' }

// Whether a sidebar link is the current page. A campaign's sections light up their own
// link (Vendors & Quotes on /campaigns/:id/quotes); its other pages light up Campaigns.
function isCurrent(to, pathname) {
  const section = pathname.match(/^\/campaigns\/[^/]+\/([^/]+)/)?.[1]
  if (SECTION_OF[to]) return pathname.startsWith(to) || section === SECTION_OF[to]
  if (to === '/campaigns') {
    return pathname.startsWith('/campaigns') && pathname !== '/campaigns/new' && !Object.values(SECTION_OF).includes(section)
  }
  return pathname === to || pathname.startsWith(`${to}/`)
}

// Links close the phone drawer as they're followed.
function Item({ to, label, icon: Icon, onClick }) {
  const { pathname } = useLocation()
  const current = isCurrent(to, pathname)
  return (
    <Link to={to} onClick={onClick} className={`${styles.link} ${current ? styles.active : ''}`} aria-current={current ? 'page' : undefined}>
      <Icon className={styles.icon} aria-hidden="true" />
      {label}
    </Link>
  )
}
