import { ArrowRight, CircleCheck, Clock, Download, FileSpreadsheet, FileText, PieChart, Receipt, Search, Share2, TrendingUp, Users, Wallet, Wrench } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../../auth/AuthContext.js'
import { AppShell } from '../../components/dashboard/AppShell.jsx'
import { CampaignHeader } from '../../components/dashboard/CampaignHeader.jsx'
import { CampaignTabs } from '../../components/dashboard/CampaignTabs.jsx'
import { FundFlowChart } from '../../components/dashboard/FundFlowChart.jsx'
import { PageHeading } from '../../components/dashboard/PageHeading.jsx'
import { Pagination } from '../../components/dashboard/Pagination.jsx'
import { SpendingDonut } from '../../components/dashboard/SpendingDonut.jsx'
import { StatRow, StatTile } from '../../components/dashboard/StatTile.jsx'
import { PageSkeleton } from '../../components/Loading.jsx'
import { FormAlert } from '../../components/FormAlert.jsx'
import { api, downloadFile } from '../../lib/api.js'
import { saveCsv } from '../../lib/csv.js'
import { methodLabel } from '../../lib/campaigns.js'
import { formatDate, formatNaira, lagosDay } from '../../lib/format.js'
import { usePaged } from '../../lib/usePaged.js'
import { usePageTitle } from '../../lib/usePageTitle.js'
import shared from './campaigns.module.css'
import styles from './TransparencyReport.module.css'

const PAGE_SIZE = 8
const TYPES = { contribution: 'Contribution', payment: 'Payment', refund: 'Refund', balance: 'Balance Due' }

// Transparency Report: where every naira came from and went, with the downloads and the
// public link at the top.
export default function TransparencyReport() {
  const { id } = useParams()
  const { estate } = useAuth()
  const [state, setState] = useState({ status: 'loading' })
  const [tab, setTab] = useState('transactions')
  const [problem, setProblem] = useState('')
  const [shareNote, setShareNote] = useState('')
  usePageTitle('Transparency Report')

  useEffect(() => {
    let current = true
    Promise.all([api(`/campaigns/${id}`), api(`/campaigns/${id}/transparency-report`), api(`/campaigns/${id}/overview`)])
      .then(([{ campaign }, { report }, { overview }]) => current && setState({ status: 'ready', campaign, report, overview }))
      .catch((error) => current && setState({ status: 'error', message: error.message }))
    return () => {
      current = false
    }
  }, [id])

  const heading = <PageHeading back={{ to: `/campaigns/${id}`, label: 'Back to Campaign' }} />
  if (state.status !== 'ready') {
    return (
      <AppShell heading={heading}>
        {state.status === 'loading' ? <PageSkeleton label="Please wait, loading the transparency report…" /> : <FormAlert>{state.message}</FormAlert>}
      </AppShell>
    )
  }

  const { campaign, report, overview } = state
  const paid = campaign.actualCost ?? 0
  const balance = campaign.totalCollected - paid
  const transactions = buildTransactions(campaign, report)
  const publicLink = campaign.publicToken ? `${window.location.origin}/api/public/campaigns/${campaign.publicToken}/pdf` : null

  async function run(action) {
    setProblem('')
    try {
      await action()
    } catch (error) {
      setProblem(error.message)
    }
  }

  const downloadPdf = () => run(() => downloadFile(`/campaigns/${id}/transparency-report/pdf`, `${campaign.title} - transparency report.pdf`))
  const downloadCsv = () =>
    saveCsv(
      `${campaign.title} - transactions.csv`,
      ['Date', 'Type', 'Description', 'From / To', 'Reference', 'Amount (NGN)', 'Status'],
      transactions.map((row) => [row.at, TYPES[row.type], row.description, row.party, row.reference, row.amount, row.status]),
    )
  const share = () =>
    run(async () => {
      if (!publicLink) throw new Error('The public link appears once the campaign is published.')
      if (navigator.share) {
        await navigator.share({ title: `${campaign.title}: transparency report`, url: publicLink }).catch(() => {})
      } else {
        await navigator.clipboard.writeText(publicLink)
        setShareNote('Public report link copied. Anyone with it can open the anonymized PDF.')
      }
    })

  return (
    <AppShell heading={heading}>
      <div className={styles.page}>
        <CampaignHeader campaign={campaign} estate={estate} />
        <CampaignTabs campaignId={id} />

        <div className={shared.toolbar}>
          <button type="button" className={shared.primary} onClick={downloadPdf}>
            <Download size={20} aria-hidden="true" /> Download the report
          </button>
          <button type="button" className={shared.secondary} onClick={downloadCsv}>
            <FileSpreadsheet size={18} aria-hidden="true" /> Download as a spreadsheet
          </button>
          <button type="button" className={shared.secondary} onClick={share}>
            <Share2 size={18} aria-hidden="true" /> Share the public link
          </button>
        </div>
        {(problem || shareNote) && <div className={styles.feedback}>{problem ? <FormAlert>{problem}</FormAlert> : <p role="status">{shareNote}</p>}</div>}

        <StatRow>
          <StatTile
            icon={Wallet}
            label="Paid to the vendor"
            value={formatNaira(paid)}
            note={campaign.actualCost != null ? `To ${campaign.selectedVendorName}` : campaign.selectedVendorName ? 'Paid when the repair is done' : 'No vendor chosen yet'}
          />
          <StatTile
            icon={FileText}
            label={balance < 0 ? 'Money still needed' : 'Money left'}
            value={formatNaira(Math.abs(balance))}
            note={
              report.reconciliation
                ? { refund: 'Given back to households', balance_owed: 'Owed by households', settled: 'Fully settled' }[report.reconciliation.outcome]
                : campaign.actualCost != null
                  ? 'Waiting for the accounts to be closed'
                  : 'Kept safe until the repair is paid'
            }
            warn={balance < 0}
          />
          <StatTile icon={Users} label="Households that have paid" value={`${overview.contributors.paid} of ${overview.contributors.total}`} />
        </StatRow>

        <div className={`${styles.charts} ${campaign.actualCost != null ? styles.twoCharts : ''}`}>
          <section className={shared.card} aria-labelledby="flow-title">
            <h2 id="flow-title" className={`${shared.cardTitle} ${styles.cardTitle}`}>
              <TrendingUp aria-hidden="true" /> Money in and out over time
            </h2>
            <FundFlowChart {...fundFlow(campaign, overview)} />
          </section>

          {campaign.actualCost != null && (
            <section className={shared.card} aria-labelledby="spending-title">
              <h2 id="spending-title" className={`${shared.cardTitle} ${styles.cardTitle}`}>
                <PieChart aria-hidden="true" /> What the money was spent on
              </h2>
              <SpendingDonut
                items={campaign.costItems?.length ? campaign.costItems : [{ label: `Repair by ${campaign.selectedVendorName}`, amount: campaign.actualCost }]}
                total={campaign.actualCost}
              />
            </section>
          )}
        </div>

        <section className={`${shared.card} ${styles.records}`} aria-label="Records">
          <div className={styles.recordTabs} role="tablist">
            {[
              ['transactions', Clock, 'Every payment'],
              ['vendors', Wrench, 'Vendor'],
              ['receipts', Receipt, 'Receipts'],
              ['documents', FileText, 'Documents'],
            ].map(([key, Icon, label]) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? styles.activeRecordTab : ''} onClick={() => setTab(key)}>
                <Icon aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
          {tab === 'transactions' && <Transactions rows={transactions} />}
          {tab === 'vendors' && <VendorPayments campaign={campaign} quotes={report.quotes} />}
          {tab === 'receipts' && <Receipts campaign={campaign} report={report} />}
          {tab === 'documents' && <Documents report={report} publicLink={publicLink} onPdf={downloadPdf} />}
        </section>
      </div>
    </AppShell>
  )
}

// Collected, paid to the vendor and what's left, day by day since the campaign opened.
function fundFlow(campaign, overview) {
  const dates = overview.timeline.map((point) => point.date)
  const collected = overview.timeline.map((point) => point.total)
  const paidOn = campaign.completedAt ? lagosDay(campaign.completedAt) : null
  const paid = dates.map((date) => (paidOn && date >= paidOn ? campaign.actualCost : 0))
  return {
    dates,
    series: [
      { label: 'Collected', color: '#0b3d2c', values: collected },
      { label: 'Paid to Vendors', color: '#3fb27a', values: paid },
      { label: 'Balance', color: '#9fb4ad', values: collected.map((total, i) => Math.max(total - paid[i], 0)) },
    ],
  }
}

// Every movement of money on the campaign, newest first.
function buildTransactions(campaign, report) {
  const rows = report.contributions.map((c) => ({
    at: c.verifiedAt,
    type: 'contribution',
    description: `Community Contribution · ${methodLabel(c.method)}`,
    party: c.unitNumber ? `${c.contributor} (${c.unitNumber})` : c.contributor,
    reference: c.reference ?? '',
    amount: c.amount,
    status: 'Completed',
    receipt: c.proofUrl,
  }))
  if (campaign.actualCost != null) {
    const items = campaign.costItems?.length ? campaign.costItems : [{ label: 'Repair payment', amount: campaign.actualCost }]
    for (const item of items) {
      rows.push({
        at: campaign.completedAt,
        type: 'payment',
        description: item.label,
        party: campaign.selectedVendorName,
        reference: '',
        amount: item.amount,
        status: 'Completed',
        receipt: campaign.receiptUrl,
      })
    }
  }
  const r = report.reconciliation
  if (r && r.outcome !== 'settled') {
    rows.push({
      at: r.generatedAt,
      type: r.outcome === 'refund' ? 'refund' : 'balance',
      description: r.outcome === 'refund' ? 'Refunds to contributors (by share paid)' : 'Shortfall shared by contributors',
      party: `${r.perContributor.length} contributors`,
      reference: '',
      amount: Math.abs(r.variance),
      status: 'Reconciled',
      receipt: null,
    })
  }
  return rows.sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? '')))
}

// The Transactions tab: search and type filter over the rows from buildTransactions, paged.
function Transactions({ rows }) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const shown = rows.filter(
    (row) =>
      (type === 'all' || row.type === type) &&
      (!query || `${row.description} ${row.party} ${row.reference}`.toLowerCase().includes(query.toLowerCase())),
  )
  const paged = usePaged(shown, PAGE_SIZE, `${query}|${type}`)

  return (
    <div>
      <div className={styles.recordHead}>
        <div>
          <h3>Money in and out</h3>
          <p>All contributions and payments related to this campaign.</p>
        </div>
        <div className={styles.filters}>
          <label className={styles.search}>
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search by name, reference or description…"
              aria-label="Search transactions"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <select
            aria-label="Transaction type"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="all">All Types</option>
            <option value="contribution">Contributions</option>
            <option value="payment">Payments</option>
            <option value="refund">Refunds</option>
            <option value="balance">Balances Due</option>
          </select>
        </div>
      </div>

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Type</th>
              <th scope="col">Description</th>
              <th scope="col">From / To</th>
              <th scope="col">Amount (₦)</th>
              <th scope="col">Status</th>
              <th scope="col">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map((row, index) => (
              <tr key={`${row.at}-${index}`}>
                <td>
                  {formatDate(row.at)}
                  <small>{row.at ? new Date(row.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' }) : ''}</small>
                </td>
                <td>
                  <span className={`${styles.type} ${styles[row.type]}`}>
                    <CircleCheck aria-hidden="true" /> {TYPES[row.type]}
                  </span>
                </td>
                <td className={styles.wrap}>{row.description}</td>
                <td className={styles.wrap}>{row.party}</td>
                <td className={styles.amount}>{new Intl.NumberFormat('en-NG').format(row.amount)}</td>
                <td>
                  <span className={styles.status}>{row.status}</span>
                </td>
                <td>
                  {row.receipt ? (
                    <a href={row.receipt} target="_blank" rel="noreferrer" aria-label="Open receipt" className={styles.receipt}>
                      <Download size={17} />
                    </a>
                  ) : (
                    <span className={styles.noReceipt}>None</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className={styles.none}>No transactions match.</p>}
      </div>

      <Pagination paged={paged} noun="transactions" />
    </div>
  )
}

// The Vendor Payments tab: every quote, which one was chosen, why, and what was paid.
function VendorPayments({ campaign, quotes }) {
  return (
    <div>
      <div className={styles.recordHead}>
        <div>
          <h3>Vendor Payments</h3>
          <p>Every quote received, who was chosen and why, and what they were paid.</p>
        </div>
        <Link to={`/campaigns/${campaign.id}/quotes`} className={styles.linkButton}>
          Vendor Quotes <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Vendor</th>
              <th scope="col">Quote (₦)</th>
              <th scope="col">Paid (₦)</th>
              <th scope="col">Status</th>
              <th scope="col">Why chosen</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => (
              <tr key={quote.vendorName + quote.quotedAmount}>
                <td>{quote.vendorName}</td>
                <td className={styles.amount}>{new Intl.NumberFormat('en-NG').format(quote.quotedAmount)}</td>
                <td className={styles.amount}>{quote.selected && campaign.actualCost != null ? new Intl.NumberFormat('en-NG').format(campaign.actualCost) : '0'}</td>
                <td>
                  <span className={`${styles.status} ${quote.selected ? '' : styles.muted}`}>
                    {quote.selected ? (campaign.actualCost != null ? 'Paid' : 'Selected') : 'Not used'}
                  </span>
                </td>
                <td className={styles.wrap}>{quote.selected ? (quote.selectionReason ?? 'Lowest quote') : 'Not chosen'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {quotes.length === 0 && <p className={styles.none}>No vendor quotes yet.</p>}
      </div>
    </div>
  )
}

// The Receipts tab: the vendor's receipt plus every proof of payment residents attached.
function Receipts({ campaign, report }) {
  const proofs = report.contributions.filter((c) => c.proofUrl)
  const paged = usePaged(proofs, PAGE_SIZE)
  return (
    <div>
      <div className={styles.recordHead}>
        <div>
          <h3>Receipts</h3>
          <p>The vendor’s receipt, and the payment proofs residents uploaded with their contributions.</p>
        </div>
      </div>
      <ul className={styles.docs}>
        <li>
          <Receipt aria-hidden="true" />
          <span>
            <strong>Vendor receipt</strong>
            {campaign.receiptUrl ? `Uploaded when the repair was marked complete` : 'Not uploaded'}
          </span>
          {campaign.receiptUrl && (
            <a href={campaign.receiptUrl} target="_blank" rel="noreferrer">
              View
            </a>
          )}
        </li>
        {paged.rows.map((c, index) => (
          <li key={`${c.contributor}-${index}`}>
            <Receipt aria-hidden="true" />
            <span>
              <strong>{c.contributor}</strong>
              {formatNaira(c.amount)} on {formatDate(c.verifiedAt)}
            </span>
            <a href={c.proofUrl} target="_blank" rel="noreferrer">
              View
            </a>
          </li>
        ))}
      </ul>
      {proofs.length === 0 ? <p className={styles.none}>No contribution proofs uploaded.</p> : <Pagination paged={paged} noun="proofs" />}
    </div>
  )
}

// The Supporting Documents tab: the PDF, the public link and the quote documents.
function Documents({ report, publicLink, onPdf }) {
  const attached = report.quotes.filter((quote) => quote.attachmentUrl)
  return (
    <div>
      <div className={styles.recordHead}>
        <div>
          <h3>Supporting Documents</h3>
          <p>The full report, the public link, and the vendors’ quote documents.</p>
        </div>
      </div>
      <ul className={styles.docs}>
        <li>
          <FileText aria-hidden="true" />
          <span>
            <strong>Full transparency report (PDF)</strong>
            Summary, timeline, contributions, quotes and reconciliation
          </span>
          <button type="button" onClick={onPdf}>
            Download
          </button>
        </li>
        <li>
          <Share2 aria-hidden="true" />
          <span>
            <strong>Public report link</strong>
            {publicLink ? 'Anyone with it can read the report, without contributors’ names' : 'Created when the campaign is published'}
          </span>
          {publicLink && (
            <a href={publicLink} target="_blank" rel="noreferrer">
              Open
            </a>
          )}
        </li>
        {attached.map((quote) => (
          <li key={quote.vendorName}>
            <FileText aria-hidden="true" />
            <span>
              <strong>{quote.vendorName} quote</strong>
              {formatNaira(quote.quotedAmount)}
            </span>
            <a href={quote.attachmentUrl} target="_blank" rel="noreferrer">
              View
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
