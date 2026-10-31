import { BadgeCheck, Coins, FileText, House, LogOut, Settings, X } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { useAuth } from '../../auth/AuthContext.js'
import { Logo } from '../Logo.jsx'
import styles from './Sidebar.module.css'

// Kept short on purpose: four places to go. Vendor Quotes and Reconciliation are tabs
// inside each campaign, and Create Campaign is a button on the Campaigns screen.
const MAIN_LINKS = [
  { to: '/dashboard', label: 'Home', icon: House },
  { to: '/campaigns', label: 'Campaigns', icon: BadgeCheck },
  { to: '/contributions', label: 'Contributions', icon: Coins },
  { to: '/reports', label: 'Report', icon: FileText },
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

      </aside>
    </>
  )
}

// Sidebar links that open one section of a campaign (see CampaignSection).
const SECTION_OF = { '/contributions': 'contributions', '/reports': 'report' }

// Whether a sidebar link is the current page. A campaign's sections light up their own
// link (Report on /campaigns/:id/report); its other pages light up Campaigns.
function isCurrent(to, pathname) {
  const section = pathname.match(/^\/campaigns\/[^/]+\/([^/]+)/)?.[1]
  if (SECTION_OF[to]) return pathname.startsWith(to) || section === SECTION_OF[to]
  if (to === '/campaigns') {
    return pathname.startsWith('/campaigns') && !Object.values(SECTION_OF).includes(section)
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
