import {
  ArrowLeft,
  Calculator,
  CalendarDays,
  CircleCheck,
  CircleDollarSign,
  Eye,
  House,
  ImagePlus,
  Info,
  Lightbulb,
  MapPin,
  ShieldCheck,
  Tag,
  Target,
  Timer,
  UsersRound,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/AuthContext.js'
import { Button } from '../../components/Button.jsx'
import { AppShell } from '../../components/dashboard/AppShell.jsx'
import { FormField } from '../../components/dashboard/FormField.jsx'
import { PageHeading } from '../../components/dashboard/PageHeading.jsx'
import { PaymentDetailsForm } from '../../components/dashboard/PaymentDetailsForm.jsx'
import { Pylons } from '../../components/dashboard/Pylons.jsx'
import { StatusBadge } from '../../components/dashboard/StatusBadge.jsx'
import { Stepper } from '../../components/dashboard/Stepper.jsx'
import { FormAlert } from '../../components/FormAlert.jsx'
import { PageSkeleton } from '../../components/Loading.jsx'
import { useToast } from '../../components/ToastContext.js'
import { api, uploadImage } from '../../lib/api.js'
import { CATEGORIES, categoryLabel, dayFromToday, groupDigits, parseNaira } from '../../lib/campaigns.js'
import { daysUntil, formatDate, formatNaira } from '../../lib/format.js'
import { sizedPhoto } from '../../lib/images.js'
import { usePageTitle } from '../../lib/usePageTitle.js'
import shared from './campaigns.module.css'
import styles from './CreateCampaign.module.css'

const STEPS = ['Basic Information', 'Levy & Target', 'Review & Publish']
const TITLE_MAX = 100
const DESCRIPTION_MAX = 500
const COMPLETION_OPTIONS = [7, 14, 21, 30, 45, 60, 90]

// Which step each API field is entered on, so a server error opens the right step.
const FIELD_STEP = {
  title: 1,
  description: 1,
  category: 1,
  deadline: 1,
  imageUrl: 1,
  targetAmount: 2,
  totalHouseholds: 2,
  totalUnits: 2,
  levyMethod: 2,
  bankName: 3,
  accountName: 3,
  accountNumber: 3,
}

// Create Campaign, from REPAIR-CAMPAIGN-SCREEN.png (step 1) and
// Levy & Target-Screen-Design.png (step 2). Also edits a draft at /campaigns/:id/edit.
export default function CreateCampaign() {
  const { id: draftId } = useParams()
  const { profile, estate, refresh } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  usePageTitle(draftId ? 'Edit Campaign' : 'Create Campaign')

  const [step, setStep] = useState(1)
  const [form, setForm] = useState(() => ({
    title: '',
    description: '',
    category: 'transformer',
    deadline: dayFromToday(30),
    imageUrl: null,
    levyMethod: 'flat',
    levy: null,
    target: null,
    households: estate?.totalHouseholds ?? null,
    units: estate?.totalUnits ?? null,
    paymentDetails: null,
  }))
  const [errors, setErrors] = useState({})
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(null) // 'draft' | 'publish'
  const [loading, setLoading] = useState(Boolean(draftId))

  // Editing a draft: start from what's saved.
  useEffect(() => {
    if (!draftId) return undefined
    let current = true
    api(`/campaigns/${draftId}`)
      .then(({ campaign }) => {
        if (!current) return
        if (campaign.status !== 'draft') return navigate(`/campaigns/${draftId}`, { replace: true })
        setForm((shown) => ({
          ...shown,
          title: campaign.title,
          description: campaign.description,
          category: campaign.category,
          deadline: campaign.deadline,
          imageUrl: campaign.imageUrl,
          levyMethod: campaign.levyMethod,
          target: campaign.targetAmount,
          levy: campaign.levyMethod === 'per_unit' ? campaign.levyPerUnit : campaign.levyPerHousehold,
          paymentDetails: campaign.paymentDetails,
        }))
        setLoading(false)
      })
      .catch((error) => {
        if (current) {
          setProblem(error.message)
          setLoading(false)
        }
      })
    return () => {
      current = false
    }
  }, [draftId, navigate])

  if (profile.role !== 'admin') return <Navigate to="/campaigns" replace />

  const update = (changes) => {
    setForm((shown) => ({ ...shown, ...changes }))
    setErrors((shown) => {
      const next = { ...shown }
      for (const field of Object.keys(changes)) {
        delete next[field]
        if (field === 'households' || field === 'units') delete next.count
      }
      return next
    })
  }
  const count = form.levyMethod === 'per_unit' ? form.units : form.households

  function validate(upTo) {
    const found = {}
    if (upTo >= 1) {
      if (form.title.trim().length < 4) found.title = 'Give the campaign a clearer title'
      if (form.description.trim().length < 10) found.description = 'Describe the repair in a little more detail'
      if (form.deadline && form.deadline <= dayFromToday(0)) found.deadline = 'Pick a date after today'
    }
    if (upTo >= 2) {
      if (!form.levy) found.levy = 'Enter how much each household pays'
      if (!count) found.count = form.levyMethod === 'per_unit' ? 'Enter the total number of units' : 'Enter the number of households'
    }
    return found
  }

  function goTo(next) {
    const found = validate(Math.min(next - 1, 2))
    setErrors(found)
    setProblem('')
    if (Object.keys(found).length) {
      setStep(Math.min(...Object.keys(found).map((field) => (field === 'levy' || field === 'count' ? 2 : 1))))
      return
    }
    setStep(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function save(publish) {
    const found = validate(2)
    const details = form.paymentDetails
    const hasDetails = details && (details.bankName || details.accountName || details.accountNumber)
    if (publish && !hasDetails) found.paymentDetails = 'Add the account residents should pay into before publishing'
    setErrors(found)
    setProblem('')
    if (Object.keys(found).length) {
      if (found.title || found.description || found.deadline) setStep(1)
      else if (found.levy || found.count) setStep(2)
      return
    }

    setBusy(publish ? 'publish' : 'draft')
    try {
      // The levy is split across the estate's households (or units), so save that count first.
      const countField = form.levyMethod === 'per_unit' ? 'totalUnits' : 'totalHouseholds'
      if (estate[countField] !== count) {
        await api(`/estates/${estate.id}`, { method: 'PUT', body: { [countField]: count } })
      }

      const body = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        targetAmount: form.levy * count,
        levyMethod: form.levyMethod,
        deadline: form.deadline || null,
        imageUrl: form.imageUrl,
      }
      let campaignId = draftId
      if (draftId) {
        await api(`/campaigns/${draftId}`, { method: 'PUT', body })
        if (hasDetails) await api(`/campaigns/${draftId}/payment-details`, { method: 'PUT', body: details })
      } else {
        const { campaign } = await api('/campaigns', { method: 'POST', body: { ...body, paymentDetails: hasDetails ? details : null } })
        campaignId = campaign.id
      }
      if (publish) await api(`/campaigns/${campaignId}/publish`, { method: 'POST' })

      refresh()
      toast.success(publish ? 'Campaign published. Residents can now see it and contribute.' : 'Draft saved. Only admins can see it until you publish.')
      navigate(`/campaigns/${campaignId}`)
    } catch (error) {
      const fieldErrors = {}
      for (const detail of error.details ?? []) {
        const field = detail.field.replace(/^paymentDetails\./, '')
        const key = field === 'targetAmount' ? 'levy' : field === 'totalHouseholds' || field === 'totalUnits' ? 'count' : field
        fieldErrors[key] = detail.message
      }
      setErrors(fieldErrors)
      const steps = (error.details ?? []).map((detail) => FIELD_STEP[detail.field.replace(/^paymentDetails\./, '')] ?? 3)
      if (steps.length) setStep(Math.min(...steps))
      setProblem(error.message)
      setBusy(null)
    }
  }

  const heading =
    step === 2 ? (
      <PageHeading back={{ to: '/dashboard', label: 'Back to Dashboard' }} title="Levy & Target" subtitle="Set the contribution details for your community." />
    ) : step === 3 ? (
      <PageHeading back={{ to: '/dashboard', label: 'Back to Dashboard' }} title="Review & Publish" subtitle="Check everything, add where residents pay, then publish." />
    ) : (
      <PageHeading
        eyebrow={draftId ? 'Edit Campaign' : 'Create Campaign'}
        title="Start a New Repair Campaign"
        subtitle="Help your community raise funds, track progress and ensure full transparency for infrastructure repairs."
      />
    )

  if (loading) {
    return (
      <AppShell heading={heading}>
        <PageSkeleton layout="form" label="Please wait, loading your draft…" />
      </AppShell>
    )
  }

  return (
    <AppShell heading={heading}>
      <div className={styles.page}>
        <Stepper steps={STEPS} current={step} onSelect={setStep} />
        {problem && <FormAlert>{problem}</FormAlert>}

        {step === 1 && <StepBasics form={form} estate={estate} errors={errors} update={update} onNext={() => goTo(2)} count={count} />}
        {step === 2 && <StepLevy form={form} estate={estate} errors={errors} update={update} count={count} onBack={() => setStep(1)} onNext={() => goTo(3)} />}
        {step === 3 && (
          <StepReview form={form} estate={estate} errors={errors} update={update} count={count} busy={busy} onBack={() => setStep(2)} onEdit={setStep} onSave={save} />
        )}
      </div>
    </AppShell>
  )
}

/* ---------------------------------------------------------------- Step 1 */

function StepBasics({ form, estate, errors, update, onNext, count }) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInput = useRef(null)

  async function upload(file) {
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      update({ imageUrl: await uploadImage(file, 'campaign') })
    } catch (error) {
      setUploadError(error.message)
    } finally {
      setUploading(false)
    }
  }

  // The target can be typed here; it sets the levy from the households known so far.
  const setTarget = (text) => {
    const target = parseNaira(text)
    update({ target, levy: target && count ? Math.ceil(target / count) : form.levy })
  }
  const target = form.levy && count ? form.levy * count : form.target
  const category = CATEGORIES.find((option) => option.value === form.category) ?? CATEGORIES[0]

  return (
    <div className={styles.threeColumns}>
      <section className={shared.card} aria-labelledby="basics-title">
        <header className={styles.stepHead}>
          <span className={styles.stepNumber} aria-hidden="true">
            1
          </span>
          <div>
            <h2 id="basics-title" className={styles.stepTitle}>
              Basic Information
            </h2>
            <p className={shared.cardText}>Tell us what needs to be repaired and where.</p>
          </div>
        </header>

        <div className={styles.grid}>
          <FormField
            label="Campaign Title"
            required
            placeholder="e.g. Transformer Repair Campaign"
            maxLength={TITLE_MAX}
            value={form.title}
            onChange={(event) => update({ title: event.target.value })}
            error={errors.title}
            counter={`${form.title.length}/${TITLE_MAX}`}
          />
          <FormField
            label="Description"
            required
            as="textarea"
            rows={4}
            placeholder="What broke, who it affects, and what the repair involves."
            maxLength={DESCRIPTION_MAX}
            value={form.description}
            onChange={(event) => update({ description: event.target.value })}
            error={errors.description}
            counter={`${form.description.length}/${DESCRIPTION_MAX}`}
            className={styles.description}
          />
          <FormField label="Category" required as="select" icon={category.icon} value={form.category} onChange={(event) => update({ category: event.target.value })}>
            {CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FormField>
          <FormField label="Estate / Community" required icon={MapPin} value={estate.name} readOnly />
          <FormField
            label="Target Amount (₦)"
            required
            icon={CircleDollarSign}
            inputMode="numeric"
            placeholder="e.g. 2,400,000"
            value={groupDigits(target)}
            onChange={(event) => setTarget(event.target.value)}
            hint={count ? `Split across ${count} ${form.levyMethod === 'per_unit' ? 'units' : 'households'}` : 'You’ll set the households next'}
          />
          <FormField
            label="Per-Household Levy"
            required
            as="select"
            icon={House}
            value={form.levyMethod}
            onChange={(event) => update({ levyMethod: event.target.value })}
          >
            <option value="flat">Flat Split</option>
            <option value="per_unit">By Unit Count</option>
          </FormField>
        </div>

        <p className={`${shared.note} ${styles.levyNote}`}>
          <span className={shared.noteIcon} aria-hidden="true">
            <Info />
          </span>
          <span>
            With a flat split, every household contributes the same amount.
            <br />
            You can also choose to set the levy based on unit count if needed.
          </span>
        </p>

        <div className={styles.grid}>
          <FormField
            label="Estimated Deadline"
            type="date"
            icon={CalendarDays}
            min={dayFromToday(1)}
            value={form.deadline ?? ''}
            onChange={(event) => update({ deadline: event.target.value || null })}
            error={errors.deadline}
          />
          <div className={styles.upload}>
            <span className={styles.uploadLabel}>
              Upload Campaign Image <span>(optional)</span>
            </span>
            <button type="button" className={styles.dropzone} onClick={() => fileInput.current?.click()} disabled={uploading}>
              {form.imageUrl ? (
                <img src={sizedPhoto(form.imageUrl, 200)} alt="" className={styles.thumb} />
              ) : (
                <span className={styles.dropIcon} aria-hidden="true">
                  <ImagePlus />
                </span>
              )}
              <span>
                {uploading ? 'Uploading…' : form.imageUrl ? 'Change image' : 'Click to upload'}
                <small>PNG, JPG or WebP (max 4MB)</small>
              </span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/heic"
              hidden
              onChange={(event) => upload(event.target.files?.[0])}
            />
            {uploadError && <p className={styles.uploadError}>{uploadError}</p>}
          </div>
        </div>

        <div className={shared.actions}>
          <Link to="/campaigns" className={shared.secondary}>
            Cancel
          </Link>
          <Button arrow onClick={onNext} className={styles.next}>
            Next Step
          </Button>
        </div>
      </section>

      <CampaignPreview form={form} estate={estate} count={count} target={target} />

      <div className={styles.aside}>
        <TipsCard
          tips={[
            'Be clear and specific about the repair needed.',
            'Use a realistic target amount (get vendor quotes before finalizing).',
            'Set a fair levy based on your estate’s size or unit count.',
            'Add a good image to help people understand the project.',
          ]}
        />
        <section className={shared.card} aria-labelledby="categories-title">
          <h2 id="categories-title" className={`${shared.cardTitle} ${styles.asideTitle}`}>
            <Tag aria-hidden="true" /> Supported Categories
          </h2>
          <div className={styles.categories} role="radiogroup" aria-labelledby="categories-title">
            {CATEGORIES.map((option) => {
              const Icon = option.icon
              const checked = form.category === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  className={`${styles.categoryOption} ${checked ? styles.categoryChecked : ''}`}
                  onClick={() => update({ category: option.value })}
                >
                  <span className={styles.categoryIcon} aria-hidden="true">
                    <Icon />
                  </span>
                  <span className={styles.categoryText}>
                    <strong>{option.label}</strong>
                    {option.detail}
                  </span>
                  <span className={styles.radio} aria-hidden="true" />
                </button>
              )
            })}
          </div>
        </section>
        <div className={shared.encourage}>
          <strong>
            <ShieldCheck size={24} aria-hidden="true" /> Transparent. Fair. Community Driven.
          </strong>
          <p>Together, we can build stronger and more reliable communities.</p>
          <Pylons className={shared.pylons} />
        </div>
      </div>
    </div>
  )
}

// The live preview beside step 1: how residents will see the campaign.
function CampaignPreview({ form, estate, count, target }) {
  const category = CATEGORIES.find((option) => option.value === form.category)
  const place = [estate.name, estate.address].filter(Boolean).join(', ')

  return (
    <section className={`${shared.card} ${styles.preview}`} aria-labelledby="preview-title">
      <div className={shared.cardHead}>
        <h2 id="preview-title" className={shared.cardTitle}>
          <Eye aria-hidden="true" /> Campaign Preview
        </h2>
        <span className={styles.live}>
          <span aria-hidden="true" /> Live Preview
        </span>
      </div>
      <div className={styles.previewPhoto}>
        <img src={sizedPhoto(form.imageUrl, 600)} alt="" />
        <span className={styles.previewBadge}>
          <Zap size={13} aria-hidden="true" /> {category?.label}
        </span>
      </div>
      <h3 className={styles.previewTitle}>{form.title.trim() || 'Your campaign title'}</h3>
      <p className={styles.previewPlace}>
        <MapPin size={16} aria-hidden="true" /> {place}
      </p>
      <p className={styles.previewText}>{form.description.trim() || 'Your description will appear here.'}</p>

      <dl className={styles.previewFacts}>
        <div>
          <dt>
            <Tag aria-hidden="true" /> Category
          </dt>
          <dd>{category?.label}</dd>
        </div>
        <div>
          <dt>
            <Target aria-hidden="true" /> Target Amount
          </dt>
          <dd>{target ? formatNaira(target) : 'Not set'}</dd>
        </div>
        <div>
          <dt>
            <CalendarDays aria-hidden="true" /> Deadline
          </dt>
          <dd>{form.deadline ? formatDate(form.deadline) : 'Not set'}</dd>
        </div>
      </dl>

      <div className={styles.previewProgress}>
        <p>
          <span>Progress</span>
          <span>0%</span>
        </p>
        <span className={styles.previewBar} />
        <dl>
          <div>
            <dd>{formatNaira(0)}</dd>
            <dt>Collected</dt>
          </div>
          <div>
            <dd>{target ? formatNaira(target) : 'Not set'}</dd>
            <dt>Target Amount</dt>
          </div>
          <div>
            <dd>0 / {count || 0}</dd>
            <dt>Contributors</dt>
          </div>
        </dl>
      </div>

      <p className={`${shared.note} ${styles.previewNote}`}>
        <span className={shared.noteIcon} aria-hidden="true">
          <Info />
        </span>
        Your campaign will be visible to all contributors and can be shared with the community for full transparency.
      </p>
    </section>
  )
}

/* ---------------------------------------------------------------- Step 2 */

function StepLevy({ form, estate, errors, update, count, onBack, onNext }) {
  const perUnit = form.levyMethod === 'per_unit'
  const target = form.levy && count ? form.levy * count : null
  const days = daysUntil(form.deadline)
  const completion = COMPLETION_OPTIONS.includes(days) ? String(days) : 'custom'
  const countField = perUnit ? 'units' : 'households'

  return (
    <div className={styles.twoColumns}>
      <section className={shared.card} aria-labelledby="levy-title">
        <h2 id="levy-title" className={styles.stepTitle}>
          Levy & Target Settings
        </h2>
        <p className={shared.cardText}>Define how much to collect, how it will be split, and your target amount.</p>

        <fieldset className={styles.types}>
          <legend>Contribution Type</legend>
          {[
            { value: 'flat', icon: UsersRound, title: 'Flat Split', text: 'Same amount for every household.' },
            { value: 'per_unit', icon: House, title: 'By Unit Count', text: 'Different amounts based on units.' },
          ].map(({ value, icon: Icon, title, text }) => (
            <label key={value} className={`${styles.type} ${form.levyMethod === value ? styles.typeChecked : ''}`}>
              <input type="radio" name="levyMethod" value={value} checked={form.levyMethod === value} onChange={() => update({ levyMethod: value })} />
              <span className={styles.typeIcon} aria-hidden="true">
                <Icon />
              </span>
              <strong>{title}</strong>
              <span>{text}</span>
              <CircleCheck className={styles.typeTick} aria-hidden="true" />
            </label>
          ))}
        </fieldset>

        <div className={styles.grid}>
          <FormField
            label={perUnit ? 'Per-Unit Levy (₦)' : 'Per-Household Levy (₦)'}
            required
            inputMode="numeric"
            suffix="₦"
            placeholder="20,000"
            value={groupDigits(form.levy)}
            onChange={(event) => update({ levy: parseNaira(event.target.value) })}
            error={errors.levy}
            hint={perUnit ? 'Amount charged for each unit (a landlord with 4 flats pays 4×).' : 'Amount each household will contribute.'}
          />
          <FormField
            label={perUnit ? 'Total Units' : 'Estimated Households'}
            required
            inputMode="numeric"
            suffix={perUnit ? 'units' : 'hh'}
            placeholder="120"
            value={count ?? ''}
            onChange={(event) => {
              const value = parseNaira(event.target.value)
              // A target typed on step 1 becomes the levy once the count is known.
              const levy = !form.levy && form.target && value ? Math.ceil(form.target / value) : form.levy
              update({ [countField]: value, levy })
            }}
            error={errors.count}
            hint={perUnit ? 'Total number of units across the estate.' : 'Total number of households in this estate.'}
          />
          <FormField
            label="Target Amount"
            required
            icon={Calculator}
            value={target ? formatNaira(target) : ''}
            placeholder="Worked out from the levy"
            readOnly
            hint={`Total amount to be collected (auto-calculated from the levy × ${perUnit ? 'units' : 'households'}).`}
          />
          <FormField
            label="Estimated Completion Time"
            as="select"
            icon={Timer}
            value={completion}
            onChange={(event) => event.target.value !== 'custom' && update({ deadline: dayFromToday(Number(event.target.value)) })}
            hint="Sets the campaign deadline."
          >
            {completion === 'custom' && <option value="custom">{form.deadline ? `${days} days (${formatDate(form.deadline)})` : 'No deadline'}</option>}
            {COMPLETION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} days
              </option>
            ))}
          </FormField>
        </div>

        <section className={styles.breakdown} aria-labelledby="breakdown-title">
          <h3 id="breakdown-title">Contribution Breakdown</h3>
          <p>How the target amount will be distributed.</p>
          <ul>
            <li>
              <span className={styles.breakdownIcon} aria-hidden="true">
                <Zap />
              </span>
              <span>
                <strong>{form.title.trim() || 'Your campaign'}</strong>
                {categoryLabel(form.category)} repair
              </span>
              <span className={styles.breakdownValue}>
                <strong>{target ? formatNaira(target) : 'Not set'}</strong>
                (100%)
              </span>
            </li>
            <li>
              <span className={styles.breakdownIcon} aria-hidden="true">
                <UsersRound />
              </span>
              <span>
                <strong>{perUnit ? 'Total Units' : 'Total Households'}</strong>
                {perUnit ? 'Units across the estate' : 'Estimated households in this estate'}
              </span>
              <span className={styles.breakdownValue}>
                <strong>{count ?? 'Not set'}</strong>
                (100%)
              </span>
            </li>
            <li>
              <span className={styles.breakdownIcon} aria-hidden="true">
                <CircleDollarSign />
              </span>
              <span>
                <strong>{perUnit ? 'Per-Unit Levy' : 'Per-Household Levy'}</strong>
                {perUnit ? 'Amount charged for each unit' : 'Amount each household will contribute'}
              </span>
              <span className={styles.breakdownValue}>
                <strong>{form.levy ? formatNaira(form.levy) : 'Not set'}</strong>
                {perUnit ? '(per unit)' : '(per household)'}
              </span>
            </li>
          </ul>
        </section>

        <div className={shared.actions}>
          <button type="button" className={shared.secondary} onClick={onBack}>
            <ArrowLeft size={17} aria-hidden="true" /> Back
          </button>
          <Button arrow onClick={onNext} className={styles.next}>
            Next Step
          </Button>
        </div>
      </section>

      <div className={styles.aside}>
        <SummaryCard form={form} estate={estate} count={count} target={target} />
        <TipsCard
          tips={[
            'You can review and adjust the levy amount before publishing.',
            'The target amount is auto-calculated based on the levy and estimated households.',
            'You can change these details in the draft stage.',
          ]}
        />
        <div className={shared.promise}>
          <strong>
            <ShieldCheck size={26} aria-hidden="true" /> Transparent. Accountable. Together.
          </strong>
          <p>Every contribution is tracked, verified and reconciled for your community.</p>
          <Pylons className={shared.pylons} />
        </div>
      </div>
    </div>
  )
}

// The campaign card on the right of step 2 and on the review step.
function SummaryCard({ form, estate, count, target }) {
  const perUnit = form.levyMethod === 'per_unit'
  const days = daysUntil(form.deadline)

  return (
    <section className={`${shared.card} ${styles.summary}`} aria-label="Campaign summary">
      <div className={styles.summaryTop}>
        <img src={sizedPhoto(form.imageUrl, 240)} alt="" className={styles.summaryPhoto} />
        <div className={styles.summaryText}>
          <div className={styles.summaryTitleRow}>
            <h2>{form.title.trim() || 'Your campaign'}</h2>
            <StatusBadge status="draft" />
          </div>
          <p className={styles.summaryPlace}>
            <MapPin size={15} aria-hidden="true" /> {[estate.name, estate.address].filter(Boolean).join(', ')}
          </p>
          <p className={styles.summaryDescription}>{form.description.trim()}</p>
        </div>
      </div>
      <dl className={styles.summaryFacts}>
        <div>
          <dt>Category</dt>
          <dd>{categoryLabel(form.category)}</dd>
        </div>
        <div>
          <dt>Estate</dt>
          <dd>{estate.name}</dd>
        </div>
        <div>
          <dt>Target Amount</dt>
          <dd>{target ? formatNaira(target) : 'Not set'}</dd>
        </div>
        <div>
          <dt>Levy ({perUnit ? 'per unit' : 'per household'})</dt>
          <dd>{form.levy ? formatNaira(form.levy) : 'Not set'}</dd>
        </div>
      </dl>
      <div className={styles.summaryBoxes}>
        <div>
          <UsersRound aria-hidden="true" />
          <span>
            {perUnit ? 'Total Units' : 'Estimated Households'}
            <strong>{count ?? 'Not set'}</strong>
          </span>
        </div>
        <div>
          <CalendarDays aria-hidden="true" />
          <span>
            Estimated Completion
            <strong>{days != null ? `${days} days` : 'No deadline'}</strong>
          </span>
        </div>
      </div>
      <div className={styles.visibility}>
        <h3>Campaign Visibility</h3>
        <p>
          <Eye size={18} aria-hidden="true" /> Visible to community members only
        </p>
      </div>
    </section>
  )
}

function TipsCard({ tips }) {
  const [hidden, setHidden] = useState(false)
  if (hidden) return null
  return (
    <section className={shared.card} aria-labelledby="tips-title">
      <div className={shared.cardHead}>
        <h2 id="tips-title" className={shared.cardTitle}>
          <Lightbulb aria-hidden="true" /> Quick Tips
        </h2>
        <button type="button" className={styles.close} onClick={() => setHidden(true)} aria-label="Hide tips">
          <X size={18} />
        </button>
      </div>
      <ul className={shared.tips}>
        {tips.map((tip) => (
          <li key={tip}>
            <CircleCheck aria-hidden="true" />
            {tip}
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ---------------------------------------------------------------- Step 3 */

function StepReview({ form, estate, errors, update, count, busy, onBack, onEdit, onSave }) {
  const perUnit = form.levyMethod === 'per_unit'
  const target = form.levy && count ? form.levy * count : null
  const rows = [
    ['Title', form.title.trim(), 1],
    ['Category', categoryLabel(form.category), 1],
    ['Deadline', form.deadline ? formatDate(form.deadline) : 'Not set', 1],
    ['Contribution Type', perUnit ? 'By Unit Count' : 'Flat Split', 2],
    [perUnit ? 'Per-Unit Levy' : 'Per-Household Levy', form.levy ? formatNaira(form.levy) : 'Not set', 2],
    [perUnit ? 'Total Units' : 'Households', count ?? 'Not set', 2],
    ['Target Amount', target ? formatNaira(target) : 'Not set', 2],
  ]

  return (
    <div className={styles.twoColumns}>
      <section className={shared.card} aria-labelledby="review-title">
        <h2 id="review-title" className={styles.stepTitle}>
          Review Your Campaign
        </h2>
        <p className={shared.cardText}>Residents see these details once you publish. Terms are locked after publishing.</p>

        <dl className={styles.review}>
          {rows.map(([label, value, step]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
              <button type="button" onClick={() => onEdit(step)} aria-label={`Edit ${label.toLowerCase()}`}>
                Edit
              </button>
            </div>
          ))}
        </dl>

        <section className={styles.paymentSection} aria-labelledby="pay-title">
          <h3 id="pay-title">Where Residents Pay</h3>
          <p>The account shown to residents on Make a Contribution. You can still correct it after publishing.</p>
          <PaymentDetailsForm value={form.paymentDetails} onChange={(paymentDetails) => update({ paymentDetails })} errors={errors} />
          {errors.paymentDetails && <p className={styles.fieldError}>{errors.paymentDetails}</p>}
        </section>

        <div className={shared.actions}>
          <button type="button" className={shared.secondary} onClick={onBack}>
            <ArrowLeft size={17} aria-hidden="true" /> Back
          </button>
          <div className={styles.finalActions}>
            <button type="button" className={shared.secondary} onClick={() => onSave(false)} disabled={Boolean(busy)}>
              {busy === 'draft' ? 'Saving…' : 'Save as Draft'}
            </button>
            <Button arrow busy={busy === 'publish'} disabled={Boolean(busy)} onClick={() => onSave(true)} className={styles.next}>
              Publish Campaign
            </Button>
          </div>
        </div>
      </section>

      <div className={styles.aside}>
        <SummaryCard form={form} estate={estate} count={count} target={target} />
        <div className={shared.promise}>
          <strong>
            <ShieldCheck size={26} aria-hidden="true" /> Transparent. Accountable. Together.
          </strong>
          <p>Publishing tells every resident about the campaign and opens it for contributions.</p>
          <Pylons className={shared.pylons} />
        </div>
      </div>
    </div>
  )
}
