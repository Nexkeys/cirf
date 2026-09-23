import { ArrowRight, Banknote, FileText, HandCoins, Plus, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext.js'
import { AppShell } from '../components/dashboard/AppShell.jsx'
import { CampaignHero } from '../components/dashboard/CampaignHero.jsx'
import { ContributionChart } from '../components/dashboard/ContributionChart.jsx'
import { PaymentDonut } from '../components/dashboard/PaymentDonut.jsx'
import { FormAlert } from '../components/FormAlert.jsx'
import { LoadingNote } from '../components/Loading.jsx'
import { api } from '../lib/api.js'
import { pickFeatured } from '../lib/campaigns.js'
import { firstName, formatNaira, greeting } from '../lib/format.js'
import { usePageTitle } from '../lib/usePageTitle.js'
import { useVisibleInterval } from '../lib/useVisibleInterval.js'
import styles from './Dashboard.module.css'

// How often to check the featured campaign for new money. /progress costs one read.
const POLL_MS = 15_000

// Everything the Overview shows, as the next screen state.
async function loadOverview() {
  const { campaigns } = await api('/campaigns')
  const campaign = pickFeatured(campaigns)
  if (!campaign) return { status: 'empty' }

  const { overview } = await api(`/campaigns/${campaign.id}/overview`)
  return { status: 'ready', campaign, overview }
}

export default function Dashboard() {
  usePageTitle('Overview')
  const { profile, estate } = useAuth()
  const [state, setState] = useState({ status: 'loading' })
  const [reloads, setReloads] = useState(0)
  const reload = () => setReloads((count) => count + 1)
  const lastChange = useRef(null)

  useEffect(() => {
    let current = true // only the newest load may update the screen
    loadOverview()
      .then((next) => {
        if (!current) return
        lastChange.current = next.campaign?.updatedAt ?? null
        setState(next)
      })
      .catch((error) => {
        // A failed refresh keeps what's on screen; only a failed first load shows the error.
        if (current) setState((shown) => (shown.status === 'ready' ? shown : { status: 'error', message: error.message }))
      })
    return () => {
      current = false
    }
  }, [reloads])

  // Reload everything only when the campaign has actually changed since the last load.
  const campaignId = state.campaign?.id
  useVisibleInterval(
    async () => {
      const { progress } = await api(`/campaigns/${campaignId}/progress`).catch(() => ({}))
      if (progress && progress.updatedAt !== lastChange.current) reload()
    },
    POLL_MS,
    Boolean(campaignId),
  )

  const heading = (
    <>
      <h1 className={styles.greeting}>
        {greeting()},{' '}
        <span className={styles.nowrap}>
          {firstName(profile.name)} <span aria-hidden="true">👋</span>
        </span>
      </h1>
      <p className={styles.subtitle}>Here&apos;s what&apos;s happening with your community&apos;s repair fund.</p>
    </>
  )

  return (
    <AppShell heading={heading}>
      {state.status === 'loading' && <Skeleton />}
      {state.status === 'error' && (
        <div className={styles.problem}>
          <FormAlert>{state.message}</FormAlert>
          <button type="button" className={styles.retry} onClick={reload}>
            Try again
          </button>
        </div>
      )}
      {state.status === 'empty' && <NoCampaigns isAdmin={profile.role === 'admin'} />}
      {state.status === 'ready' && <Overview campaign={state.campaign} overview={state.overview} estate={estate} />}
    </AppShell>
  )
}

function Overview({ campaign, overview, estate }) {
  const { contributors, estimate } = overview
  const paidPercent = contributors.total ? Math.round((contributors.paid / contributors.total) * 100) : 0

  return (
    <div className={styles.layout}>
      <CampaignHero campaign={campaign} estate={estate} />

      <div className={styles.stats}>
        <StatCard
          icon={Users}
          label="Total Contributors"
          value={
            <>
              {contributors.paid} <span className={styles.of}>/ {contributors.total}</span>
            </>
          }
          note={`${paidPercent}% have paid`}
        >
          <div className={styles.miniBar} aria-hidden="true">
            <span style={{ width: `${paidPercent}%` }} />
          </div>
        </StatCard>
        <StatCard
          icon={HandCoins}
          label="Total Contributions"
          value={formatNaira(campaign.totalCollected)}
          note={overview.collectedThisWeek ? `+ ${formatNaira(overview.collectedThisWeek)} this week` : 'Nothing new this week'}
          quiet={!overview.collectedThisWeek}
        />
        <StatCard
          icon={FileText}
          label="Vendor Quotes"
          value={overview.quotes.count}
          note={quoteNote(overview.quotes)}
          quiet={!overview.quotes.selected}
        />
        <RefundCard estimate={estimate} />
      </div>

      <div className={styles.charts}>
        <section className={styles.card} aria-labelledby="progress-title">
          <h2 id="progress-title" className={styles.cardTitle}>
            Contribution Progress
          </h2>
          <ContributionChart timeline={overview.timeline} target={campaign.targetAmount} />
        </section>
        <section className={styles.card} aria-labelledby="status-title">
          <h2 id="status-title" className={styles.cardTitle}>
            Payment Status
          </h2>
          <div className={styles.donutBox}>
            <PaymentDonut counts={contributors} />
          </div>
          <Link to={`/campaigns/${campaign.id}/contributors`} className={styles.more}>
            View all contributors <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, note, quiet = false, danger = false, children }) {
  return (
    <section className={styles.stat}>
      <span className={styles.statIcon} aria-hidden="true">
        <Icon />
      </span>
      <h2 className={styles.statLabel}>{label}</h2>
      <p className={styles.statValue}>{value}</p>
      <p className={`${styles.statNote} ${quiet ? styles.quiet : ''} ${danger ? styles.danger : ''}`}>{note}</p>
      {children}
    </section>
  )
}

// Collected minus the repair cost: a refund when positive, a shortfall when negative.
function RefundCard({ estimate }) {
  if (!estimate) {
    return <StatCard icon={Banknote} label="Estimated Refund" value="₦0" note="(once a quote is selected)" quiet />
  }
  const shortfall = estimate.difference < 0
  const prefix = estimate.basis === 'actual' ? '' : 'Estimated '
  return (
    <StatCard
      icon={Banknote}
      label={`${prefix}${shortfall ? 'Shortfall' : 'Refund'}`}
      value={formatNaira(Math.abs(estimate.difference))}
      note={estimate.basis === 'actual' ? '(actual repair cost)' : '(after repair)'}
      danger={shortfall}
    />
  )
}

function quoteNote({ count, selected }) {
  if (selected) return '1 selected'
  return count ? 'None selected yet' : 'No quotes yet'
}

function NoCampaigns({ isAdmin }) {
  return (
    <section className={styles.empty}>
      <span className={styles.statIcon} aria-hidden="true">
        <HandCoins />
      </span>
      <h2 className={styles.emptyTitle}>{isAdmin ? 'Start your first repair campaign' : 'No repair campaigns yet'}</h2>
      <p className={styles.emptyText}>
        {isAdmin
          ? 'Set the repair, the target amount and the levy. Residents see the campaign and can start contributing as soon as you publish it.'
          : "When your community lead starts a repair campaign, you'll see its progress here and can make your contribution."}
      </p>
      {isAdmin && (
        <Link to="/campaigns/new" className={styles.emptyAction}>
          <Plus size={18} aria-hidden="true" /> Create Campaign
        </Link>
      )}
    </section>
  )
}

function Skeleton() {
  return (
    <div className={styles.layout} aria-busy="true">
      <LoadingNote>Please wait, loading your dashboard…</LoadingNote>
      <div className={`${styles.shimmer} ${styles.heroSkeleton}`} />
      <div className={styles.stats}>
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className={`${styles.shimmer} ${styles.statSkeleton}`} />
        ))}
      </div>
      <div className={styles.charts}>
        <div className={`${styles.shimmer} ${styles.chartSkeleton}`} />
        <div className={`${styles.shimmer} ${styles.chartSkeleton}`} />
      </div>
    </div>
  )
}
