import {
  CalendarDays,
  Check,
  CircleCheck,
  CircleDollarSign,
  Copy,
  FileText,
  HandCoins,
  Info,
  Landmark,
  Lightbulb,
  Send,
  Target,
  UserRound,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../../auth/AuthContext.js'
import { Button } from '../../components/Button.jsx'
import { AppShell } from '../../components/dashboard/AppShell.jsx'
import { CampaignHeader } from '../../components/dashboard/CampaignHeader.jsx'
import { ContributionsTable } from '../../components/dashboard/ContributionsTable.jsx'
import { FormField } from '../../components/dashboard/FormField.jsx'
import { PageHeading } from '../../components/dashboard/PageHeading.jsx'
import { PaymentDetailsForm } from '../../components/dashboard/PaymentDetailsForm.jsx'
import { ProgressRing } from '../../components/dashboard/ProgressRing.jsx'
import { Pylons } from '../../components/dashboard/Pylons.jsx'
import { FormAlert } from '../../components/FormAlert.jsx'
import { api } from '../../lib/api.js'
import { PAYMENT_METHODS, acceptsContributions, groupDigits, methodLabel, parseNaira, transferReference } from '../../lib/campaigns.js'
import { formatDate, formatNaira } from '../../lib/format.js'
import { useCampaignData } from '../../lib/useCampaignData.js'
import { usePageTitle } from '../../lib/usePageTitle.js'
import shared from './campaigns.module.css'
import styles from './Contribute.module.css'

const MINIMUM = 1_000

// Make a Contribution, from transformer-repair-campaign-screen.png. Residents record a
// payment they've made (it waits for the lead to verify it); the lead can record money
// for any resident, which counts as verified straight away.
export default function Contribute() {
  const { id } = useParams()
  const { profile, estate } = useAuth()
  const data = useCampaignData(id)
  usePageTitle('Make a Contribution')

  const heading = <PageHeading back={{ to: `/campaigns/${id}`, label: 'Back to Campaign' }} />

  if (data.status !== 'ready') {
    return (
      <AppShell heading={heading}>
        {data.status === 'loading' ? <p className={shared.loading}>Loading the campaign…</p> : <FormAlert>{data.message}</FormAlert>}
      </AppShell>
    )
  }

  const { campaign, overview, contributions } = data

  return (
    <AppShell heading={heading}>
      <div className={styles.page}>
        <CampaignHeader campaign={campaign} estate={estate} photo="left" headingLevel={2} />

        <div className={styles.layout}>
          <section className={shared.card} aria-labelledby="contribute-title">
            <div className={styles.formHead}>
              <span className={styles.formIcon} aria-hidden="true">
                <HandCoins />
              </span>
              <div>
                <h1 id="contribute-title" className={shared.cardTitle}>
                  Make a Contribution
                </h1>
                <p className={shared.cardText}>Your contribution helps keep your community powered. Every naira counts.</p>
              </div>
            </div>
            {acceptsContributions(campaign) ? (
              <ContributionForm campaign={campaign} estate={estate} profile={profile} onRecorded={data.reload} />
            ) : (
              <p className={shared.note}>
                <span className={shared.noteIcon} aria-hidden="true">
                  <Info />
                </span>
                {campaign.status === 'draft'
                  ? 'This campaign isn’t published yet, so it can’t take contributions.'
                  : 'The repair is complete, so this campaign no longer takes contributions.'}
              </p>
            )}
          </section>

          <aside className={styles.side}>
            <section className={shared.card} aria-labelledby="progress-title">
              <h2 id="progress-title" className={`${shared.cardTitle} ${styles.sideTitle}`}>
                Campaign Progress
              </h2>
              <ProgressRing collected={campaign.totalCollected} target={campaign.targetAmount} />
              <div className={`${shared.tiles} ${styles.tiles}`}>
                <div className={shared.tile}>
                  <Users aria-hidden="true" />
                  <span>
                    Contributors
                    <strong>
                      {overview.contributors.paid} / {overview.contributors.total}
                    </strong>
                  </span>
                </div>
                <div className={shared.tile}>
                  <Target aria-hidden="true" />
                  <span>
                    Target Amount
                    <strong>{formatNaira(campaign.targetAmount)}</strong>
                  </span>
                </div>
                <div className={shared.tile}>
                  <CalendarDays aria-hidden="true" />
                  <span>
                    Deadline
                    <strong>{campaign.deadline ? formatDate(campaign.deadline) : 'Not set'}</strong>
                  </span>
                </div>
              </div>
            </section>

            <section className={shared.card} aria-labelledby="recent-title">
              <div className={shared.cardHead}>
                <h2 id="recent-title" className={shared.cardTitle}>
                  Recent Contributions
                </h2>
                <Link to={`/contributions?campaign=${id}`} className={shared.viewAll}>
                  View All
                </Link>
              </div>
              <ContributionsTable contributions={contributions.slice(0, 5)} last="method" />
            </section>

            <div className={shared.encourage}>
              <strong>
                <Lightbulb size={24} aria-hidden="true" /> Together we can make a difference
              </strong>
              <p>Your contribution, no matter the size, brings us closer to a safer and more reliable power supply for our community.</p>
              <Pylons className={shared.pylons} />
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}

function ContributionForm({ campaign, estate, profile, onRecorded }) {
  const isAdmin = profile.role === 'admin'
  const owed = campaign.myPayment?.balance
  const [amount, setAmount] = useState(owed ? String(owed) : '')
  const [method, setMethod] = useState('bank_transfer')
  const [payerId, setPayerId] = useState(profile.id)
  const [note, setNote] = useState('')
  const [residents, setResidents] = useState([])
  const [errors, setErrors] = useState({})
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)
  const [recorded, setRecorded] = useState(null)

  // Leads can record money for anyone in the estate.
  useEffect(() => {
    if (!isAdmin) return undefined
    let current = true
    api(`/estates/${estate.id}/residents`)
      .then(({ residents: list }) => current && setResidents(list.filter((person) => person.status !== 'suspended')))
      .catch(() => {})
    return () => {
      current = false
    }
  }, [isAdmin, estate.id])

  const payer = residents.find((person) => person.id === payerId) ?? profile
  const reference = transferReference(estate?.name, payer.name)

  async function submit(event) {
    event.preventDefault()
    const value = parseNaira(amount)
    const found = {}
    if (!value) found.amount = 'Enter the amount you paid'
    else if (value < MINIMUM) found.amount = `The minimum contribution is ${formatNaira(MINIMUM)}`
    setErrors(found)
    setProblem('')
    if (Object.keys(found).length) return

    setBusy(true)
    try {
      const { contribution } = await api(`/campaigns/${campaign.id}/contributions`, {
        method: 'POST',
        body: {
          amount: value,
          method,
          reference: note.trim() || (method === 'bank_transfer' ? reference : undefined),
          ...(isAdmin && payerId !== profile.id && { userId: payerId }),
        },
      })
      setRecorded(contribution)
      onRecorded()
    } catch (error) {
      const message = error.fieldMessage?.('amount')
      if (message) setErrors({ amount: message })
      else setProblem(error.message)
    } finally {
      setBusy(false)
    }
  }

  if (recorded) {
    const verified = recorded.status === 'verified'
    return (
      <div className={styles.done} role="status">
        <CircleCheck className={styles.doneIcon} aria-hidden="true" />
        <h2>{verified ? 'Contribution recorded and verified' : 'Contribution recorded'}</h2>
        <p>
          {formatNaira(recorded.amount)} by {methodLabel(recorded.method)}
          {verified
            ? ` for ${recorded.userName} now counts toward the target.`
            : ' is waiting for your community lead to check it against the bank alert. You’ll get a notification once it’s verified.'}
        </p>
        <div className={shared.actions}>
          <Link to={`/campaigns/${campaign.id}`} className={shared.secondary}>
            Back to Campaign
          </Link>
          <Button
            onClick={() => {
              setRecorded(null)
              setAmount('')
              setNote('')
            }}
          >
            Record Another
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className={styles.grid}>
        <FormField
          label="Amount (₦)"
          required
          icon={CircleDollarSign}
          inputMode="numeric"
          placeholder="e.g. 50,000"
          value={groupDigits(parseNaira(amount))}
          onChange={(event) => setAmount(event.target.value)}
          error={errors.amount}
          hint={`Minimum contribution: ${formatNaira(MINIMUM)}${owed ? ` · You still owe ${formatNaira(owed)}` : ''}`}
        />
        <FormField label="Payment Method" required as="select" icon={Landmark} value={method} onChange={(event) => setMethod(event.target.value)}>
          {PAYMENT_METHODS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </FormField>
        {isAdmin && residents.length > 0 ? (
          <FormField
            label="Payer Name"
            required
            as="select"
            icon={UserRound}
            value={payerId}
            onChange={(event) => setPayerId(event.target.value)}
            hint={payerId === profile.id ? 'Your own contribution' : 'Money you collected: it counts as verified straight away'}
          >
            {residents.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
                {person.unitNumber ? ` (${person.unitNumber})` : ''}
              </option>
            ))}
          </FormField>
        ) : (
          <FormField label="Payer Name" required icon={UserRound} value={profile.name} readOnly />
        )}
        <FormField
          label="Reference / Note"
          optional
          icon={FileText}
          placeholder="e.g. April contribution, rent, etc."
          maxLength={120}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <p className={`${shared.note} ${styles.note}`}>
        <span className={shared.noteIcon} aria-hidden="true">
          <Info />
        </span>
        <span>
          After submitting, you’ll get a confirmation with payment details.
          <br />
          Make sure to include your name or reference when making the transfer.
        </span>
      </p>

      {method === 'bank_transfer' && <PaymentDetails campaign={campaign} reference={reference} canEdit={isAdmin} onSaved={onRecorded} />}

      {problem && (
        <div className={styles.problem}>
          <FormAlert>{problem}</FormAlert>
        </div>
      )}

      <div className={shared.actions}>
        <Link to={`/campaigns/${campaign.id}`} className={shared.secondary}>
          Cancel
        </Link>
        <Button type="submit" busy={busy} className={styles.submit}>
          <Send size={17} aria-hidden="true" /> Submit Contribution
        </Button>
      </div>
    </form>
  )
}

function PaymentDetails({ campaign, reference, canEdit, onSaved }) {
  const details = campaign.paymentDetails
  const [editing, setEditing] = useState(false)

  return (
    <section className={styles.payment} aria-labelledby="payment-title">
      <h2 id="payment-title" className={styles.paymentTitle}>
        Payment Details
      </h2>
      <div className={styles.bank}>
        <span className={styles.bankIcon} aria-hidden="true">
          <Landmark />
        </span>
        <div>
          <strong>Bank Transfer</strong>
          <p>Use the details below to make your payment</p>
        </div>
      </div>

      {details && !editing ? (
        <dl className={styles.account}>
          <Detail label="Bank Name" value={details.bankName} />
          <Detail label="Account Name" value={details.accountName} />
          <Detail label="Account Number" value={details.accountNumber} copy />
          <Detail label="Reference" value={reference} copy />
        </dl>
      ) : canEdit ? (
        <PaymentDetailsForm
          value={details}
          onSave={async (next) => {
            await api(`/campaigns/${campaign.id}/payment-details`, { method: 'PUT', body: next })
            setEditing(false)
            onSaved()
          }}
        />
      ) : (
        <p className={styles.noAccount}>Your community lead hasn’t added the account details yet. Ask them where to pay before you transfer.</p>
      )}

      {details && canEdit && !editing && (
        <button type="button" className={styles.editAccount} onClick={() => setEditing(true)}>
          Change account details
        </button>
      )}
    </section>
  )
}

function Detail({ label, value, copy = false }) {
  const [copied, setCopied] = useState(false)

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked: the value is on screen to copy by hand.
    }
  }

  return (
    <div className={styles.detail}>
      <dt>{label}</dt>
      <dd>
        <span>{value}</span>
        {copy && (
          <button type="button" onClick={copyValue} aria-label={`Copy ${label.toLowerCase()}`} title="Copy">
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        )}
      </dd>
    </div>
  )
}
