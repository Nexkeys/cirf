import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CircleCheck,
  CircleDollarSign,
  ClipboardList,
  Crown,
  FileText,
  Mail,
  MapPin,
  MoreVertical,
  Phone,
  Plus,
  ShieldCheck,
  Target,
  Timer,
  UserRound,
  Wrench,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../../auth/AuthContext.js'
import { Button } from '../../components/Button.jsx'
import { AppShell } from '../../components/dashboard/AppShell.jsx'
import { CampaignTabs } from '../../components/dashboard/CampaignTabs.jsx'
import { FormField } from '../../components/dashboard/FormField.jsx'
import { Modal } from '../../components/dashboard/Modal.jsx'
import { PageHeading } from '../../components/dashboard/PageHeading.jsx'
import { Pagination } from '../../components/dashboard/Pagination.jsx'
import { QuoteComparison } from '../../components/dashboard/QuoteComparison.jsx'
import { StatusBadge } from '../../components/dashboard/StatusBadge.jsx'
import { FormAlert } from '../../components/FormAlert.jsx'
import { PageSkeleton } from '../../components/Loading.jsx'
import { useToast } from '../../components/ToastContext.js'
import { api, uploadImage } from '../../lib/api.js'
import { categoryLabel, groupDigits, parseNaira } from '../../lib/campaigns.js'
import { formatDate, formatNaira, initials } from '../../lib/format.js'
import { usePaged } from '../../lib/usePaged.js'
import { usePageTitle } from '../../lib/usePageTitle.js'
import shared from './campaigns.module.css'
import styles from './VendorQuotes.module.css'

// Quotes can be added until the repair is complete, and a vendor chosen (or changed)
// while money is still being raised or the repair is underway.
const CAN_ADD = ['draft', 'fundraising', 'repairing']
const QUOTES_PER_PAGE = 6
const CAN_SELECT = ['fundraising', 'repairing']

// Vendor Quotes, from Vendor-Quotes.png.
export default function VendorQuotes() {
  const { id } = useParams()
  const { profile, estate } = useAuth()
  const isAdmin = profile.role === 'admin'
  const [state, setState] = useState({ status: 'loading' })
  const [focusId, setFocusId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [selecting, setSelecting] = useState(null)
  const listRef = useRef(null)
  const detailsRef = useRef(null)
  const toast = useToast()
  usePageTitle('Vendor Quotes')

  const load = useCallback(() => {
    let current = true
    Promise.all([api(`/campaigns/${id}`), api(`/campaigns/${id}/vendor-quotes`)])
      .then(([{ campaign }, { quotes, summary }]) => current && setState({ status: 'ready', campaign, quotes, summary }))
      .catch((error) => current && setState((shown) => (shown.status === 'ready' ? shown : { status: 'error', message: error.message })))
    return () => {
      current = false
    }
  }, [id])

  useEffect(load, [load])
  const paged = usePaged(state.quotes ?? [], QUOTES_PER_PAGE)

  const heading = <PageHeading back={{ to: `/campaigns/${id}`, label: 'Back to Campaign' }} />
  if (state.status !== 'ready') {
    return (
      <AppShell heading={heading}>
        {state.status === 'loading' ? <PageSkeleton layout="detail" label="Please wait, loading vendor quotes…" /> : <FormAlert>{state.message}</FormAlert>}
      </AppShell>
    )
  }

  const { campaign, quotes, summary } = state
  const selectedId = campaign.selectedQuoteId
  const focused = quotes.find((quote) => quote.id === focusId) ?? quotes.find((quote) => quote.id === selectedId) ?? quotes[0]
  const canSelect = isAdmin && CAN_SELECT.includes(campaign.status)

  return (
    <AppShell heading={heading}>
      <div className={styles.page}>
        <header className={styles.intro}>
          <StatusBadge status={campaign.status} />
          <h1 className={styles.title}>Vendor Quotes</h1>
          <p className={styles.subtitle}>Compare quotes from vendors, review details, and select the best option for your repair project.</p>
        </header>

        <dl className={styles.strip}>
          <Fact icon={MapPin} label="Location" value={[estate?.name, estate?.address].filter(Boolean).join(', ')} />
          <Fact icon={Wrench} label="Campaign Type" value={`${categoryLabel(campaign.category)} Repair`} />
          <Fact icon={Target} label="Target Amount" value={formatNaira(campaign.targetAmount)} />
          <Fact icon={CalendarDays} label="Deadline" value={campaign.deadline ? formatDate(campaign.deadline) : 'Not set'} />
        </dl>

        <div className={styles.layout}>
          <div className={styles.main}>
            <section className={`${shared.card} ${styles.listCard}`} aria-labelledby="quotes-title" ref={listRef}>
              <CampaignTabs campaignId={id} />
              <div className={styles.listHead}>
                <span className={styles.listIcon} aria-hidden="true">
                  <FileText />
                </span>
                <div>
                  <h2 id="quotes-title" className={shared.cardTitle}>
                    Vendor Quotes ({quotes.length})
                  </h2>
                  <p className={shared.cardText}>
                    {summary.lowest != null
                      ? `Lowest ${formatNaira(summary.lowest)} · Highest ${formatNaira(summary.highest)} · Average ${formatNaira(summary.average)}`
                      : 'No quotes yet. Collect at least two so the community can compare.'}
                  </p>
                </div>
                {isAdmin && CAN_ADD.includes(campaign.status) && (
                  <button type="button" className={`${shared.secondary} ${styles.add}`} onClick={() => setAdding(true)}>
                    <Plus size={17} aria-hidden="true" /> Add Vendor Quote
                  </button>
                )}
              </div>

              {quotes.length > 0 && (
                <div className={styles.table}>
                  <div className={styles.headRow} aria-hidden="true">
                    <span>#</span>
                    <span>Vendor</span>
                    <span>Service Details</span>
                    <span>Amount (₦)</span>
                    <span>Timeline</span>
                    <span>Status</span>
                    <span>Actions</span>
                  </div>
                  <ol className={styles.rows}>
                    {paged.rows.map((quote, index) => (
                      <QuoteRow
                        key={quote.id}
                        quote={quote}
                        number={paged.from + index}
                        selectedId={selectedId}
                        lowest={summary.lowest}
                        focused={focused?.id === quote.id}
                        canSelect={canSelect}
                        onView={() => {
                          setFocusId(quote.id)
                          // When the details sit below the list (laptops, phones), bring them into view.
                          const box = detailsRef.current?.getBoundingClientRect()
                          if (box && box.top > window.innerHeight) detailsRef.current.scrollIntoView({ behavior: 'smooth' })
                        }}
                        onSelect={() => setSelecting(quote)}
                      />
                    ))}
                  </ol>
                  <Pagination paged={paged} noun="quotes" />
                </div>
              )}
            </section>

            <NextSteps campaign={campaign} isAdmin={isAdmin} />
          </div>

          <aside className={styles.side}>
            <section className={shared.card} aria-labelledby="comparison-title">
              <div className={styles.sideHead}>
                <BarChart3 aria-hidden="true" />
                <div>
                  <h2 id="comparison-title" className={shared.cardTitle}>
                    Quote Comparison
                  </h2>
                  <p className={shared.cardText}>Quick overview of all vendors</p>
                </div>
              </div>
              <QuoteComparison quotes={quotes} selectedId={selectedId} />
            </section>

            {focused && (
              <VendorDetails
                ref={detailsRef}
                quote={focused}
                selected={focused.id === selectedId}
                canSelect={canSelect}
                onSelect={() => setSelecting(focused)}
                onViewAll={() => listRef.current?.scrollIntoView({ behavior: 'smooth' })}
              />
            )}
          </aside>
        </div>
      </div>

      {adding && (
        <AddQuote
          campaignId={id}
          onClose={() => setAdding(false)}
          onAdded={(quote) => {
            setAdding(false)
            toast.success(`Quote from ${quote.vendorName} added`)
            setFocusId(quote.id)
            load()
          }}
        />
      )}
      {selecting && (
        <SelectVendor
          quote={selecting}
          lowest={summary.lowest}
          current={quotes.find((quote) => quote.id === selectedId)}
          onClose={() => setSelecting(null)}
          onSelected={() => {
            toast.success(`${selecting.vendorName} selected as the vendor. Residents have been told.`)
            setSelecting(null)
            setFocusId(selecting.id)
            load()
          }}
        />
      )}
    </AppShell>
  )
}

function Fact({ icon: Icon, label, value }) {
  return (
    <div className={styles.fact}>
      <Icon aria-hidden="true" />
      <span>
        <dd>{value}</dd>
        <dt>{label}</dt>
      </span>
    </div>
  )
}

// Where a quote stands. Before a choice, the cheapest is marked "Lowest".
function quoteStatus(quote, selectedId, lowest) {
  if (quote.id === selectedId) return { label: 'Selected', className: 'selected' }
  if (selectedId) return { label: 'Not Selected', className: 'passed' }
  if (quote.quotedAmount === lowest) return { label: 'Lowest', className: 'lowest' }
  return { label: 'Under Review', className: 'review' }
}

function QuoteRow({ quote, number, selectedId, lowest, focused, canSelect, onView, onSelect }) {
  const [menu, setMenu] = useState(false)
  const status = quoteStatus(quote, selectedId, lowest)
  const bullets = [...(quote.inclusions ?? []), quote.warrantyMonths ? `${quote.warrantyMonths} months warranty` : null].filter(Boolean)

  return (
    <li className={`${styles.row} ${focused ? styles.focusedRow : ''}`}>
      <span className={styles.number}>{String(number).padStart(2, '0')}</span>
      <div className={styles.vendor}>
        <span className={styles.avatar} aria-hidden="true">
          {initials(quote.vendorName)}
        </span>
        <span>
          <strong>{quote.vendorName}</strong>
          {quote.attachmentUrl && (
            <a href={quote.attachmentUrl} target="_blank" rel="noreferrer" className={styles.attached}>
              Quote attached
            </a>
          )}
        </span>
      </div>
      <div className={styles.service}>
        <span className={styles.label}>Service Details</span>
        <strong>{quote.scope || 'Repair works'}</strong>
        {bullets.length > 0 && (
          <ul>
            {bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>
      <div className={styles.amount}>
        <span className={styles.label}>Amount</span>
        {formatNaira(quote.quotedAmount)}
      </div>
      <div className={styles.timeline}>
        <span className={styles.label}>Timeline</span>
        <CalendarDays aria-hidden="true" />
        <span>
          {quote.deliveryDays ? `${quote.deliveryDays} days` : 'Not given'}
          <small>Quoted {formatDate(quote.submittedAt)}</small>
        </span>
      </div>
      <div>
        <span className={`${styles.pill} ${styles[status.className]}`}>{status.label}</span>
      </div>
      <div className={styles.actions}>
        <button type="button" className={quote.id === selectedId ? styles.viewPrimary : styles.view} onClick={onView}>
          View Details
        </button>
        {(canSelect || quote.attachmentUrl) && (
          <div className={styles.menuWrap}>
            <button type="button" className={styles.kebab} aria-label={`More actions for ${quote.vendorName}`} aria-expanded={menu} onClick={() => setMenu((open) => !open)}>
              <MoreVertical size={18} />
            </button>
            {menu && (
              <div className={styles.menu} role="menu" onMouseLeave={() => setMenu(false)}>
                {canSelect && quote.id !== selectedId && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenu(false)
                      onSelect()
                    }}
                  >
                    Select this vendor
                  </button>
                )}
                {quote.attachmentUrl && (
                  <a role="menuitem" href={quote.attachmentUrl} target="_blank" rel="noreferrer">
                    Open quote document
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

function VendorDetails({ ref, quote, selected, canSelect, onSelect, onViewAll }) {
  const contact = [
    [UserRound, 'Contact Person', quote.contactPerson],
    [Phone, 'Phone Number', quote.vendorPhone],
    [Mail, 'Email', quote.vendorEmail],
    [MapPin, 'Business Address', quote.vendorAddress],
  ].filter(([, , value]) => value)

  return (
    <section ref={ref} className={shared.card} aria-labelledby="vendor-title">
      <h2 className={`${shared.cardTitle} ${styles.detailsTitle}`}>
        {selected && <Crown aria-hidden="true" className={styles.crown} />}
        {selected ? 'Selected Vendor Details' : 'Vendor Details'}
      </h2>
      <div className={styles.vendorCard}>
        <span className={styles.bigAvatar} aria-hidden="true">
          {initials(quote.vendorName)}
        </span>
        <div>
          <h3 id="vendor-title">{quote.vendorName}</h3>
          <p className={styles.bigAmount}>{formatNaira(quote.quotedAmount)}</p>
          {quote.attachmentUrl && (
            <a href={quote.attachmentUrl} target="_blank" rel="noreferrer" className={styles.attached}>
              Quote attached
            </a>
          )}
        </div>
      </div>

      <dl className={styles.contact}>
        {contact.map(([Icon, label, value]) => (
          <div key={label}>
            <Icon aria-hidden="true" />
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        {quote.deliveryDays && (
          <div>
            <Timer aria-hidden="true" />
            <dt>Delivery Time</dt>
            <dd>{quote.deliveryDays} days</dd>
          </div>
        )}
        {contact.length === 0 && !quote.deliveryDays && <p className={styles.noContact}>No contact details were added with this quote.</p>}
      </dl>

      {quote.notes && <p className={styles.notes}>{quote.notes}</p>}

      <p className={`${shared.note} ${styles.selectionNote}`}>
        <CircleCheck aria-hidden="true" className={styles.noteTick} />
        <span>
          {selected
            ? `This vendor has been selected for the campaign${quote.selectionReason ? `. Reason: “${quote.selectionReason}”` : '.'} You can still review other quotes before the repair is finished.`
            : 'Compare this quote with the others before choosing. Anything but the cheapest needs a written reason, which residents can see.'}
        </span>
      </p>

      <div className={styles.detailActions}>
        <button type="button" className={shared.secondary} onClick={onViewAll}>
          View All Quotes
        </button>
        {canSelect && !selected && (
          <Button onClick={onSelect} className={styles.selectButton}>
            Select This Vendor
          </Button>
        )}
        {canSelect && selected && (
          <Button onClick={onViewAll} className={styles.selectButton}>
            Change Selection
          </Button>
        )}
      </div>
    </section>
  )
}

function NextSteps({ campaign, isAdmin }) {
  const steps = {
    draft: ['Publish the campaign first', 'Vendors can be compared now, but one can only be selected once the campaign is published.'],
    fundraising: [
      'Next Steps',
      'Select the vendor for the repair. Choosing one moves the campaign into repairs and tells every resident who was picked and why.',
    ],
    repairing: [
      'Next Steps',
      'Once the vendor has finished, mark the repair complete with the actual cost. That triggers the automatic reconciliation.',
    ],
    completed: ['Repair complete', 'The work is done. The fund is being reconciled against the actual cost.'],
    reconciled: ['Fully reconciled', 'Every refund and balance has been worked out. See the transparency report for the full record.'],
  }[campaign.status]

  return (
    <section className={styles.next}>
      <span className={styles.nextIcon} aria-hidden="true">
        <ClipboardList />
      </span>
      <div>
        <h2>{steps[0]}</h2>
        <p>{steps[1]}</p>
      </div>
      {isAdmin && campaign.status === 'repairing' && (
        <Link to={`/campaigns/${campaign.id}/reconciliation`} className={styles.nextButton}>
          Mark Repair Complete <ArrowRight size={17} aria-hidden="true" />
        </Link>
      )}
      {campaign.status === 'reconciled' && (
        <Link to={`/campaigns/${campaign.id}/report`} className={styles.nextButton}>
          View Report <ArrowRight size={17} aria-hidden="true" />
        </Link>
      )}
    </section>
  )
}

/* ---------------------------------------------------------------- Dialogs */

const EMPTY_QUOTE = {
  vendorName: '',
  amount: '',
  contactPerson: '',
  vendorPhone: '',
  vendorEmail: '',
  vendorAddress: '',
  scope: '',
  inclusions: '',
  deliveryDays: '',
  warrantyMonths: '',
  notes: '',
}

function AddQuote({ campaignId, onClose, onAdded }) {
  const [form, setForm] = useState(EMPTY_QUOTE)
  const [attachmentUrl, setAttachmentUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState({})
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (field) => (event) => setForm((shown) => ({ ...shown, [field]: event.target.value }))

  async function attach(file) {
    if (!file) return
    setUploading(true)
    try {
      setAttachmentUrl(await uploadImage(file, 'quote'))
    } catch (error) {
      setProblem(error.message)
    } finally {
      setUploading(false)
    }
  }

  async function submit(event) {
    event.preventDefault()
    const found = {}
    if (form.vendorName.trim().length < 2) found.vendorName = 'Enter the vendor name'
    if (!parseNaira(form.amount)) found.quotedAmount = 'Enter the quoted amount'
    setErrors(found)
    setProblem('')
    if (Object.keys(found).length) return

    const optional = (value) => value.trim() || undefined
    const whole = (value) => (parseNaira(value) != null ? parseNaira(value) : undefined)
    setBusy(true)
    try {
      const { quote } = await api(`/campaigns/${campaignId}/vendor-quotes`, {
        method: 'POST',
        body: {
          vendorName: form.vendorName.trim(),
          quotedAmount: parseNaira(form.amount),
          contactPerson: optional(form.contactPerson),
          vendorPhone: optional(form.vendorPhone),
          vendorEmail: optional(form.vendorEmail),
          vendorAddress: optional(form.vendorAddress),
          scope: optional(form.scope),
          inclusions: form.inclusions
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(0, 8),
          deliveryDays: whole(form.deliveryDays) || undefined,
          warrantyMonths: whole(form.warrantyMonths),
          notes: optional(form.notes),
          attachmentUrl: attachmentUrl ?? undefined,
        },
      })
      onAdded(quote)
    } catch (error) {
      const fieldErrors = {}
      for (const detail of error.details ?? []) fieldErrors[detail.field] = detail.message
      setErrors(fieldErrors)
      setProblem(error.message)
      setBusy(false)
    }
  }

  return (
    <Modal title="Add Vendor Quote" description="Record a quote exactly as the vendor gave it. Residents can see every quote." onClose={onClose} wide>
      <form onSubmit={submit} noValidate className={styles.quoteForm}>
        <FormField label="Vendor Name" required icon={Wrench} value={form.vendorName} onChange={set('vendorName')} error={errors.vendorName} placeholder="e.g. Sunvolt Electrical Services" />
        <FormField
          label="Quoted Amount (₦)"
          required
          icon={CircleDollarSign}
          inputMode="numeric"
          value={groupDigits(parseNaira(form.amount))}
          onChange={set('amount')}
          error={errors.quotedAmount}
          placeholder="e.g. 2,750,000"
        />
        <FormField label="Contact Person" optional icon={UserRound} value={form.contactPerson} onChange={set('contactPerson')} />
        <FormField label="Phone Number" optional icon={Phone} type="tel" value={form.vendorPhone} onChange={set('vendorPhone')} error={errors.vendorPhone} />
        <FormField label="Email" optional icon={Mail} type="email" value={form.vendorEmail} onChange={set('vendorEmail')} error={errors.vendorEmail} />
        <FormField label="Business Address" optional icon={MapPin} value={form.vendorAddress} onChange={set('vendorAddress')} />
        <FormField label="Service" optional icon={FileText} value={form.scope} onChange={set('scope')} placeholder="e.g. Transformer Replacement (100kVA)" className={styles.wide} />
        <FormField
          label="What’s Included"
          optional
          as="textarea"
          rows={3}
          value={form.inclusions}
          onChange={set('inclusions')}
          placeholder={'One per line, e.g.\nSupply & installation\nIncludes testing & commissioning'}
          className={styles.wide}
          error={errors.inclusions}
        />
        <FormField label="Delivery Time (days)" optional icon={Timer} inputMode="numeric" value={form.deliveryDays} onChange={set('deliveryDays')} error={errors.deliveryDays} />
        <FormField label="Warranty (months)" optional icon={ShieldCheck} inputMode="numeric" value={form.warrantyMonths} onChange={set('warrantyMonths')} error={errors.warrantyMonths} />
        <FormField label="Notes" optional as="textarea" rows={2} value={form.notes} onChange={set('notes')} className={styles.wide} />
        <div className={`${styles.wide} ${styles.attach}`}>
          <span>Quote Document or Photo (optional)</span>
          <label className={shared.secondary}>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/heic" hidden onChange={(event) => attach(event.target.files?.[0])} />
            {uploading ? 'Uploading…' : attachmentUrl ? 'Attached ✓ Change' : 'Attach image'}
          </label>
        </div>
        {problem && (
          <div className={styles.wide}>
            <FormAlert>{problem}</FormAlert>
          </div>
        )}
        <div className={`${styles.wide} ${styles.modalActions}`}>
          <button type="button" className={shared.secondary} onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" busy={busy} disabled={uploading}>
            Add Quote
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function SelectVendor({ quote, lowest, current, onClose, onSelected }) {
  const cheapest = quote.quotedAmount <= lowest
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function confirm(event) {
    event.preventDefault()
    if (!cheapest && reason.trim().length < 5) return setError('Explain why this vendor was chosen over the cheapest quote')
    setBusy(true)
    setError('')
    try {
      await api(`/vendor-quotes/${quote.id}/select`, { method: 'PUT', body: cheapest ? {} : { reason: reason.trim() } })
      onSelected()
    } catch (problem) {
      setError(problem.fieldMessage?.('reason') ?? problem.message)
      setBusy(false)
    }
  }

  return (
    <Modal title={`Select ${quote.vendorName}?`} onClose={onClose}>
      <form onSubmit={confirm} className={styles.selectForm} noValidate>
        <p>
          {formatNaira(quote.quotedAmount)} for the repair.
          {current ? ` This replaces ${current.vendorName} as the chosen vendor.` : ' The campaign moves into repairs.'} Every resident is notified.
        </p>
        {!cheapest && (
          <FormField
            label="Why this vendor?"
            required
            as="textarea"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            hint={`The lowest quote is ${formatNaira(lowest)}. Your reason is recorded in the audit trail residents can see.`}
            placeholder="e.g. Only vendor offering a 2-year warranty"
          />
        )}
        {error && <FormAlert>{error}</FormAlert>}
        <div className={styles.modalActions}>
          <button type="button" className={shared.secondary} onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" busy={busy}>
            Select Vendor
          </Button>
        </div>
      </form>
    </Modal>
  )
}
