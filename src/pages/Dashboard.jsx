import { ArrowRight, Banknote, HandCoins, Plus, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext.js'
import { AppShell } from '../components/dashboard/AppShell.jsx'
import { CampaignHero } from '../components/dashboard/CampaignHero.jsx'
import { NextStep } from '../components/dashboard/NextStep.jsx'
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

// Home: the featured campaign, what to do next, and three numbers in plain words.
// It loads once, then keeps itself up to date with the cheap /progress check below.
// This page is effectively the main landing screen after login and shows the estate's current fund status.
export default function Dashboard() {
  usePageTitle('Home')
  const { profile, estate } = useAuth()
  const [state, setState] = useState({ status: 'loading' })
  const [reloads, setReloads] = useState(0)
  // Bumping this number re-runs the load effect below.
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
  // This avoids unnecessary refreshes while still keeping the overview data fresh.
  const campaignId = state.campaign?.id
  useVisibleInterval(
    async () => {
      const { progress } = await api(`/campaigns/${campaignId}/progress`).catch(() => ({}))
      if (progress && progress.updatedAt !== lastChange.current) reload()
    },
    POLL_MS,
    Boolean(campaignId),
  )

  // This JSX block builds the custom header shown at the top of the dashboard.
  // It personalizes the page for the current user by saying good morning/afternoon/evening
  // and then using only the first name from their profile.
  const heading = (
    <>
      <h1 className={styles.greeting}>
        {greeting()},{' '}
        <span className={styles.nowrap}>
          {firstName(profile.name)} <span aria-hidden="true">👋</span>
        </span>
      </h1>
      <p className={styles.subtitle}>Here&apos;s how your community&apos;s repair fund is doing.</p>
    </>
  )

  // This return block decides what the dashboard screen should show at any moment.
  // `AppShell` creates the overall dashboard layout, and the inner content changes based on the
  // current data state: loading, error, no campaign, or ready with campaign data.
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
      {state.status === 'ready' && (
        <Overview campaign={state.campaign} overview={state.overview} estate={estate} isAdmin={profile.role === 'admin'} />
      )}
    </AppShell>
  )
}

// Home once there's a campaign to show.
function Overview({ campaign, overview, estate, isAdmin }) {
  const { contributors, estimate } = overview
  const paidPercent = contributors.total ? Math.round((contributors.paid / contributors.total) * 100) : 0

  return (
    <div className={styles.layout}>
      <CampaignHero campaign={campaign} estate={estate} />

      <NextStep campaign={campaign} isAdmin={isAdmin} />

      <div className={styles.stats}>
        <StatCard
          icon={Users}
          label="Households that have paid"
          value={
            <>
              {contributors.paid} <span className={styles.of}>of {contributors.total}</span>
            </>
          }
        >
          <div className={styles.miniBar} aria-hidden="true">
            <span style={{ width: `${paidPercent}%` }} />
          </div>
          <Link to={`/campaigns/${campaign.id}/contributors`} className={styles.more}>
            See who has paid <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </StatCard>
        <StatCard
          icon={HandCoins}
          label="Money in this week"
          value={formatNaira(overview.collectedThisWeek)}
          note={overview.collectedThisWeek ? 'Checked and added to the fund' : 'No new payments this week'}
        />
        <LeftOverCard estimate={estimate} />
      </div>
    </div>
  )
}

// One of the three cards under the campaign.
function StatCard({ icon: Icon, label, value, note, danger = false, children }) {
  return (
    <section className={styles.stat}>
      <span className={styles.statIcon} aria-hidden="true">
        <Icon />
      </span>
      <h2 className={styles.statLabel}>{label}</h2>
      <p className={styles.statValue}>{value}</p>
      {note && <p className={`${styles.statNote} ${danger ? styles.danger : ''}`}>{note}</p>}
      {children}
    </section>
  )
}

// Collected minus the repair cost: money left over when positive, money still needed
// when negative.
function LeftOverCard({ estimate }) {
  if (!estimate) {
    return <StatCard icon={Banknote} label="Money left after the repair" value="Not known yet" note="We’ll know once a vendor is chosen" />
  }
  const short = estimate.difference < 0
  const actual = estimate.basis === 'actual'
  return (
    <StatCard
      icon={Banknote}
      label={short ? 'Money still needed' : 'Money left after the repair'}
      value={formatNaira(Math.abs(estimate.difference))}
      note={actual ? 'Using what the repair really cost' : 'Using the chosen vendor’s price'}
      danger={short}
    />
  )
}

// Shown until the estate has a published campaign (leads also get a Create button).
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

// Grey placeholders shaped like the Overview while it loads.
function Skeleton() {
  return (
    <div className={styles.layout} aria-busy="true">
      <LoadingNote>Please wait, loading your dashboard…</LoadingNote>
      <div className={`${styles.shimmer} ${styles.heroSkeleton}`} />
      <div className={styles.stats}>
        {[1, 2, 3].map((key) => (
          <div key={key} className={`${styles.shimmer} ${styles.statSkeleton}`} />
        ))}
      </div>
    </div>
  )
}
