import { ArrowRight, BadgeCheck, Building2, CircleCheck, Clock, Download, Eye, HandCoins, Hourglass, Search, TrendingUp, Users, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../../auth/AuthContext.js'
import { Button } from '../../components/Button.jsx'
import { AppShell } from '../../components/dashboard/AppShell.jsx'
import { CampaignHeader } from '../../components/dashboard/CampaignHeader.jsx'
import { CampaignTabs } from '../../components/dashboard/CampaignTabs.jsx'
import { FormField } from '../../components/dashboard/FormField.jsx'
import { FundFlowChart } from '../../components/dashboard/FundFlowChart.jsx'
import { Modal } from '../../components/dashboard/Modal.jsx'
import { PageHeading } from '../../components/dashboard/PageHeading.jsx'
import { Pagination } from '../../components/dashboard/Pagination.jsx'
import { ProofUpload } from '../../components/dashboard/ProofUpload.jsx'
import { StatRow, StatTile } from '../../components/dashboard/StatTile.jsx'
import { FormAlert } from '../../components/FormAlert.jsx'
import { PageSkeleton, TableRows } from '../../components/Loading.jsx'
import { useToast } from '../../components/ToastContext.js'
import { api } from '../../lib/api.js'
import { acceptsContributions, methodLabel } from '../../lib/campaigns.js'
import { saveCsv } from '../../lib/csv.js'
import { formatDate, formatNaira, initials } from '../../lib/format.js'
import { readablePhoto } from '../../lib/images.js'
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

// Contributions. Everyone sees how many households have paid, the trend and the
// payments they're allowed to see (all of them for admins; verified ones plus
// their own for residents). Admins also verify or reject pending records here, and see
// each household's levy (the "Households" view, also opened by /contributors).
// This page is the contribution management center: it shows totals, handles verification, and
// gives admins the full record of who has paid and who still owes.
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

  const heading = <PageHeading back={{ to: '/dashboard', label: 'Back to Home' }} />

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
  const { paid, total } = overview.contributors
  const canReview = isAdmin && REVIEWABLE.includes(campaign.status)
  // Contributions don't store phone numbers, so admins get them from the residents list.
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

  // After a verify or reject: close the dialog, confirm it, and reload the figures.
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
        <CampaignHeader campaign={campaign} estate={estate} />
        <CampaignTabs campaignId={id} />

        {canReview && pending.length > 0 && (
          <div className={styles.alert} role="status">
            <Hourglass aria-hidden="true" />
            <p>
              <strong>
                {pending.length} {pending.length === 1 ? 'payment is' : 'payments are'} waiting for you to check.
              </strong>{' '}
              Check each one against the bank alert or receipt before it counts toward the fund.
            </p>
            <button type="button" className={styles.alertButton} onClick={() => showRecords('pending')}>
              Check now <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        )}

        <div className={shared.toolbar}>
          {acceptsContributions(campaign) && (isAdmin || campaign.myPayment?.balance !== 0) && (
            <Link to={`/campaigns/${id}/contribute`} className={shared.primary}>
              {isAdmin ? 'Record a payment' : 'Pay my levy'} <ArrowRight size={20} aria-hidden="true" />
            </Link>
          )}
          <button type="button" className={shared.secondary} onClick={exportCsv}>
            <Download size={18} aria-hidden="true" /> Download the list
          </button>
        </div>

        <StatRow>
          <StatTile icon={Users} label="Households paid in full" value={`${paid} of ${total}`} />
          <StatTile icon={BadgeCheck} label="Payments checked" value={verified.length} />
          <StatTile
            icon={Clock}
            label="Waiting to be checked"
            value={campaign.pendingCount}
            note={campaign.pendingCount ? `${formatNaira(campaign.pendingAmount)} in total` : undefined}
            warn={campaign.pendingCount > 0}
          />
        </StatRow>

        <section ref={records} className={`${shared.card} ${styles.records}`} aria-label="Contribution records">
          {isAdmin && (
            <div className={styles.viewTabs} role="tablist">
              <button type="button" role="tab" aria-selected={view === 'records'} className={view === 'records' ? styles.activeView : ''} onClick={() => setView('records')}>
                <HandCoins aria-hidden="true" /> Payments
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
              canContribute={acceptsContributions(campaign)}
              campaignId={id}
            />
          ) : (
            <Households people={people} />
          )}
        </section>

        <TrendCard campaign={campaign} timeline={overview.timeline} />
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
          <TrendingUp aria-hidden="true" /> Money collected over time
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

// The Contributions tab: search (name, unit, reference, phone, amount), a status filter,
// and the table. Admins get Review on pending rows; everyone else gets a view button.
function Records({ contributions, phones, isAdmin, canReview, filter, onFilter, onOpen, canContribute, campaignId }) {
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
          <h3>All payments</h3>
          <p>{isAdmin ? 'Newest first. Press Check on a payment to approve it.' : 'Checked payments, and your own.'}</p>
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
            <option value="all">All payments</option>
            <option value="verified">Paid</option>
            <option value="pending">Waiting to be checked</option>
            <option value="rejected">Rejected</option>
          </select>
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
            <table className={`${styles.table} ${styles.payments}`}>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Name</th>
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
                      <td>{formatDate(when)}</td>
                      <td>
                        <span className={styles.person}>
                          <span className={styles.avatar} aria-hidden="true">
                            {initials(c.userName)}
                          </span>
                          <span>
                            {c.userName}
                            <small>{[c.unitNumber && `Unit ${c.unitNumber}`, phone?.replace(/^\+234/, '0')].filter(Boolean).join(' · ')}</small>
                          </span>
                        </span>
                      </td>
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
                            Check
                          </button>
                        ) : (
                          <button type="button" className={styles.view} onClick={() => onOpen(c)} aria-label={`View ${c.userName}'s contribution`}>
                            <Eye size={17} aria-hidden="true" /> View
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

// The Households tab (admins): what each household owes, has paid and still owes.
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
