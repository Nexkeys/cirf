import { CalendarDays, HandCoins, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/AuthContext.js'
import { AppShell } from '../../components/dashboard/AppShell.jsx'
import { PageHeading } from '../../components/dashboard/PageHeading.jsx'
import { StatusBadge } from '../../components/dashboard/StatusBadge.jsx'
import { FormAlert } from '../../components/FormAlert.jsx'
import { api } from '../../lib/api.js'
import { categoryLabel } from '../../lib/campaigns.js'
import { formatDate, formatNaira } from '../../lib/format.js'
import { sizedPhoto } from '../../lib/images.js'
import { usePageTitle } from '../../lib/usePageTitle.js'
import shared from './campaigns.module.css'
import styles from './CampaignsList.module.css'

const FILTERS = [
  { key: 'all', label: 'All', statuses: null },
  { key: 'active', label: 'Active', statuses: ['fundraising', 'repairing'] },
  { key: 'draft', label: 'Drafts', statuses: ['draft'], adminOnly: true },
  { key: 'done', label: 'Completed', statuses: ['completed', 'reconciled'] },
]

// Every campaign in the estate. Residents never see drafts (the API leaves them out).
export default function CampaignsList() {
  usePageTitle('Campaigns')
  const { profile } = useAuth()
  const isAdmin = profile.role === 'admin'
  const [state, setState] = useState({ status: 'loading' })
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    let current = true
    api('/campaigns')
      .then(({ campaigns }) => current && setState({ status: 'ready', campaigns }))
      .catch((error) => current && setState({ status: 'error', message: error.message }))
    return () => {
      current = false
    }
  }, [])

  const filters = FILTERS.filter((option) => isAdmin || !option.adminOnly)
  const statuses = filters.find((option) => option.key === filter)?.statuses
  const campaigns = state.campaigns?.filter((campaign) => !statuses || statuses.includes(campaign.status)) ?? []

  const heading = (
    <div className={styles.heading}>
      <PageHeading title="Campaigns" subtitle="Every repair your estate is raising money for." />
      {isAdmin && (
        <Link to="/campaigns/new" className={styles.create}>
          <Plus size={18} aria-hidden="true" /> Create Campaign
        </Link>
      )}
    </div>
  )

  return (
    <AppShell heading={heading}>
      <div className={styles.page}>
        <div className={styles.filters} role="tablist" aria-label="Filter campaigns">
          {filters.map((option) => (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={filter === option.key}
              className={filter === option.key ? styles.activeFilter : ''}
              onClick={() => setFilter(option.key)}
            >
              {option.label}
              {state.campaigns && (
                <span>{state.campaigns.filter((campaign) => !option.statuses || option.statuses.includes(campaign.status)).length}</span>
              )}
            </button>
          ))}
        </div>

        {state.status === 'loading' && <p className={shared.loading}>Loading campaigns…</p>}
        {state.status === 'error' && <FormAlert>{state.message}</FormAlert>}
        {state.status === 'ready' && campaigns.length === 0 && (
          <section className={`${shared.card} ${styles.empty}`}>
            <HandCoins aria-hidden="true" />
            <h2>{filter === 'all' ? 'No campaigns yet' : 'Nothing here'}</h2>
            <p>
              {isAdmin
                ? 'Start a campaign for the next repair your estate needs. Residents see it once you publish it.'
                : 'When your community lead starts a repair campaign, it will appear here.'}
            </p>
            {isAdmin && filter === 'all' && (
              <Link to="/campaigns/new" className={styles.create}>
                <Plus size={18} aria-hidden="true" /> Create Campaign
              </Link>
            )}
          </section>
        )}

        <ul className={styles.grid}>
          {campaigns.map((campaign) => (
            <li key={campaign.id}>
              <CampaignCard campaign={campaign} isAdmin={isAdmin} />
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  )
}

function CampaignCard({ campaign, isAdmin }) {
  const percent = Math.round(campaign.percentFunded)
  const mine = campaign.myPayment

  return (
    <Link to={`/campaigns/${campaign.id}`} className={styles.card}>
      <div className={styles.photo}>
        <img src={sizedPhoto(campaign.imageUrl, 600)} alt="" loading="lazy" />
        <StatusBadge status={campaign.status} className={styles.badge} />
      </div>
      <div className={styles.body}>
        <p className={styles.category}>{categoryLabel(campaign.category)}</p>
        <h2 className={styles.title}>{campaign.title}</h2>
        <div className={styles.bar} aria-hidden="true">
          <span style={{ width: `${Math.min(percent, 100)}%` }} />
        </div>
        <p className={styles.figures}>
          <strong>{formatNaira(campaign.totalCollected)}</strong> of {formatNaira(campaign.targetAmount)}
          <span>{percent}%</span>
        </p>
        <p className={styles.meta}>
          <CalendarDays size={15} aria-hidden="true" />
          {campaign.deadline ? `Deadline ${formatDate(campaign.deadline)}` : 'No deadline'}
        </p>
        {!isAdmin && mine && campaign.status !== 'draft' && (
          <p className={`${styles.mine} ${mine.balance === 0 ? styles.paid : ''}`}>
            {mine.balance === 0 ? 'You’ve paid your levy' : `You owe ${formatNaira(mine.balance)}`}
          </p>
        )}
      </div>
    </Link>
  )
}
