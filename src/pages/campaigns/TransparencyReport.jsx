import {
  ArrowRight,
  CircleCheck,
  CircleDollarSign,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Hourglass,
  PieChart,
  Receipt,
  Search,
  Share2,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { AppShell } from '../../components/dashboard/AppShell.jsx'
import { CampaignTabs } from '../../components/dashboard/CampaignTabs.jsx'
import { FundFlowChart } from '../../components/dashboard/FundFlowChart.jsx'
import { PageHeading } from '../../components/dashboard/PageHeading.jsx'
import { Pylons } from '../../components/dashboard/Pylons.jsx'
import { SpendingDonut } from '../../components/dashboard/SpendingDonut.jsx'
import { FormAlert } from '../../components/FormAlert.jsx'
import { api, downloadFile } from '../../lib/api.js'
import { methodLabel } from '../../lib/campaigns.js'
import { formatDate, formatNaira, lagosDay } from '../../lib/format.js'
import { usePageTitle } from '../../lib/usePageTitle.js'
import shared from './campaigns.module.css'
import styles from './TransparencyReport.module.css'

const PAGE_SIZE = 8
const TYPES = { contribution: 'Contribution', payment: 'Payment', refund: 'Refund', balance: 'Balance Due' }

// Transparency Report, from Transparency-Report.png.
export default function TransparencyReport() {
  const { id } = useParams()
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
        {state.status === 'loading' ? <p className={shared.loading}>Loading the report…</p> : <FormAlert>{state.message}</FormAlert>}
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
  const downloadCsv = () => saveCsv(`${campaign.title} - transactions.csv`, transactions)
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
        <header className={styles.intro}>
          <h1 className={styles.title}>Transparency Report</h1>
          <p className={styles.subtitle}>
            Track fund usage, view all transactions and ensure complete accountability for <strong>{campaign.title}</strong>.
          </p>
        </header>
        <CampaignTabs campaignId={id} />

        <div className={styles.stats}>
          <Stat icon={CircleDollarSign} label="Total Funds Collected" value={formatNaira(campaign.totalCollected)} note={`${Math.round(campaign.percentFunded)}% of the ${formatNaira(campaign.targetAmount)} target`} />
          <Stat
            icon={Wallet}
            label="Total Paid to Vendors"
            value={formatNaira(paid)}
            note={campaign.actualCost != null ? `To ${campaign.selectedVendorName}` : campaign.selectedVendorName ? 'Paid when the repair is complete' : 'No vendor selected yet'}
          />
          <Stat
            icon={FileText}
            label={balance < 0 ? 'Shortfall' : 'Balance Remaining'}
            value={formatNaira(Math.abs(balance))}
            note={
              report.reconciliation
                ? { refund: 'Refunded to contributors', balance_owed: 'Owed by contributors', settled: 'Fully settled' }[report.reconciliation.outcome]
                : campaign.actualCost != null
                  ? 'Waiting for reconciliation'
                  : 'Held until the repair is paid'
            }
            warn={balance < 0}
          />
          <Stat
            icon={Users}
            label="Total Contributors"
            value={`${overview.contributors.paid} / ${overview.contributors.total}`}
            note={`${overview.contributors.total ? Math.round((overview.contributors.paid / overview.contributors.total) * 100) : 0}% participation`}
          />
        </div>

        <div className={styles.charts}>
          <section className={shared.card} aria-labelledby="flow-title">
            <h2 id="flow-title" className={`${shared.cardTitle} ${styles.cardTitle}`}>
              <TrendingUp aria-hidden="true" /> Fund Flow Overview
            </h2>
            <FundFlowChart {...fundFlow(campaign, overview)} />
          </section>

          <section className={shared.card} aria-labelledby="spending-title">
            <h2 id="spending-title" className={`${shared.cardTitle} ${styles.cardTitle}`}>
              <PieChart aria-hidden="true" /> Spending Breakdown
            </h2>
            {campaign.actualCost != null ? (
              <SpendingDonut
                items={campaign.costItems?.length ? campaign.costItems : [{ label: `Repair by ${campaign.selectedVendorName}`, amount: campaign.actualCost }]}
                total={campaign.actualCost}
              />
            ) : (
              <p className={styles.empty}>
                <Hourglass aria-hidden="true" />
                Shown once the repair is complete and the vendor has been paid.
              </p>
            )}
          </section>

          <Accountability campaign={campaign} report={report} />
        </div>

        <div className={styles.bottom}>
          <section className={`${shared.card} ${styles.records}`} aria-label="Records">
            <div className={styles.recordTabs} role="tablist">
              {[
                ['transactions', Clock, 'Transactions'],
                ['vendors', Wrench, 'Vendor Payments'],
                ['receipts', Receipt, 'Receipts'],
                ['documents', FileText, 'Supporting Documents'],
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

          <aside className={styles.side}>
            <section className={shared.card} aria-labelledby="actions-title">
              <h2 id="actions-title" className={`${shared.cardTitle} ${styles.cardTitle}`}>
                Quick Report Actions
              </h2>
              <div className={styles.actions}>
                <Action icon={Download} title="Download Full Report" text="Get a complete PDF report" onClick={downloadPdf} />
                <Action icon={FileSpreadsheet} title="Download Transaction History" text="Export all transactions (CSV)" onClick={downloadCsv} />
                <Action icon={Wrench} title="View Vendor Payment Summary" text="Detailed vendor breakdown" onClick={() => setTab('vendors')} />
                <Action icon={Share2} title="Share Report" text="Send the public, anonymized report" onClick={share} />
              </div>
              {(problem || shareNote) && <div className={styles.feedback}>{problem ? <FormAlert>{problem}</FormAlert> : <p role="status">{shareNote}</p>}</div>}
            </section>
            <div className={shared.promise}>
              <strong>
                <ShieldCheck size={26} aria-hidden="true" /> Open Data. Stronger Trust.
              </strong>
              <p>Transparency builds confidence, and confidence builds better communities.</p>
              <Pylons className={shared.pylons} />
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}

function Stat({ icon: Icon, label, value, note, warn = false }) {
  return (
    <section className={styles.stat}>
      <span className={styles.statIcon} aria-hidden="true">
        <Icon />
      </span>
      <div>
        <h2>{label}</h2>
        <p className={styles.statValue}>{value}</p>
        <p className={`${styles.statNote} ${warn ? styles.warn : ''}`}>{note}</p>
      </div>
    </section>
  )
}

function Action({ icon: Icon, title, text, onClick }) {
  return (
    <button type="button" className={styles.action} onClick={onClick}>
      <span className={styles.actionIcon} aria-hidden="true">
        <Icon />
      </span>
      <span>
        <strong>{title}</strong>
        {text}
      </span>
      <ArrowRight aria-hidden="true" className={styles.actionArrow} />
    </button>
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

function Accountability({ campaign, report }) {
  const checks = [
    [campaign.actualCost != null, 'Verified vendor payments'],
    [Boolean(campaign.receiptUrl), 'Documented receipts'],
    [report.contributions.length > 0, 'Real-time fund usage'],
    [Boolean(campaign.publicToken), 'Community access to reports'],
  ]
  return (
    <section className={styles.accountability} aria-labelledby="accountability-title">
      <h2 id="accountability-title">
        <ShieldCheck aria-hidden="true" /> Accountability Matters
      </h2>
      <p>Every contribution, every payment and every update is tracked and visible to the community.</p>
      <ul>
        {checks.map(([done, label]) => (
          <li key={label} className={done ? styles.done : ''}>
            {done ? <CircleCheck aria-hidden="true" /> : <Clock aria-hidden="true" />}
            {label}
            {!done && <span className="visually-hidden"> (not yet)</span>}
          </li>
        ))}
      </ul>
      <p className={styles.motto}>
        Transparent today
        <br />
        Stronger tomorrow
      </p>
      <Pylons className={styles.accountabilityArt} />
    </section>
  )
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

function Transactions({ rows }) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [page, setPage] = useState(1)
  const shown = rows.filter(
    (row) =>
      (type === 'all' || row.type === type) &&
      (!query || `${row.description} ${row.party} ${row.reference}`.toLowerCase().includes(query.toLowerCase())),
  )
  const pages = Math.max(Math.ceil(shown.length / PAGE_SIZE), 1)
  const current = Math.min(page, pages)
  const pageRows = shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  return (
    <div>
      <div className={styles.recordHead}>
        <div>
          <h3>Recent Transactions</h3>
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
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
            />
          </label>
          <select
            aria-label="Transaction type"
            value={type}
            onChange={(event) => {
              setType(event.target.value)
              setPage(1)
            }}
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
            {pageRows.map((row, index) => (
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
                    <span className={styles.noReceipt} aria-label="No receipt">
                      —
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className={styles.none}>No transactions match.</p>}
      </div>

      <div className={styles.pager}>
        <span>
          Showing {pageRows.length} of {shown.length} transactions
        </span>
        {pages > 1 && (
          <span className={styles.pages}>
            <button type="button" disabled={current === 1} onClick={() => setPage(current - 1)} aria-label="Previous page">
              ‹
            </button>
            {Array.from({ length: pages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === pages || Math.abs(n - current) <= 1)
              .map((n, i, list) => (
                <span key={n} className={styles.pageGroup}>
                  {i > 0 && n - list[i - 1] > 1 && <span className={styles.gap}>…</span>}
                  <button type="button" className={n === current ? styles.currentPage : ''} aria-current={n === current ? 'page' : undefined} onClick={() => setPage(n)}>
                    {n}
                  </button>
                </span>
              ))}
            <button type="button" disabled={current === pages} onClick={() => setPage(current + 1)} aria-label="Next page">
              ›
            </button>
          </span>
        )}
      </div>
    </div>
  )
}

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
                <td className={styles.wrap}>{quote.selected ? (quote.selectionReason ?? 'Lowest quote') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {quotes.length === 0 && <p className={styles.none}>No vendor quotes yet.</p>}
      </div>
    </div>
  )
}

function Receipts({ campaign, report }) {
  const proofs = report.contributions.filter((c) => c.proofUrl)
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
        {proofs.map((c, index) => (
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
      {proofs.length === 0 && <p className={styles.none}>No contribution proofs uploaded.</p>}
    </div>
  )
}

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

function saveCsv(filename, rows) {
  const header = ['Date', 'Type', 'Description', 'From / To', 'Reference', 'Amount (NGN)', 'Status']
  const lines = rows.map((row) => [row.at ?? '', TYPES[row.type], row.description, row.party, row.reference, row.amount, row.status])
  const csv = [header, ...lines].map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: filename })
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
