import {
  ArrowRight,
  CircleCheck,
  CircleDollarSign,
  Clock,
  ClipboardList,
  Download,
  FileText,
  HandCoins,
  Hourglass,
  Landmark,
  Megaphone,
  Receipt,
  Scale,
  Target,
  Trophy,
  Wrench,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../../auth/AuthContext.js'
import { Button } from '../../components/Button.jsx'
import { AppShell } from '../../components/dashboard/AppShell.jsx'
import { CampaignHeader } from '../../components/dashboard/CampaignHeader.jsx'
import { CampaignTabs } from '../../components/dashboard/CampaignTabs.jsx'
import { FormField } from '../../components/dashboard/FormField.jsx'
import { Modal } from '../../components/dashboard/Modal.jsx'
import { PageHeading } from '../../components/dashboard/PageHeading.jsx'
import { FormAlert } from '../../components/FormAlert.jsx'
import { api, downloadFile, uploadImage } from '../../lib/api.js'
import { groupDigits, parseNaira } from '../../lib/campaigns.js'
import { formatDate, formatNaira, initials } from '../../lib/format.js'
import { usePageTitle } from '../../lib/usePageTitle.js'
import shared from './campaigns.module.css'
import styles from './Reconciliation.module.css'

const PAGE_SIZE = 8

// What each audit event is called in Recent Activity.
const EVENTS = {
  campaign_created: ['Campaign Created', Megaphone],
  campaign_updated: ['Campaign Updated', FileText],
  campaign_published: ['Campaign Published', Megaphone],
  payment_details_updated: ['Payment Account Updated', Landmark],
  contribution_recorded: ['Contribution Recorded', HandCoins],
  contribution_verified: ['Contribution Verified', HandCoins],
  contribution_rejected: ['Contribution Rejected', HandCoins],
  target_reached: ['Target Reached', Target],
  quote_added: ['Vendor Quote Added', ClipboardList],
  vendor_selected: ['Vendor Selected', Wrench],
  repair_completed: ['Repair Marked Complete', CircleCheck],
  campaign_reconciled: ['Fund Reconciled', Scale],
}

// Mark Complete + Reconciliation, from Reconciliation-Screen.png.
export default function Reconciliation() {
  const { id } = useParams()
  const { profile, estate } = useAuth()
  const isAdmin = profile.role === 'admin'
  const [state, setState] = useState({ status: 'loading' })
  const [dialog, setDialog] = useState(null) // 'complete' | 'reconcile'
  usePageTitle('Reconciliation')

  const load = useCallback(() => {
    let current = true
    Promise.all([api(`/campaigns/${id}`), api(`/campaigns/${id}/transparency-report`)])
      .then(([{ campaign }, { report }]) => current && setState({ status: 'ready', campaign, report }))
      .catch((error) => current && setState((shown) => (shown.status === 'ready' ? shown : { status: 'error', message: error.message })))
    return () => {
      current = false
    }
  }, [id])

  useEffect(load, [load])

  const heading = <PageHeading back={{ to: `/campaigns/${id}`, label: 'Back to Campaign' }} />
  if (state.status !== 'ready') {
    return (
      <AppShell heading={heading}>
        {state.status === 'loading' ? <p className={shared.loading}>Loading reconciliation…</p> : <FormAlert>{state.message}</FormAlert>}
      </AppShell>
    )
  }

  const { campaign, report } = state
  const reconciliation = report.reconciliation
  const pending = campaign.pendingCount ?? 0
  const ready = campaign.status === 'completed' && pending === 0

  return (
    <AppShell heading={heading}>
      <div className={styles.page}>
        <header className={styles.intro}>
          <span className={styles.introIcon} aria-hidden="true">
            <CircleCheck />
          </span>
          <div>
            <h1 className={styles.title}>Mark Complete + Reconciliation</h1>
            <p className={styles.subtitle}>Confirm project completion, verify expenses and finalize the financial reconciliation for this campaign.</p>
          </div>
        </header>

        <div className={styles.layout}>
          <div className={styles.main}>
            <section className={shared.card}>
              <CampaignHeader campaign={campaign} estate={estate} photo="left" headingLevel={2} />
            </section>
            <CampaignTabs campaignId={id} />

            <section className={shared.card} aria-labelledby="details-title">
              <div className={shared.cardHead}>
                <div>
                  <h2 id="details-title" className={shared.cardTitle}>
                    Reconciliation Details
                  </h2>
                  <p className={shared.cardText}>Verify all amounts, confirm payments and mark the campaign as complete.</p>
                </div>
                <StageBadge campaign={campaign} ready={ready} />
              </div>

              <div className={styles.columns}>
                <FinancialSummary campaign={campaign} reconciliation={reconciliation} />
                <VendorBreakdown campaign={campaign} quotes={report.quotes} />
              </div>

              <Documents campaign={campaign} quotes={report.quotes} />

              <ActionBar campaign={campaign} isAdmin={isAdmin} pending={pending} ready={ready} onAction={setDialog} />
            </section>

            {reconciliation && <Adjustments reconciliation={reconciliation} myName={profile.name} />}
          </div>

          <aside className={styles.side}>
            <ProgressCard campaign={campaign} reconciliation={reconciliation} pending={pending} ready={ready} />
            <Activity campaignId={id} timeline={report.timeline} />
          </aside>
        </div>
      </div>

      {dialog === 'complete' && (
        <CompleteDialog
          campaign={campaign}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null)
            load()
          }}
        />
      )}
      {dialog === 'reconcile' && (
        <ReconcileDialog
          campaign={campaign}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null)
            load()
          }}
        />
      )}
    </AppShell>
  )
}

function StageBadge({ campaign, ready }) {
  const [label, tone] =
    campaign.status === 'reconciled'
      ? ['Reconciled', 'done']
      : ready
        ? ['Ready for Final Reconciliation', 'done']
        : campaign.status === 'completed'
          ? ['Waiting on Verification', 'wait']
          : campaign.status === 'repairing'
            ? ['Repair in Progress', 'wait']
            : ['Not Started', 'idle']
  return (
    <span className={`${styles.stage} ${styles[tone]}`}>
      {tone === 'done' ? <CircleCheck size={15} aria-hidden="true" /> : <Hourglass size={15} aria-hidden="true" />}
      {label}
    </span>
  )
}

function FinancialSummary({ campaign, reconciliation }) {
  const cost = campaign.actualCost ?? campaign.selectedQuoteAmount
  const difference = reconciliation ? reconciliation.variance : cost != null ? campaign.totalCollected - cost : null
  const resultLabel = reconciliation
    ? { refund: 'Refund to Contributors', balance_owed: 'Balance Owed by Contributors', settled: 'Balance Remaining' }[reconciliation.outcome]
    : difference != null && difference < 0
      ? 'Estimated Shortfall'
      : 'Balance Remaining'
  const rows = [
    [Target, 'Target Amount', formatNaira(campaign.targetAmount)],
    [CircleDollarSign, 'Total Collected', formatNaira(campaign.totalCollected)],
    [Landmark, campaign.actualCost != null ? 'Total Vendor Payment' : 'Selected Quote', cost != null ? formatNaira(cost) : '—'],
    [Hourglass, 'Awaiting Verification', formatNaira(campaign.pendingAmount ?? 0)],
  ]

  return (
    <section className={styles.panel} aria-labelledby="summary-title">
      <h3 id="summary-title">Financial Summary</h3>
      <dl className={styles.summary}>
        {rows.map(([Icon, label, value]) => (
          <div key={label}>
            <dt>
              <Icon aria-hidden="true" /> {label}
            </dt>
            <dd>{value}</dd>
          </div>
        ))}
        <div className={`${styles.result} ${difference < 0 ? styles.short : ''}`}>
          <dt>
            <CircleCheck aria-hidden="true" /> {resultLabel}
          </dt>
          <dd>{difference == null ? '—' : formatNaira(Math.abs(difference))}</dd>
        </div>
      </dl>
    </section>
  )
}

function VendorBreakdown({ campaign, quotes }) {
  const paid = campaign.actualCost ?? 0
  return (
    <section className={styles.panel} aria-labelledby="vendors-title">
      <div className={styles.panelHead}>
        <h3 id="vendors-title">Vendor Payment Breakdown</h3>
        <Link to={`/campaigns/${campaign.id}/quotes`} className={styles.panelLink}>
          View Vendor Quotes <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
      {quotes.length === 0 ? (
        <p className={styles.muted}>No vendor quotes yet.</p>
      ) : (
        <table className={styles.vendors}>
          <thead>
            <tr>
              <th scope="col">Vendor</th>
              <th scope="col">Amount (₦)</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => {
              const status = quote.selected ? (campaign.actualCost != null ? 'Paid' : 'Selected') : 'Not Used'
              return (
                <tr key={quote.vendorName + quote.quotedAmount}>
                  <td>
                    <span className={styles.vendorName}>
                      <Wrench aria-hidden="true" /> {quote.vendorName}
                    </span>
                  </td>
                  <td>{formatNaira(quote.selected ? (campaign.actualCost ?? quote.quotedAmount) : 0)}</td>
                  <td>
                    <span className={`${styles.pill} ${quote.selected ? styles.pillPaid : ''}`}>{status}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total Paid to Vendor</th>
              <td colSpan={2}>{formatNaira(paid)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  )
}

function Documents({ campaign, quotes }) {
  const [problem, setProblem] = useState('')
  const selected = quotes.find((quote) => quote.selected)

  async function downloadReport() {
    setProblem('')
    try {
      await downloadFile(`/campaigns/${campaign.id}/transparency-report/pdf`, `${campaign.title} - transparency report.pdf`)
    } catch (error) {
      setProblem(error.message)
    }
  }

  return (
    <section className={styles.documents} aria-labelledby="docs-title">
      <h3 id="docs-title">Supporting Documents</h3>
      <div className={styles.docGrid}>
        <Doc icon={FileText} title="Vendor Quote" href={selected?.attachmentUrl} missing={selected ? 'No document attached' : 'No vendor selected'} />
        <Doc icon={Receipt} title="Payment Receipt" href={campaign.receiptUrl} missing="Added when the repair is marked complete" />
        <button type="button" className={styles.doc} onClick={downloadReport}>
          <span className={styles.docIcon} aria-hidden="true">
            <Download />
          </span>
          <span>
            <strong>Reconciliation Report</strong>
            <small>Download PDF</small>
          </span>
        </button>
      </div>
      {problem && <FormAlert>{problem}</FormAlert>}
    </section>
  )
}

function Doc({ icon: Icon, title, href, missing }) {
  const content = (
    <>
      <span className={styles.docIcon} aria-hidden="true">
        <Icon />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{href ? 'View Document' : missing}</small>
      </span>
    </>
  )
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={styles.doc}>
      {content}
    </a>
  ) : (
    <div className={`${styles.doc} ${styles.docMissing}`}>{content}</div>
  )
}

function ActionBar({ campaign, isAdmin, pending, ready, onAction }) {
  let text
  let action = null
  switch (campaign.status) {
    case 'draft':
    case 'fundraising':
      text = 'Select a vendor first. Once the repair is done, mark it complete here with the actual cost.'
      action = (
        <Link to={`/campaigns/${campaign.id}/quotes`} className={styles.actionLink}>
          Go to Vendor Quotes <ArrowRight size={17} aria-hidden="true" />
        </Link>
      )
      break
    case 'repairing':
      text = `${campaign.selectedVendorName} is carrying out the repair. When the work is done, record what was actually paid.`
      if (isAdmin) {
        action = (
          <Button onClick={() => onAction('complete')} className={styles.actionButton}>
            <CircleCheck size={18} aria-hidden="true" /> Mark as Complete
          </Button>
        )
      }
      break
    case 'completed':
      text = ready
        ? 'All records have been verified and match the campaign details. You can now finalize the reconciliation.'
        : `Verify or reject the ${pending} pending contribution${pending === 1 ? '' : 's'} before reconciling, so only confirmed money is settled.`
      if (isAdmin) {
        action = ready ? (
          <Button onClick={() => onAction('reconcile')} className={styles.actionButton}>
            <Scale size={18} aria-hidden="true" /> Run Reconciliation
          </Button>
        ) : (
          <Link to={`/campaigns/${campaign.id}/contributions`} className={styles.actionLink}>
            Review Contributions <ArrowRight size={17} aria-hidden="true" />
          </Link>
        )
      }
      break
    default:
      text = `Reconciled on ${formatDate(campaign.reconciledAt)}. Every refund and balance below is final and recorded in the audit trail.`
      action = (
        <Link to={`/campaigns/${campaign.id}/report`} className={styles.actionLink}>
          View Transparency Report <ArrowRight size={17} aria-hidden="true" />
        </Link>
      )
  }

  return (
    <div className={styles.actionBar}>
      <CircleCheck className={styles.actionTick} aria-hidden="true" />
      <p>{text}</p>
      {action}
    </div>
  )
}

function ProgressCard({ campaign, reconciliation, pending, ready }) {
  const percent = campaign.targetAmount ? Math.min(Math.round((campaign.totalCollected / campaign.targetAmount) * 100), 100) : 0
  const circumference = 2 * Math.PI * 62
  const checks = [
    {
      done: campaign.totalCollected >= campaign.targetAmount,
      title: 'Contributions Completed',
      detail: `${formatNaira(campaign.totalCollected)} / ${formatNaira(campaign.targetAmount)}`,
    },
    {
      done: campaign.actualCost != null,
      title: 'Vendor Payment Completed',
      detail:
        campaign.actualCost != null
          ? `${formatNaira(campaign.actualCost)} / ${formatNaira(campaign.selectedQuoteAmount)} quoted`
          : campaign.selectedVendorName
            ? `${campaign.selectedVendorName} is working on it`
            : 'No vendor selected yet',
    },
    {
      done: ready || Boolean(reconciliation),
      title: reconciliation ? 'Reconciled' : 'Reconciliation Ready',
      detail: reconciliation ? `On ${formatDate(reconciliation.generatedAt)}` : pending ? `${pending} contribution(s) awaiting verification` : 'All records verified',
    },
  ]

  return (
    <section className={shared.card} aria-labelledby="progress-title">
      <h2 id="progress-title" className={`${shared.cardTitle} ${styles.sideTitle}`}>
        Campaign Progress
      </h2>
      <div className={styles.progress}>
        <svg viewBox="0 0 160 160" className={styles.ring} role="img" aria-label={`${percent}% collected`}>
          <circle cx="80" cy="80" r="62" className={styles.track} />
          <circle
            cx="80"
            cy="80"
            r="62"
            className={styles.fill}
            strokeDasharray={`${(percent / 100) * circumference} ${circumference}`}
            transform="rotate(-90 80 80)"
          />
          <text x="80" y="74" textAnchor="middle" className={styles.ringPercent}>
            {percent}%
          </text>
          <text x="80" y="96" textAnchor="middle" className={styles.ringAmount}>
            {formatNaira(campaign.totalCollected)}
          </text>
          <text x="80" y="113" textAnchor="middle" className={styles.ringCaption}>
            collected
          </text>
        </svg>
        <ul className={styles.checks}>
          {checks.map((check) => (
            <li key={check.title} className={check.done ? styles.checkDone : ''}>
              {check.done ? <CircleCheck aria-hidden="true" /> : <Clock aria-hidden="true" />}
              <span>
                <strong>{check.title}</strong>
                {check.detail}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className={`${styles.closeCard} ${ready || reconciliation ? '' : styles.closeWaiting}`}>
        <span className={styles.trophy} aria-hidden="true">
          {ready || reconciliation ? <Trophy /> : <Hourglass />}
        </span>
        <div>
          <strong>{reconciliation ? 'Campaign Closed' : ready ? 'Campaign Ready to Close' : 'Not Ready to Close Yet'}</strong>
          <p>
            {reconciliation
              ? 'The fund has been reconciled and every contributor has been told their result.'
              : ready
                ? 'Everything looks good! This campaign can now be reconciled.'
                : 'Finish the repair and verify every contribution, then the fund can be reconciled.'}
          </p>
        </div>
      </div>
    </section>
  )
}

function Activity({ campaignId, timeline }) {
  // Newest first; individual contributions are summarised on the Contributions page.
  const recent = [...timeline].reverse().filter((event) => event.type !== 'contribution_recorded').slice(0, 5)
  return (
    <section className={shared.card} aria-labelledby="activity-title">
      <div className={shared.cardHead}>
        <h2 id="activity-title" className={shared.cardTitle}>
          Recent Activity
        </h2>
        <Link to={`/campaigns/${campaignId}/report`} className={styles.viewAllPill}>
          View All
        </Link>
      </div>
      <ol className={styles.activity}>
        {recent.map((event, index) => {
          const [title, Icon] = EVENTS[event.type] ?? ['Update', Clock]
          return (
            <li key={`${event.at}-${index}`}>
              <span className={styles.activityIcon} aria-hidden="true">
                <Icon />
              </span>
              <div>
                <strong>{title}</strong>
                {/* The audit trail writes NGN (the PDF font has no ₦); on screen, use the sign. */}
                <p>{event.message.replaceAll('NGN ', '₦')}</p>
                <time dateTime={event.at}>
                  {formatDate(event.at)} · {new Date(event.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' })}
                </time>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

// After reconciling: what each contributor gets back or still owes.
function Adjustments({ reconciliation, myName }) {
  const [page, setPage] = useState(1)
  const rows = reconciliation.perContributor
  const pages = Math.max(Math.ceil(rows.length / PAGE_SIZE), 1)
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const outcome = {
    refund: `The repair cost less than was collected. ${formatNaira(reconciliation.variance)} goes back to contributors in proportion to what each paid.`,
    balance_owed: `The repair cost more than was collected. The ${formatNaira(-reconciliation.variance)} shortfall is shared in proportion to what each paid.`,
    settled: 'The repair cost exactly what was collected. Nothing is owed either way.',
  }[reconciliation.outcome]

  return (
    <section className={shared.card} aria-labelledby="adjust-title">
      <h2 id="adjust-title" className={shared.cardTitle}>
        Refunds &amp; Balances
      </h2>
      <p className={`${shared.cardText} ${styles.adjustIntro}`}>{outcome}</p>
      <div className={styles.adjustScroll}>
        <table className={styles.adjust}>
          <thead>
            <tr>
              <th scope="col">Contributor</th>
              <th scope="col">Paid</th>
              <th scope="col">Share</th>
              <th scope="col">Refund / Balance</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.contributor} className={row.contributor === myName ? styles.mine : ''}>
                <td>
                  <span className={styles.person}>
                    <span className={styles.avatar} aria-hidden="true">
                      {initials(row.contributor)}
                    </span>
                    {row.contributor}
                    {row.contributor === myName && <em>You</em>}
                  </span>
                </td>
                <td>{formatNaira(row.paid)}</td>
                <td>{row.sharePercent}%</td>
                <td className={row.adjustment > 0 ? styles.refund : row.adjustment < 0 ? styles.owed : ''}>
                  {row.adjustment > 0 ? `Refund ${formatNaira(row.adjustment)}` : row.adjustment < 0 ? `Owes ${formatNaira(-row.adjustment)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className={styles.pager}>
          <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button type="button" disabled={page === pages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      )}
    </section>
  )
}

/* ---------------------------------------------------------------- Dialogs */

function CompleteDialog({ campaign, onClose, onDone }) {
  const [cost, setCost] = useState(String(campaign.selectedQuoteAmount ?? ''))
  const [note, setNote] = useState('')
  const [items, setItems] = useState([])
  const [receiptUrl, setReceiptUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function attach(file) {
    if (!file) return
    setUploading(true)
    try {
      setReceiptUrl(await uploadImage(file, 'receipt'))
    } catch (problem) {
      setError(problem.message)
    } finally {
      setUploading(false)
    }
  }

  async function submit(event) {
    event.preventDefault()
    const actualCost = parseNaira(cost)
    if (!actualCost) return setError('Enter what was actually paid to the vendor')
    const costItems = items
      .map((item) => ({ label: item.label.trim(), amount: parseNaira(item.amount) }))
      .filter((item) => item.label || item.amount)
    if (costItems.some((item) => !item.label || !item.amount)) return setError('Give every cost line a name and an amount')
    if (costItems.length && itemsTotal !== actualCost) return setError('The cost breakdown must add up to the actual cost')
    setBusy(true)
    setError('')
    try {
      await api(`/campaigns/${campaign.id}/complete`, {
        method: 'POST',
        body: {
          actualCost,
          completionNote: note.trim() || undefined,
          receiptUrl: receiptUrl ?? undefined,
          costItems: costItems.length ? costItems : undefined,
        },
      })
      onDone()
    } catch (problem) {
      setError(problem.message)
      setBusy(false)
    }
  }

  const difference = parseNaira(cost) != null && campaign.selectedQuoteAmount ? parseNaira(cost) - campaign.selectedQuoteAmount : 0
  const itemsTotal = items.reduce((sum, item) => sum + (parseNaira(item.amount) ?? 0), 0)
  const setItem = (index, field) => (event) =>
    setItems((shown) => shown.map((item, i) => (i === index ? { ...item, [field]: event.target.value } : item)))

  return (
    <Modal title="Mark the Repair Complete" description={`Record what was actually paid to ${campaign.selectedVendorName}. Every resident is notified.`} onClose={onClose}>
      <form onSubmit={submit} noValidate className={styles.dialogForm}>
        <FormField
          label="Actual Cost (₦)"
          required
          icon={CircleDollarSign}
          inputMode="numeric"
          value={groupDigits(parseNaira(cost))}
          onChange={(event) => setCost(event.target.value)}
          hint={
            difference
              ? `${formatNaira(Math.abs(difference))} ${difference > 0 ? 'more' : 'less'} than the ${formatNaira(campaign.selectedQuoteAmount)} quote. The difference is recorded.`
              : `Same as the selected quote (${formatNaira(campaign.selectedQuoteAmount)}).`
          }
        />
        <fieldset className={styles.costItems}>
          <legend>
            Cost Breakdown <span>(optional)</span>
          </legend>
          <p>What the money paid for, e.g. the transformer, labour, transport. Residents see it on the transparency report.</p>
          {items.map((item, index) => (
            <div key={index} className={styles.costRow}>
              <input aria-label={`Cost ${index + 1} name`} placeholder="e.g. Transformer replacement" value={item.label} onChange={setItem(index, 'label')} maxLength={60} />
              <input
                aria-label={`Cost ${index + 1} amount`}
                placeholder="₦ amount"
                inputMode="numeric"
                value={groupDigits(parseNaira(item.amount))}
                onChange={setItem(index, 'amount')}
              />
              <button type="button" aria-label={`Remove cost ${index + 1}`} onClick={() => setItems((shown) => shown.filter((_, i) => i !== index))}>
                ×
              </button>
            </div>
          ))}
          <div className={styles.costFooter}>
            {items.length < 10 && (
              <button type="button" onClick={() => setItems((shown) => [...shown, { label: '', amount: '' }])}>
                + Add cost line
              </button>
            )}
            {items.length > 0 && (
              <span className={itemsTotal === parseNaira(cost) ? styles.sumOk : styles.sumOff}>
                Adds up to {formatNaira(itemsTotal)} of {formatNaira(parseNaira(cost) ?? 0)}
              </span>
            )}
          </div>
        </fieldset>
        <FormField label="Completion Note" optional as="textarea" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. New transformer installed and tested. Power restored to Blocks A and B." />
        <div className={styles.attach}>
          <span>Receipt or Invoice Photo (optional)</span>
          <label className={shared.secondary}>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/heic" hidden onChange={(event) => attach(event.target.files?.[0])} />
            {uploading ? 'Uploading…' : receiptUrl ? 'Attached ✓ Change' : 'Attach image'}
          </label>
        </div>
        {error && <FormAlert>{error}</FormAlert>}
        <div className={styles.dialogActions}>
          <button type="button" className={shared.secondary} onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" busy={busy} disabled={uploading}>
            Mark as Complete
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function ReconcileDialog({ campaign, onClose, onDone }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const variance = campaign.totalCollected - campaign.actualCost

  async function confirm() {
    setBusy(true)
    setError('')
    try {
      await api(`/campaigns/${campaign.id}/reconcile`, { method: 'POST' })
      onDone()
    } catch (problem) {
      setError(problem.message)
      setBusy(false)
    }
  }

  return (
    <Modal title="Run the Reconciliation?" onClose={onClose}>
      <div className={styles.dialogForm}>
        <p className={styles.dialogText}>
          Collected {formatNaira(campaign.totalCollected)}, actual cost {formatNaira(campaign.actualCost)}.{' '}
          {variance > 0
            ? `${formatNaira(variance)} will be split as refunds in proportion to what each contributor paid.`
            : variance < 0
              ? `The ${formatNaira(-variance)} shortfall will be shared in proportion to what each contributor paid.`
              : 'Nothing is owed either way.'}{' '}
          This is final: each contributor is told their result and it goes into the audit trail.
        </p>
        {error && <FormAlert>{error}</FormAlert>}
        <div className={styles.dialogActions}>
          <button type="button" className={shared.secondary} onClick={onClose}>
            Cancel
          </button>
          <Button busy={busy} onClick={confirm}>
            Run Reconciliation
          </Button>
        </div>
      </div>
    </Modal>
  )
}
