import { Info, Pencil, Phone, Wrench } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../../auth/AuthContext.js'
import { Button } from '../../components/Button.jsx'
import { AppShell } from '../../components/dashboard/AppShell.jsx'
import { CampaignHeader } from '../../components/dashboard/CampaignHeader.jsx'
import { CampaignTabs } from '../../components/dashboard/CampaignTabs.jsx'
import { ContributionsTable } from '../../components/dashboard/ContributionsTable.jsx'
import { NextStep } from '../../components/dashboard/NextStep.jsx'
import { PageHeading } from '../../components/dashboard/PageHeading.jsx'
import { FormAlert } from '../../components/FormAlert.jsx'
import { PageSkeleton } from '../../components/Loading.jsx'
import { useToast } from '../../components/ToastContext.js'
import { api } from '../../lib/api.js'
import { categoryLabel } from '../../lib/campaigns.js'
import { formatDate, formatNaira } from '../../lib/format.js'
import { useCampaignData } from '../../lib/useCampaignData.js'
import { usePageTitle } from '../../lib/usePageTitle.js'
import shared from './campaigns.module.css'
import styles from './CampaignDetails.module.css'

// How many of the newest payments the page shows. The Contributions tab has the rest.
const LATEST = 5

// Campaign Details: one campaign at a glance. The header carries the money figures, so
// the page below only answers three questions: what happens next, what is this repair,
// and who has paid lately.
export default function CampaignDetails() {
  const { id } = useParams()
  const { profile, estate } = useAuth()
  const data = useCampaignData(id, { withQuotes: true })
  usePageTitle(data.campaign?.title ?? 'Campaign')

  const heading = <PageHeading back={{ to: '/campaigns', label: 'Back to Campaigns' }} />

  if (data.status !== 'ready') {
    return (
      <AppShell heading={heading}>
        {data.status === 'loading' ? <PageSkeleton layout="detail" label="Please wait, loading the campaign…" /> : <FormAlert>{data.message}</FormAlert>}
      </AppShell>
    )
  }

  const { campaign, overview, contributions, quotes } = data
  const isAdmin = profile.role === 'admin'
  const pending = contributions.filter((contribution) => contribution.status === 'pending').length
  const { paid, total } = overview.contributors

  return (
    <AppShell heading={heading}>
      <div className={styles.page}>
        {campaign.status === 'draft' && <DraftBanner campaign={campaign} onPublished={data.reload} />}

        <CampaignHeader campaign={campaign} estate={estate} />

        <CampaignTabs campaignId={id} />

        {campaign.status !== 'draft' && <NextStep campaign={campaign} isAdmin={isAdmin} pending={isAdmin ? pending : 0} />}

        <div className={styles.columns}>
          <AboutRepair campaign={campaign} />
          <VendorCard campaign={campaign} quotes={quotes} />
        </div>

        <section className={shared.card} aria-labelledby="recent-title">
          <div className={shared.cardHead}>
            <div>
              <h2 id="recent-title" className={shared.cardTitle}>
                Latest payments
              </h2>
              <p className={shared.cardText}>
                {paid} of {total} households have paid in full.
              </p>
            </div>
            <Link to={`/campaigns/${id}/contributions`} className={shared.secondary}>
              See all payments
            </Link>
          </div>
          <ContributionsTable contributions={contributions.slice(0, LATEST)} />
        </section>
      </div>
    </AppShell>
  )
}

// What the repair is, what each household pays, and by when.
function AboutRepair({ campaign }) {
  const levy =
    campaign.levyMethod === 'per_unit'
      ? `${formatNaira(campaign.levyPerUnit)} for each unit`
      : `${formatNaira(campaign.levyPerHousehold)} per household`
  const facts = [
    ['What it’s for', categoryLabel(campaign.category)],
    ['Each household pays', levy],
    ['Deadline', campaign.deadline ? formatDate(campaign.deadline) : 'Not set'],
  ]

  return (
    <section className={shared.card} aria-labelledby="about-title">
      <h2 id="about-title" className={shared.cardTitle}>
        About this repair
      </h2>
      {campaign.description && <p className={styles.description}>{campaign.description}</p>}
      <dl className={styles.facts}>
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// The chosen vendor, or how many quotes are in while none is chosen.
function VendorCard({ campaign, quotes }) {
  const chosen = quotes.find((quote) => quote.id === campaign.selectedQuoteId)
  const count = `${quotes.length} ${quotes.length === 1 ? 'quote' : 'quotes'} received`

  return (
    <section className={shared.card} aria-labelledby="vendor-title">
      <h2 id="vendor-title" className={shared.cardTitle}>
        {chosen ? 'Chosen vendor' : 'Vendor'}
      </h2>
      {chosen ? (
        <div className={styles.vendor}>
          <span className={styles.vendorIcon} aria-hidden="true">
            <Wrench />
          </span>
          <div>
            <p className={styles.vendorName}>{chosen.vendorName}</p>
            <p className={styles.vendorAmount}>{formatNaira(chosen.quotedAmount)}</p>
            {chosen.deliveryDays && <p className={styles.vendorMeta}>Says the work takes {chosen.deliveryDays} days</p>}
            {chosen.vendorPhone && (
              <p className={styles.vendorMeta}>
                <Phone size={16} aria-hidden="true" /> {chosen.vendorPhone}
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className={styles.noVendor}>No vendor has been chosen yet.</p>
      )}
      <p className={styles.quoteCount}>
        {count}.{' '}
        <Link to={`/campaigns/${campaign.id}/quotes`} className={shared.viewAll}>
          {quotes.length ? 'Compare quotes' : 'Go to quotes'}
        </Link>
      </p>
    </section>
  )
}

// Shown on a draft to admins: publishing makes it visible to residents and opens
// contributions.
function DraftBanner({ campaign, onPublished }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')

  async function publish() {
    setBusy(true)
    setProblem('')
    try {
      await api(`/campaigns/${campaign.id}/publish`, { method: 'POST' })
      toast.success('Campaign published. Residents can now see it and contribute.')
      onPublished()
    } catch (error) {
      setProblem(error.message)
      setBusy(false)
    }
  }

  return (
    <div className={styles.draft}>
      <p className={shared.note}>
        <span className={shared.noteIcon} aria-hidden="true">
          <Info />
        </span>
        This campaign is a draft. Residents can’t see it or contribute until you publish it.
      </p>
      {problem && <FormAlert>{problem}</FormAlert>}
      <div className={styles.draftActions}>
        <Link to={`/campaigns/${campaign.id}/edit`} className={shared.secondary}>
          <Pencil size={16} aria-hidden="true" /> Continue Editing
        </Link>
        <Button arrow busy={busy} onClick={publish} className={styles.publish}>
          Publish Campaign
        </Button>
      </div>
    </div>
  )
}
