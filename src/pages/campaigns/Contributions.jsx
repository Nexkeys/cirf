import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CircleCheck,
  CircleDollarSign,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  HandCoins,
  Hourglass,
  ListChecks,
  PieChart,
  Search,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../../auth/AuthContext.js'
import { Button } from '../../components/Button.jsx'
import { AppShell } from '../../components/dashboard/AppShell.jsx'
import { CampaignTabs } from '../../components/dashboard/CampaignTabs.jsx'
import { FormField } from '../../components/dashboard/FormField.jsx'
import { FundFlowChart } from '../../components/dashboard/FundFlowChart.jsx'
import { Modal } from '../../components/dashboard/Modal.jsx'
import { PageHeading } from '../../components/dashboard/PageHeading.jsx'
import { Pagination } from '../../components/dashboard/Pagination.jsx'
import { PaymentDonut } from '../../components/dashboard/PaymentDonut.jsx'
import { ProofUpload } from '../../components/dashboard/ProofUpload.jsx'
import { Pylons } from '../../components/dashboard/Pylons.jsx'
import { StatRow, StatTile } from '../../components/dashboard/StatTile.jsx'
import { StatusBadge } from '../../components/dashboard/StatusBadge.jsx'
import { FormAlert } from '../../components/FormAlert.jsx'
import { PageSkeleton, TableRows } from '../../components/Loading.jsx'
import { Photo } from '../../components/Photo.jsx'
import { useToast } from '../../components/ToastContext.js'
import { api } from '../../lib/api.js'
import { acceptsContributions, methodLabel } from '../../lib/campaigns.js'
import { saveCsv } from '../../lib/csv.js'
import { formatDate, formatNaira, initials } from '../../lib/format.js'
import { readablePhoto, sizedPhoto } from '../../lib/images.js'
import { useCampaignData } from '../../lib/useCampaignData.js'
import { usePaged } from '../../lib/usePaged.js'
import { usePageTitle } from '../../lib/usePageTitle.js'
import shared from './campaigns.module.css'
import styles from './Contributions.module.css'

const PAGE_SIZE = 8
const HOUSEHOLDS_PAGE_SIZE = 10

const STATUS = {
  verified: { label: 'Paid', className: 'paid' },
  pending: { label: 'Pending', className: 'pending' },
  rejected: { label: 'Rejected', className: 'rejected' },
}

const HOUSEHOLD_STATUS = {
  paid: { label: 'Paid', className: 'paid' },
  partial: { label: 'Part paid', className: 'partial' },
  pending: { label: 'Awaiting check', className: 'pending' },
  unpaid: { label: 'Not paid', className: 'rejected' },
}

// Admins can review contributions until the campaign is reconciled (the API's rule too).
const REVIEWABLE = ['fundraising', 'repairing', 'completed']

// Contributions, from Contributon-Screen.png. Everyone sees the totals, the trend and
// the contributions they're allowed to see (all of them for admins; verified ones plus
// their own for residents). Admins also verify or reject pending records here, and see
// each household's levy (the "Households" view, also opened by /contributors).
export default function Contributions({ view: startView = 'records' }) {
  const { id } = useParams()
  const { profile, estate } = useAuth()
  const isAdmin = profile.role === 'admin'
  const data = useCampaignData(id)
  const people = useResidents(isAdmin ? estate.id : null, id)
  const toast = useToast()
  const [view, setView] = useState(isAdmin ? startView : 'records')
  const [filter, setFilter] = useState('all')
  const [reviewing, setReviewing] = useState(null)
  const records = useRef(null)
  usePageTitle('Contributions')

  const heading = <PageHeading back={{ to: '/dashboard', label: 'Back to Dashboard' }} />

  if (data.status !== 'ready') {
    return (
      <AppShell heading={heading}>
        {data.status === 'loading' ? <PageSkeleton label="Please wait, loading contributions…" /> : <FormAlert>{data.message}</FormAlert>}
      </AppShell>
    )
  }

  const { campaign, overview, contributions } = data
  const verified = contributions.filter((c) => c.status === 'verified')
  const pending = contributions.filter((c) => c.status === 'pending')
  const average = verified.length ? Math.round(verified.reduce((sum, c) => sum + c.amount, 0) / verified.length) : 0
  const { paid, total } = overview.contributors
  const canReview = isAdmin && REVIEWABLE.includes(campaign.status)
  const phones = new Map((people.residents ?? []).map((person) => [person.id, person.phone]))

  const showRecords = (status) => {
    setView('records')
    setFilter(status)
    records.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const exportCsv = () => {
    saveCsv(
      `${campaign.title} - contributions.csv`,
      ['Date', 'Contributor', 'Unit', 'Amount (NGN)', 'Method', 'Reference', 'Status', 'Checked by', 'Reason'],
      contributions.map((c) => [
        c.paidAt ?? c.createdAt,
        c.userName,
        c.unitNumber ?? '',
        c.amount,
        methodLabel(c.method),
        c.reference ?? '',
        STATUS[c.status]?.label ?? c.status,
        c.verifiedByName ?? '',
        c.rejectionReason ?? '',
      ]),
    )
    toast.success('Contributions downloaded as a CSV file')
  }

  function reviewed(contribution, outcome) {
    setReviewing(null)
    toast.success(
      outcome === 'verified'
        ? `${formatNaira(contribution.amount)} from ${contribution.userName} verified`
        : `${formatNaira(contribution.amount)} from ${contribution.userName} rejected. They've been told why.`,
    )
    data.reload()
    people.reload()
  }

  return (
    <AppShell heading={heading}>
      <div className={styles.page}>
        <header className={styles.intro}>
          <h1 className={styles.title}>Contributions</h1>
          <p className={styles.subtitle}>
            {isAdmin
              ? 'Track and manage all contributions from your community members. See who has paid, who is pending, and the total amount collected.'
              : 'Every verified contribution to this campaign, plus your own records and where they stand.'}
          </p>
        </header>
        <CampaignTabs campaignId={id} />

        {canReview && pending.length > 0 && (
          <div className={styles.alert} role="status">
            <Hourglass aria-hidden="true" />
            <p>
              <strong>
                {pending.length} {pending.length === 1 ? 'contribution is' : 'contributions are'} waiting for you to verify.
              </strong>{' '}
              Check each one against the bank alert or receipt before it counts toward the fund.
            </p>
            <button type="button" className={styles.alertButton} onClick={() => showRecords('pending')}>
              Review now <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        )}

        <div className={styles.layout}>
          <div className={styles.main}>
            <StatRow>
              <StatTile
                icon={CircleDollarSign}
                label="Total Contributions"
                value={formatNaira(campaign.totalCollected)}
                note={`${Math.round(campaign.percentFunded)}% of the ${formatNaira(campaign.targetAmount)} target`}
              />
              <StatTile icon={Users} label="Total Contributors" value={`${paid} / ${total}`} note={`${total ? Math.round((paid / total) * 100) : 0}% have paid in full`} />
              <StatTile
                icon={BadgeCheck}
                label="Average Contribution"
                value={formatNaira(average)}
                note={verified.length ? `Across ${verified.length} verified ${verified.length === 1 ? 'payment' : 'payments'}` : 'No verified payments yet'}
              />
              <StatTile
                icon={Clock}
                label="Pending Contributions"
                value={campaign.pendingCount}
                note={campaign.pendingCount ? `${formatNaira(campaign.pendingAmount)} waiting to be checked` : 'Nothing waiting'}
                warn={campaign.pendingCount > 0}
              />
            </StatRow>

            <div className={styles.charts}>
              <TrendCard campaign={campaign} timeline={overview.timeline} />
              <section className={shared.card} aria-labelledby="status-title">
                <h2 id="status-title" className={`${shared.cardTitle} ${styles.cardTitle}`}>
                  <PieChart aria-hidden="true" /> Contribution Status
                </h2>
                <PaymentDonut counts={overview.contributors} center={{ value: formatNaira(campaign.totalCollected), label: 'Total Collected' }} />
                <p className={styles.chartNote}>Households by levy paid. Overdue means still owing after the deadline.</p>
              </section>
            </div>

            <section ref={records} className={`${shared.card} ${styles.records}`} aria-label="Contribution records">
              {isAdmin && (
                <div className={styles.viewTabs} role="tablist">
                  <button type="button" role="tab" aria-selected={view === 'records'} className={view === 'records' ? styles.activeView : ''} onClick={() => setView('records')}>
                    <HandCoins aria-hidden="true" /> Contributions
                  </button>
                  <button type="button" role="tab" aria-selected={view === 'households'} className={view === 'households' ? styles.activeView : ''} onClick={() => setView('households')}>
                    <Building2 aria-hidden="true" /> Households
                  </button>
                </div>
              )}
              {view === 'records' ? (
                <Records
                  contributions={contributions}
                  phones={phones}
                  isAdmin={isAdmin}
                  canReview={canReview}
                  filter={filter}
                  onFilter={setFilter}
                  onOpen={setReviewing}
                  onExport={exportCsv}
                  canContribute={acceptsContributions(campaign)}
                  campaignId={id}
                />
              ) : (
                <Households people={people} />
              )}
            </section>
          </div>

          <aside className={styles.side}>
            <CampaignCard campaign={campaign} estate={estate} />
            <section className={shared.card} aria-labelledby="quick-title">
              <h2 id="quick-title" className={`${shared.cardTitle} ${styles.cardTitle}`}>
                Quick Actions
              </h2>
              <div className={styles.actions}>
                {acceptsContributions(campaign) && (
                  <Action
                    icon={UserPlus}
                    title={isAdmin ? 'Add Contribution' : 'Make a Contribution'}
                    text={isAdmin ? 'Record money you collected' : 'Pay toward this repair'}
                    to={`/campaigns/${id}/contribute`}
                  />
                )}
                {canReview && pending.length > 0 && (
                  <Action icon={ListChecks} title={`Review Pending (${pending.length})`} text="Verify or reject each one" onClick={() => showRecords('pending')} />
                )}
                <Action icon={Eye} title="View Contribution List" text="See all contributions and status" onClick={() => showRecords('all')} />
                <Action icon={FileSpreadsheet} title="Export Report" text="Download contribution records (CSV)" onClick={exportCsv} />
              </div>
            </section>
            <div className={shared.encourage}>
              <strong>
                <ShieldCheck size={24} aria-hidden="true" /> Transparent. Accountable. Together.
              </strong>
              <p>Every contribution is tracked, verified and reconciled for your community.</p>
              <Pylons className={shared.pylons} />
            </div>
          </aside>
        </div>
      </div>

      {reviewing && (
        <ReviewDialog
          contribution={reviewing}
          phone={phones.get(reviewing.userId)}
          canReview={canReview}
          canAddProof={reviewing.status === 'pending' && (isAdmin || reviewing.userId === profile.id)}
          onClose={() => setReviewing(null)}
          onDone={reviewed}
          onProofSaved={(contribution) => {
            setReviewing(contribution)
            toast.success(isAdmin && contribution.userId !== profile.id ? 'Proof of payment saved' : 'Proof of payment saved. Your community lead can now check it.')
            data.reload()
          }}
        />
      )}
    </AppShell>
  )
}

// The estate's residents with each one's levy status (admins only).
function useResidents(estateId, campaignId) {
  const [state, setState] = useState({ status: estateId ? 'loading' : 'off' })
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    if (!estateId) return undefined
    let current = true
    api(`/estates/${estateId}/residents?campaignId=${campaignId}`)
      .then(({ residents }) => current && setState({ status: 'ready', residents }))
      .catch((error) => current && setState((shown) => (shown.status === 'ready' ? shown : { status: 'error', message: error.message })))
    return () => {
      current = false
    }
  }, [estateId, campaignId, reloads])

  return { ...state, reload: () => setReloads((count) => count + 1) }
}

const RANGES = [
  ['all', 'All Time'],
  ['28', 'Last 4 Weeks'],
  ['7', 'Last 7 Days'],
]

// Contribution Trends: the verified total by day against the pace needed to reach the
// target by the deadline (a flat target line when there's no deadline).
function TrendCard({ campaign, timeline }) {
  const [range, setRange] = useState('all')
  const opened = timeline[0]?.date
  const span = campaign.deadline && opened ? Math.max(Math.round((Date.parse(campaign.deadline) - Date.parse(opened)) / 86_400_000), 1) : null
  const pace = timeline.map((_, day) => (span ? Math.min(Math.round((campaign.targetAmount * day) / span), campaign.targetAmount) : campaign.targetAmount))
  const from = range === 'all' ? 0 : Math.max(timeline.length - Number(range), 0)

  return (
    <section className={shared.card} aria-labelledby="trend-title">
      <div className={styles.trendHead}>
        <h2 id="trend-title" className={`${shared.cardTitle} ${styles.cardTitle}`}>
          <TrendingUp aria-hidden="true" /> Contribution Trends
        </h2>
        <select value={range} onChange={(event) => setRange(event.target.value)} aria-label="Time range" className={styles.range}>
          {RANGES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {timeline.length ? (
        <FundFlowChart
          dates={timeline.slice(from).map((point) => point.date)}
          series={[
            { label: 'Total Collected', color: '#0b3d2c', values: timeline.slice(from).map((point) => point.total) },
            { label: span ? 'Target Pace' : 'Target', color: '#7cc9a0', values: pace.slice(from), dashed: true },
          ]}
        />
      ) : (
        <p className={styles.empty}>The trend starts once the campaign is published.</p>
      )}
    </section>
  )
}

function Records({ contributions, phones, isAdmin, canReview, filter, onFilter, onOpen, onExport, canContribute, campaignId }) {
  const [query, setQuery] = useState('')
  const text = query.trim().toLowerCase()
  const shown = contributions.filter(
    (c) =>
      (filter === 'all' || c.status === filter) &&
      (!text || [c.userName, c.unitNumber, c.reference, phones.get(c.userId), String(c.amount)].some((value) => value?.toLowerCase().includes(text))),
  )
  const paged = usePaged(shown, PAGE_SIZE, `${text}|${filter}`)

  return (
    <div>
      <div className={styles.recordHead}>
        <div>
          <h3>Recent Contributions</h3>
          <p>{isAdmin ? 'Latest contributions from your community members.' : 'Verified contributions, and your own records.'}</p>
        </div>
        <div className={styles.filters}>
          <label className={styles.search}>
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              placeholder={isAdmin ? 'Search by name, phone, reference…' : 'Search by name or reference…'}
              aria-label="Search contributions"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <select value={filter} onChange={(event) => onFilter(event.target.value)} aria-label="Status">
            <option value="all">All Statuses</option>
            <option value="verified">Paid</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
          <button type="button" className={styles.export} onClick={onExport}>
            <Download size={16} aria-hidden="true" /> Export
          </button>
        </div>
      </div>

      {contributions.length === 0 ? (
        <div className={styles.none}>
          <HandCoins aria-hidden="true" />
          <p>No contributions yet.</p>
          {canContribute && (
            <Link to={`/campaigns/${campaignId}/contribute`} className={styles.noneAction}>
              {isAdmin ? 'Add a contribution' : 'Make the first contribution'}
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Contributor</th>
                  <th scope="col">Unit</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Proof</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paged.rows.map((c) => {
                  const status = STATUS[c.status] ?? STATUS.pending
                  const when = c.paidAt ?? c.createdAt
                  const phone = phones.get(c.userId)
                  return (
                    <tr key={c.id}>
                      <td>
                        {formatDate(when)}
                        {c.createdAt && <small>{timeOf(c.createdAt)}</small>}
                      </td>
                      <td>
                        <span className={styles.person}>
                          <span className={styles.avatar} aria-hidden="true">
                            {initials(c.userName)}
                          </span>
                          <span>
                            {c.userName}
                            {phone && <small>{phone.replace(/^\+234/, '0')}</small>}
                          </span>
                        </span>
                      </td>
                      <td>{c.unitNumber ?? 'Not set'}</td>
                      <td className={styles.amount}>{formatNaira(c.amount)}</td>
                      <td className={styles.reference}>{c.reference || methodLabel(c.method)}</td>
                      <td>
                        {c.proofUrl ? (
                          <button type="button" className={styles.proofThumb} onClick={() => onOpen(c)} aria-label={`View ${c.userName}'s proof of payment`}>
                            <img src={readablePhoto(c.proofUrl, 120)} alt="" loading="lazy" />
                          </button>
                        ) : (
                          <span className={styles.noProofCell}>None</span>
                        )}
                      </td>
                      <td>
                        <span className={`${styles.pill} ${styles[status.className]}`}>{status.label}</span>
                      </td>
                      <td className={styles.rowAction}>
                        {canReview && c.status === 'pending' ? (
                          <button type="button" className={styles.review} onClick={() => onOpen(c)}>
                            Review
                          </button>
                        ) : (
                          <button type="button" className={styles.view} onClick={() => onOpen(c)} aria-label={`View ${c.userName}'s contribution`}>
                            <Eye size={17} aria-hidden="true" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {shown.length === 0 && <p className={styles.noMatch}>No contributions match.</p>}
          </div>
          <Pagination paged={paged} noun="contributions" />
        </>
      )}
    </div>
  )
}

const timeOf = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' })

function Households({ people }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const text = query.trim().toLowerCase()
  const residents = people.residents ?? []
  const shown = residents.filter(
    (person) =>
      person.payment &&
      (filter === 'all' || person.payment.status === filter) &&
      (!text || [person.name, person.unitNumber, person.phone].some((value) => value?.toLowerCase().includes(text))),
  )
  const paged = usePaged(shown, HOUSEHOLDS_PAGE_SIZE, `${text}|${filter}`)

  if (people.status === 'loading') return <TableRows />
  if (people.status === 'error') return <FormAlert>{people.message}</FormAlert>

  return (
    <div>
      <div className={styles.recordHead}>
        <div>
          <h3>Households</h3>
          <p>What each household owes toward this campaign and has paid so far.</p>
        </div>
        <div className={styles.filters}>
          <label className={styles.search}>
            <Search size={17} aria-hidden="true" />
            <input type="search" placeholder="Search by name, unit, phone…" aria-label="Search households" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Levy status">
            <option value="all">All Households</option>
            <option value="paid">Paid</option>
            <option value="partial">Part paid</option>
            <option value="pending">Awaiting check</option>
            <option value="unpaid">Not paid</option>
          </select>
        </div>
      </div>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Resident</th>
              <th scope="col">Unit</th>
              <th scope="col">Levy</th>
              <th scope="col">Paid</th>
              <th scope="col">Balance</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map((person) => {
              const status = HOUSEHOLD_STATUS[person.payment.status]
              return (
                <tr key={person.id}>
                  <td>
                    <span className={styles.person}>
                      <span className={styles.avatar} aria-hidden="true">
                        {initials(person.name)}
                      </span>
                      <span>
                        {person.name}
                        {person.phone && <small>{person.phone.replace(/^\+234/, '0')}</small>}
                      </span>
                    </span>
                  </td>
                  <td>
                    {person.unitNumber ?? 'Not set'}
                    {person.units > 1 && <small>{person.units} units</small>}
                  </td>
                  <td className={styles.amount}>{formatNaira(person.payment.expected)}</td>
                  <td className={styles.amount}>{formatNaira(person.payment.paid)}</td>
                  <td className={styles.amount}>{formatNaira(person.payment.balance)}</td>
                  <td>
                    <span className={`${styles.pill} ${styles[status.className]}`}>{status.label}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {shown.length === 0 && <p className={styles.noMatch}>No households match.</p>}
      </div>
      <Pagination paged={paged} noun="households" />
    </div>
  )
}

function CampaignCard({ campaign, estate }) {
  const percent = Math.min(Math.round(campaign.percentFunded), 100)
  return (
    <section className={`${shared.card} ${styles.campaign}`} aria-labelledby="campaign-card-title">
      <div className={styles.campaignTop}>
        <div className={styles.campaignPhoto}>
          {campaign.imageUrl ? <img src={sizedPhoto(campaign.imageUrl, 300)} alt="" /> : <Photo name="transformer" sizes="96px" />}
        </div>
        <div>
          <div className={styles.campaignTitleRow}>
            <h2 id="campaign-card-title">{campaign.title}</h2>
            <StatusBadge status={campaign.status} />
          </div>
          <p className={styles.estate}>
            <Users size={15} aria-hidden="true" /> {estate.name}
          </p>
        </div>
      </div>
      {campaign.description && <p className={styles.description}>{campaign.description}</p>}
      <div className={styles.funding}>
        <span>Funding Progress</span>
        <strong>{Math.round(campaign.percentFunded)}%</strong>
      </div>
      <div className={styles.bar} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Funding progress">
        <span style={{ width: `${percent}%` }} />
      </div>
      <dl className={styles.money}>
        <div>
          <dt>Collected</dt>
          <dd>{formatNaira(campaign.totalCollected)}</dd>
        </div>
        <div>
          <dt>Target</dt>
          <dd>{formatNaira(campaign.targetAmount)}</dd>
        </div>
      </dl>
      <Link to={`/campaigns/${campaign.id}`} className={styles.details}>
        View Campaign Details <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </section>
  )
}

function Action({ icon: Icon, title, text, to, onClick }) {
  const content = (
    <>
      <span className={styles.actionIcon} aria-hidden="true">
        <Icon />
      </span>
      <span>
        <strong>{title}</strong>
        {text}
      </span>
      <ArrowRight aria-hidden="true" className={styles.actionArrow} />
    </>
  )
  return to ? (
    <Link to={to} className={styles.action}>
      {content}
    </Link>
  ) : (
    <button type="button" className={styles.action} onClick={onClick}>
      {content}
    </button>
  )
}

// One contribution in full. For a pending one an admin can verify it, or reject it with
// a reason the resident will see.
function ReviewDialog({ contribution: c, phone, canReview, canAddProof, onClose, onDone, onProofSaved }) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  const pendingReview = canReview && c.status === 'pending'
  const status = STATUS[c.status] ?? STATUS.pending
  const [newProof, setNewProof] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [editingProof, setEditingProof] = useState(false)

  async function saveProof() {
    setBusy('proof')
    setError('')
    try {
      const { contribution } = await api(`/contributions/${c.id}/proof`, { method: 'PUT', body: { proofUrl: newProof } })
      setEditingProof(false)
      setNewProof(null)
      onProofSaved(contribution)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  async function decide(outcome) {
    if (outcome === 'rejected' && reason.trim().length < 3) {
      setError('Say why, so the resident knows what to fix (at least 3 characters).')
      return
    }
    setBusy(outcome)
    setError('')
    try {
      await api(`/contributions/${c.id}/verify`, {
        method: 'PUT',
        body: outcome === 'verified' ? { status: 'verified' } : { status: 'rejected', reason: reason.trim() },
      })
      onDone(c, outcome)
    } catch (err) {
      setError(err.fieldMessage?.('reason') ?? err.message)
      setBusy(null)
    }
  }

  return (
    <Modal
      title={pendingReview ? 'Review Contribution' : 'Contribution Details'}
      description={pendingReview ? 'Check this against your bank alert or the receipt before it counts toward the fund.' : undefined}
      onClose={onClose}
    >
      <div className={styles.dialog}>
        <div className={styles.dialogAmount}>
          <strong>{formatNaira(c.amount)}</strong>
          <span className={`${styles.pill} ${styles[status.className]}`}>{status.label}</span>
        </div>
        <dl className={styles.facts}>
          <Fact label="Contributor" value={c.userName} />
          {phone && <Fact label="Phone" value={phone.replace(/^\+234/, '0')} />}
          <Fact label="Unit" value={c.unitNumber ?? 'Not set'} />
          <Fact label="Method" value={methodLabel(c.method)} />
          <Fact label="Reference" value={c.reference || 'None given'} />
          <Fact label="Paid on" value={c.paidAt ? formatDate(c.paidAt) : 'Not given'} />
          <Fact label="Recorded" value={`${formatDate(c.createdAt)}${c.recordedByName && c.recordedByName !== c.userName ? ` by ${c.recordedByName}` : ''}`} />
          {c.status !== 'pending' && c.verifiedByName && (
            <Fact label={c.status === 'verified' ? 'Verified by' : 'Rejected by'} value={`${c.verifiedByName}, ${formatDate(c.verifiedAt)}`} />
          )}
          {c.note && <Fact label="Note" value={c.note} wide />}
          {c.rejectionReason && <Fact label="Reason" value={c.rejectionReason} wide />}
        </dl>

        {editingProof ? (
          <div className={styles.proofEdit}>
            <ProofUpload value={newProof} onChange={setNewProof} onBusy={setUploading} required />
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={shared.secondary}
                onClick={() => {
                  setEditingProof(false)
                  setNewProof(null)
                }}
                disabled={busy === 'proof'}
              >
                Cancel
              </button>
              <Button busy={busy === 'proof'} disabled={!newProof || uploading} onClick={saveProof}>
                Save Proof
              </Button>
            </div>
          </div>
        ) : c.proofUrl ? (
          <div className={styles.proofBox}>
            <a href={c.proofUrl} target="_blank" rel="noreferrer" className={styles.proof}>
              <img src={readablePhoto(c.proofUrl, 900)} alt={`Proof of payment from ${c.userName}`} />
              <span>Open full size</span>
            </a>
            {canAddProof && (
              <button type="button" className={styles.proofChange} onClick={() => setEditingProof(true)}>
                Replace proof
              </button>
            )}
          </div>
        ) : (
          <div className={styles.noProof}>
            <p>No proof of payment was attached.</p>
            {canAddProof && (
              <button type="button" className={styles.proofChange} onClick={() => setEditingProof(true)}>
                Add proof of payment
              </button>
            )}
          </div>
        )}

        {pendingReview && rejecting && (
          <FormField
            label="Why are you rejecting it?"
            as="textarea"
            rows={3}
            required
            placeholder="e.g. No transfer with this reference reached the account"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={300}
            counter={`${reason.length}/300`}
            hint={`${c.userName} will see this in their notifications.`}
          />
        )}

        {error && <FormAlert>{error}</FormAlert>}

        {pendingReview ? (
          <div className={styles.dialogActions}>
            {rejecting ? (
              <>
                <button type="button" className={shared.secondary} onClick={() => setRejecting(false)} disabled={Boolean(busy)}>
                  Back
                </button>
                <Button className={styles.danger} busy={busy === 'rejected'} onClick={() => decide('rejected')}>
                  <X size={17} aria-hidden="true" /> Reject Contribution
                </Button>
              </>
            ) : (
              <>
                <button type="button" className={`${shared.secondary} ${styles.rejectButton}`} onClick={() => setRejecting(true)} disabled={Boolean(busy)}>
                  <X size={17} aria-hidden="true" /> Reject
                </button>
                <Button busy={busy === 'verified'} onClick={() => decide('verified')}>
                  <CircleCheck size={17} aria-hidden="true" /> Verify Contribution
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className={styles.dialogActions}>
            <button type="button" className={shared.secondary} onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

function Fact({ label, value, wide = false }) {
  return (
    <div className={wide ? styles.wideFact : ''}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
