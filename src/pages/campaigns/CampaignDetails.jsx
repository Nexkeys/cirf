import {
  CalendarDays,
  CircleCheck,
  ClipboardCheck,
  Eye,
  FileText,
  HandCoins,
  Info,
  LayoutGrid,
  MapPin,
  Pencil,
  Scale,
  ShieldCheck,
  Tag,
  Target,
  Type,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../../auth/AuthContext.js'
import { Button } from '../../components/Button.jsx'
import { AppShell } from '../../components/dashboard/AppShell.jsx'
import { CampaignHeader } from '../../components/dashboard/CampaignHeader.jsx'
import { ContributionChart } from '../../components/dashboard/ContributionChart.jsx'
import { ContributionsTable } from '../../components/dashboard/ContributionsTable.jsx'
import { PageHeading } from '../../components/dashboard/PageHeading.jsx'
import { ProgressRing } from '../../components/dashboard/ProgressRing.jsx'
import { Pylons } from '../../components/dashboard/Pylons.jsx'
import { StatusBadge } from '../../components/dashboard/StatusBadge.jsx'
import { FormAlert } from '../../components/FormAlert.jsx'
import { api } from '../../lib/api.js'
import { acceptsContributions, categoryLabel } from '../../lib/campaigns.js'
import { formatDate, formatNaira } from '../../lib/format.js'
import { useCampaignData } from '../../lib/useCampaignData.js'
import { usePageTitle } from '../../lib/usePageTitle.js'
import shared from './campaigns.module.css'
import styles from './CampaignDetails.module.css'

const PHOTO_CAPTIONS = {
  draft: 'Draft Campaign',
  fundraising: 'Raising Funds',
  repairing: 'Campaign in Progress',
  completed: 'Repair Completed',
  reconciled: 'Fully Reconciled',
}

// Campaign Details, from Transfer-Repair-Campaign-Screen.png.
export default function CampaignDetails() {
  const { id } = useParams()
  const { profile, estate } = useAuth()
  const data = useCampaignData(id, { withQuotes: true })
  usePageTitle(data.campaign?.title ?? 'Campaign')

  const heading = <PageHeading back={{ to: '/campaigns', label: 'Back to Campaigns' }} />

  if (data.status !== 'ready') {
    return (
      <AppShell heading={heading}>
        {data.status === 'loading' ? <p className={shared.loading}>Loading the campaign…</p> : <FormAlert>{data.message}</FormAlert>}
      </AppShell>
    )
  }

  const { campaign, overview, contributions, quotes } = data
  const isAdmin = profile.role === 'admin'

  return (
    <AppShell heading={heading}>
      <div className={styles.page}>
        {campaign.status === 'draft' && <DraftBanner campaign={campaign} onPublished={data.reload} />}

        <CampaignHeader campaign={campaign} estate={estate} photo="right" photoCaption={PHOTO_CAPTIONS[campaign.status]} />

        <nav className={styles.tabs} aria-label="Campaign sections">
          <Link to={`/campaigns/${id}`} className={styles.activeTab} aria-current="page">
            <LayoutGrid aria-hidden="true" /> Overview
          </Link>
          <Link to={`/contributions?campaign=${id}`}>
            <HandCoins aria-hidden="true" /> Contributions
          </Link>
          <Link to={`/vendors?campaign=${id}`}>
            <ClipboardCheck aria-hidden="true" /> Vendor Quotes
          </Link>
          <Link to={`/reconciliation?campaign=${id}`}>
            <Scale aria-hidden="true" /> Reconciliation
          </Link>
          <Link to={`/reports?campaign=${id}`}>
            <FileText aria-hidden="true" /> Transparency Report
          </Link>
        </nav>

        <div className={styles.layout}>
          <div className={styles.main}>
            <section className={shared.card} aria-labelledby="progress-title">
              <h2 id="progress-title" className={`${shared.cardTitle} ${styles.cardTitle}`}>
                Campaign Progress
              </h2>
              <ProgressRing collected={campaign.totalCollected} target={campaign.targetAmount} />
              <div className={styles.miniStats}>
                <MiniStat icon={Users} label="Contributors" value={`${overview.contributors.paid} / ${overview.contributors.total}`} />
                <MiniStat icon={Target} label="Target Amount" value={formatNaira(campaign.targetAmount)} />
                <MiniStat icon={CalendarDays} label="Deadline" value={campaign.deadline ? formatDate(campaign.deadline) : 'Not set'} />
              </div>
            </section>

            <section className={shared.card} aria-labelledby="trend-title">
              <h2 id="trend-title" className={`${shared.cardTitle} ${styles.cardTitle}`}>
                Contribution Trend
              </h2>
              <ContributionChart timeline={overview.timeline} target={campaign.targetAmount} />
            </section>

            <CampaignFacts campaign={campaign} estate={estate} overview={overview} />

            <section className={shared.card} aria-labelledby="recent-title">
              <div className={shared.cardHead}>
                <h2 id="recent-title" className={shared.cardTitle}>
                  Recent Contributions
                </h2>
                <Link to={`/contributions?campaign=${id}`} className={shared.viewAll}>
                  View All
                </Link>
              </div>
              <p className={styles.paidBox}>
                <Users aria-hidden="true" />
                <span>
                  <strong>
                    {overview.contributors.paid} / {overview.contributors.total}
                  </strong>
                  Contributors have paid
                </span>
              </p>
              <ContributionsTable contributions={contributions} pageSize={8} />
            </section>
          </div>

          <aside className={styles.side}>
            <QuotesCard campaignId={id} quotes={quotes} selectedId={campaign.selectedQuoteId} />

            <section className={shared.card} aria-labelledby="actions-title">
              <h2 id="actions-title" className={`${shared.cardTitle} ${styles.cardTitle}`}>
                Quick Actions
              </h2>
              <div className={styles.quick}>
                {acceptsContributions(campaign) && (
                  <Link to={`/campaigns/${id}/contribute`}>
                    <UserPlus aria-hidden="true" />
                    {isAdmin ? 'Add Contribution' : 'Make a Contribution'}
                  </Link>
                )}
                {isAdmin && campaign.status !== 'reconciled' && campaign.status !== 'completed' && (
                  <Link to={`/vendors?campaign=${id}`}>
                    <ClipboardCheck aria-hidden="true" />
                    Add Vendor Quote
                  </Link>
                )}
                {isAdmin && campaign.status === 'repairing' && (
                  <Link to={`/reconciliation?campaign=${id}`}>
                    <CircleCheck aria-hidden="true" />
                    Mark Complete
                  </Link>
                )}
              </div>
              <Link to={`/reports?campaign=${id}`} className={styles.reportLink}>
                <Eye size={17} aria-hidden="true" /> View Transparency Report
              </Link>
            </section>

            <div className={shared.encourage}>
              <strong>
                <ShieldCheck size={24} aria-hidden="true" /> Transparency builds trust.
              </strong>
              <p>Every contribution, quote and update is tracked and visible to all members of your community.</p>
              <Pylons className={shared.pylons} />
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className={styles.miniStat}>
      <span className={styles.miniIcon} aria-hidden="true">
        <Icon />
      </span>
      <span>
        {label}
        <strong>{value}</strong>
      </span>
    </div>
  )
}

function CampaignFacts({ campaign, estate, overview }) {
  const levy =
    campaign.levyMethod === 'per_unit'
      ? `By Unit Count · ${formatNaira(campaign.levyPerUnit)} per unit`
      : `Flat Split · ${formatNaira(campaign.levyPerHousehold)}`
  const facts = [
    [Type, 'Title', campaign.title],
    [Tag, 'Category', categoryLabel(campaign.category)],
    [MapPin, 'Estate / Community', [estate?.name, estate?.address].filter(Boolean).join(', ')],
    [Target, 'Target Amount', formatNaira(campaign.targetAmount)],
    [HandCoins, 'Per-Household Levy', levy],
    [CalendarDays, 'Deadline', campaign.deadline ? formatDate(campaign.deadline) : 'Not set'],
  ]

  return (
    <section className={shared.card} aria-labelledby="facts-title">
      <div className={shared.cardHead}>
        <h2 id="facts-title" className={shared.cardTitle}>
          Campaign Details
        </h2>
        <StatusBadge status={campaign.status} />
      </div>
      <div className={styles.facts}>
        <dl className={styles.factList}>
          {facts.map(([Icon, label, value]) => (
            <div key={label}>
              <span className={styles.factIcon} aria-hidden="true">
                <Icon />
              </span>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className={styles.factSide}>
          <h3>Description</h3>
          <p>{campaign.description}</p>
          <h3>Progress Notes</h3>
          <p className={styles.progressNote}>
            <CircleCheck size={18} aria-hidden="true" />
            {progressNote(campaign, overview)}
          </p>
          <Link to={`/reports?campaign=${campaign.id}`} className={styles.fullDetails}>
            View Full Details <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}

// A one-line status report for the campaign, from what it's doing now.
function progressNote(campaign, overview) {
  const { paid, total } = overview.contributors
  switch (campaign.status) {
    case 'draft':
      return 'Draft: residents can’t see this campaign until it’s published.'
    case 'fundraising':
      return campaign.targetReachedAt
        ? `Target reached on ${formatDate(campaign.targetReachedAt)}. Next, choose a vendor.`
        : `Collecting contributions: ${paid} of ${total} households have paid in full.`
    case 'repairing':
      return `${campaign.selectedVendorName} was selected at ${formatNaira(campaign.selectedQuoteAmount)}. The repair is in progress.`
    case 'completed':
      return `Repair completed on ${formatDate(campaign.completedAt)}. The fund is being reconciled.`
    case 'reconciled':
      return `Reconciled on ${formatDate(campaign.reconciledAt)}. Every refund and balance has been worked out.`
    default:
      return ''
  }
}

function QuotesCard({ campaignId, quotes, selectedId }) {
  const [open, setOpen] = useState(null)
  const shown = [...quotes].sort((a, b) => (b.id === selectedId) - (a.id === selectedId)).slice(0, 3)

  return (
    <section className={shared.card} aria-labelledby="quotes-title">
      <div className={shared.cardHead}>
        <h2 id="quotes-title" className={shared.cardTitle}>
          <ClipboardCheck aria-hidden="true" /> Vendor Quotes
        </h2>
        <Link to={`/vendors?campaign=${campaignId}`} className={shared.viewAll}>
          View All
        </Link>
      </div>
      {shown.length === 0 && <p className={styles.noQuotes}>No vendor quotes yet.</p>}
      <ul className={styles.quotes}>
        {shown.map((quote) => (
          <li key={quote.id} className={styles.quote}>
            <span className={styles.quoteIcon} aria-hidden="true">
              <Wrench />
            </span>
            <div className={styles.quoteBody}>
              <p className={styles.vendor}>{quote.vendorName}</p>
              <p className={styles.quoteAmount}>{formatNaira(quote.quotedAmount)}</p>
              {quote.deliveryDays && (
                <p className={styles.delivery}>
                  Delivery Time <strong>{quote.deliveryDays} days</strong>
                </p>
              )}
              {open === quote.id && (
                <div className={styles.quoteMore}>
                  {quote.warrantyMonths != null && <p>Warranty: {quote.warrantyMonths} months</p>}
                  {quote.vendorPhone && <p>Phone: {quote.vendorPhone}</p>}
                  <p>{quote.notes || 'No notes added.'}</p>
                </div>
              )}
            </div>
            <div className={styles.quoteSide}>
              {quote.id === selectedId && <span className={styles.selected}>Selected</span>}
              <button
                type="button"
                className={styles.quoteToggle}
                aria-expanded={open === quote.id}
                onClick={() => setOpen(open === quote.id ? null : quote.id)}
              >
                {open === quote.id ? 'Hide Details' : 'View Details'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function DraftBanner({ campaign, onPublished }) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')

  async function publish() {
    setBusy(true)
    setProblem('')
    try {
      await api(`/campaigns/${campaign.id}/publish`, { method: 'POST' })
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
