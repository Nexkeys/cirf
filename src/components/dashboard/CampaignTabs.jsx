import { ClipboardCheck, FileText, HandCoins, LayoutGrid, Scale } from 'lucide-react'
import { NavLink } from 'react-router'
import styles from './CampaignTabs.module.css'

// The sections of one campaign, as tabs under its header.
const CAMPAIGN_SECTIONS = [
  { path: '', label: 'Overview', icon: LayoutGrid },
  { path: 'contributions', label: 'Contributions', icon: HandCoins },
  { path: 'quotes', label: 'Vendor Quotes', icon: ClipboardCheck },
  { path: 'reconciliation', label: 'Reconciliation', icon: Scale },
  { path: 'report', label: 'Transparency Report', icon: FileText },
]

export function CampaignTabs({ campaignId }) {
  return (
    <nav className={styles.tabs} aria-label="Campaign sections">
      {CAMPAIGN_SECTIONS.map(({ path, label, icon: Icon }) => (
        <NavLink
          key={label}
          to={path ? `/campaigns/${campaignId}/${path}` : `/campaigns/${campaignId}`}
          end
          className={({ isActive }) => (isActive ? styles.active : '')}
        >
          <Icon aria-hidden="true" /> {label}
        </NavLink>
      ))}
    </nav>
  )
}
