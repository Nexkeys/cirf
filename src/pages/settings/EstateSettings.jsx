import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleCheck,
  Copy,
  Download,
  Hash,
  Mail,
  Phone,
  HandCoins,
  House,
  ImagePlus,
  LoaderCircle,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  UserRound,
  Users,
  Wrench,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthContext.js'
import { Button } from '../../components/Button.jsx'
import { AppShell } from '../../components/dashboard/AppShell.jsx'
import { FormField } from '../../components/dashboard/FormField.jsx'
import { Modal } from '../../components/dashboard/Modal.jsx'
import { PageHeading } from '../../components/dashboard/PageHeading.jsx'
import { Pagination } from '../../components/dashboard/Pagination.jsx'
import { Switch } from '../../components/dashboard/Switch.jsx'
import { FormAlert } from '../../components/FormAlert.jsx'
import { PageSkeleton } from '../../components/Loading.jsx'
import { useToast } from '../../components/ToastContext.js'
import { Photo } from '../../components/Photo.jsx'
import { api, uploadImage } from '../../lib/api.js'
import { dayFromToday, parseNaira, pickFeatured } from '../../lib/campaigns.js'
import { formatDate, initials } from '../../lib/format.js'
import { sizedPhoto } from '../../lib/images.js'
import { usePaged } from '../../lib/usePaged.js'
import shared from '../campaigns/campaigns.module.css'
import { ProfileForm } from './ProfileForm.jsx'
import styles from './settings.module.css'

const COMMUNITY_TYPES = {
  residential_estate: 'Residential Estate',
  street: 'Street',
  compound: 'Compound',
  other: 'Other Community',
}

const RESIDENTS_PER_PAGE = 10
const REQUESTS_PER_PAGE = 5
const INVITES_PER_PAGE = 5

const PAYMENT_LABELS = {
  paid: ['Paid', 'paid'],
  partial: ['Part Paid', 'pending'],
  pending: ['Awaiting Verification', 'pending'],
  unpaid: ['Not Paid', 'unpaid'],
}

// Estate Settings for community leads, from Estate-Settings-Design.png.
export default function EstateSettings() {
  const { profile, estate: authEstate, refresh } = useAuth()
  const [state, setState] = useState({ status: 'loading' })
  const [save, setSave] = useState('saved') // saved | saving | failed
  const [dialog, setDialog] = useState(null)
  const [section, setSection] = useState('details')
  const toast = useToast()
  const detailsRef = useRef(null)
  const residentsRef = useRef(null)
  const adminRef = useRef(null)
  const profileRef = useRef(null)

  const load = useCallback(() => {
    let current = true
    Promise.all([api(`/estates/${authEstate.id}`), api('/campaigns')])
      .then(async ([{ estate, stats }, { campaigns }]) => {
        const featured = pickFeatured(campaigns.filter((campaign) => campaign.status !== 'draft'))
        const people = await api(`/estates/${authEstate.id}/residents${featured ? `?campaignId=${featured.id}` : ''}`)
        if (current) setState({ status: 'ready', estate, stats, featured, ...people })
      })
      .catch((error) => current && setState((shown) => (shown.status === 'ready' ? shown : { status: 'error', message: error.message })))
    return () => {
      current = false
    }
  }, [authEstate.id])

  useEffect(load, [load])

  // Saves estate changes straight away, with "Saving…" / "All changes saved" at the top.
  async function saveEstate(changes) {
    setSave('saving')
    try {
      const { estate } = await api(`/estates/${authEstate.id}`, { method: 'PUT', body: changes })
      setState((shown) => ({ ...shown, estate }))
      setSave('saved')
      refresh()
      return estate
    } catch (error) {
      setSave('failed')
      throw error
    }
  }

  const heading = (
    <div className={styles.heading}>
      <PageHeading back={{ to: '/dashboard', label: 'Back to Dashboard' }} title="Estate Settings" subtitle="Manage your estate details, residents and community access." />
      <SaveStatus state={save} />
    </div>
  )

  if (state.status !== 'ready') {
    return (
      <AppShell heading={heading}>
        {state.status === 'loading' ? <PageSkeleton layout="detail" label="Please wait, loading your estate settings…" /> : <FormAlert>{state.message}</FormAlert>}
      </AppShell>
    )
  }

  const { estate, stats, residents, joinRequests, invites, paymentSummary, featured } = state
  const ownerId = estate.ownerId ?? estate.createdBy
  const isOwner = ownerId === profile.id
  const goTo = (key) => {
    setSection(key)
    const target = { details: detailsRef, residents: residentsRef, admin: adminRef, profile: profileRef }[key]
    target.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <AppShell heading={heading}>
      <div className={styles.page}>
        <nav className={styles.tabs} aria-label="Settings sections">
          {[
            ['details', 'Estate Details'],
            ['residents', 'Residents'],
            ['admin', 'Administration'],
            ['profile', 'My Profile'],
          ].map(([key, label]) => (
            <button key={key} type="button" className={section === key ? styles.activeTab : ''} onClick={() => goTo(key)}>
              {label}
            </button>
          ))}
        </nav>

        <div className={styles.layout}>
          <div className={styles.main}>
            <div ref={detailsRef} className={styles.anchor}>
              <EstateInfo estate={estate} onEdit={() => setDialog({ type: 'estate' })} onSave={saveEstate} />
            </div>

            <div className={styles.tiles}>
              <Tile icon={House} value={estate.totalHouseholds ?? 'Not set'} label="Households" />
              <Tile icon={Users} value={paymentSummary ? paymentSummary.paid + paymentSummary.partial : stats.residentCount} label={paymentSummary ? 'Active Contributors' : 'Members'} />
              <Tile icon={HandCoins} value={stats.campaignCount} label="Campaigns" />
              <Tile icon={Wrench} value={stats.campaignsByStatus.repairing} label="Active Repairs" />
            </div>

            {joinRequests.length > 0 && <JoinRequests requests={joinRequests} estateId={estate.id} onChanged={load} />}

            <div ref={residentsRef} className={styles.anchor}>
              <Residents
                estate={estate}
                residents={residents}
                invites={invites}
                featured={featured}
                ownerId={ownerId}
                myId={profile.id}
                onChanged={load}
                onAdd={() => setDialog({ type: 'add' })}
              />
            </div>
          </div>

          <aside ref={adminRef} className={`${styles.side} ${styles.anchor}`}>
            <div ref={profileRef} className={styles.anchor}>
              <MyProfile profile={profile} isOwner={isOwner} onEdit={() => setDialog({ type: 'profile' })} />
            </div>
            <Administrators residents={residents} ownerId={ownerId} onManage={() => goTo('residents')} />
            <CommunityAccess estate={estate} onSave={saveEstate} />
            {isOwner && <DangerZone onTransfer={() => setDialog({ type: 'transfer' })} />}
          </aside>
        </div>
      </div>

      {dialog?.type === 'profile' && (
        <Modal title="Edit My Profile" description="Your name and phone show to residents on campaigns and receipts." onClose={() => setDialog(null)}>
          <ProfileForm
            onCancel={() => setDialog(null)}
            onSaved={() => {
              setDialog(null)
              load()
            }}
          />
        </Modal>
      )}
      {dialog?.type === 'estate' && <EditEstate estate={estate} onClose={() => setDialog(null)} onSave={saveEstate} />}
      {dialog?.type === 'add' && (
        <AddResident
          estateId={estate.id}
          onClose={() => setDialog(null)}
          onAdded={() => {
            setDialog(null)
            load()
          }}
        />
      )}
      {dialog?.type === 'transfer' && (
        <TransferOwnership
          estate={estate}
          residents={residents.filter((person) => person.id !== profile.id && person.status !== 'suspended')}
          onClose={() => setDialog(null)}
          onDone={(owner) => {
            setDialog(null)
            toast.success(`${owner?.name ?? 'The new owner'} now owns the estate. You stay on as a co-admin.`)
            refresh()
            load()
          }}
        />
      )}
    </AppShell>
  )
}

function SaveStatus({ state }) {
  const [Icon, text] = {
    saved: [CircleCheck, 'All changes saved'],
    saving: [LoaderCircle, 'Saving…'],
    failed: [AlertTriangle, 'Couldn’t save the last change'],
  }[state]
  return (
    <p className={`${styles.saveStatus} ${styles[state]}`} role="status">
      <Icon size={18} aria-hidden="true" /> {text}
    </p>
  )
}

function Tile({ icon: Icon, value, label }) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileIcon} aria-hidden="true">
        <Icon />
      </span>
      <span>
        <strong>{value}</strong>
        {label}
      </span>
    </div>
  )
}

/* ---------------------------------------------------------------- Estate information */

function EstateInfo({ estate, onEdit, onSave }) {
  const [copied, setCopied] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [problem, setProblem] = useState('')
  const fileInput = useRef(null)

  async function changeImage(file) {
    if (!file) return
    setUploading(true)
    setProblem('')
    try {
      await onSave({ imageUrl: await uploadImage(file, 'other') })
    } catch (error) {
      setProblem(error.message)
    } finally {
      setUploading(false)
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(estate.joinCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // The code is on screen to copy by hand.
    }
  }

  return (
    <section className={`${shared.card} ${styles.info}`} aria-labelledby="estate-title">
      <div className={styles.infoText}>
        <div className={shared.cardHead}>
          <h2 id="estate-title" className={shared.cardTitle}>
            <ShieldCheck aria-hidden="true" /> Estate Information
          </h2>
          <button type="button" className={styles.edit} onClick={onEdit}>
            <Pencil size={16} aria-hidden="true" /> Edit
          </button>
        </div>
        <dl className={styles.facts}>
          <div>
            <dt>Estate / Community Name</dt>
            <dd>{estate.name}</dd>
          </div>
          <div>
            <dt>Address</dt>
            <dd>{estate.address || 'Not added yet'}</dd>
          </div>
          <div>
            <dt>Total Households</dt>
            <dd>{estate.totalHouseholds ?? 'Not set'}</dd>
          </div>
          <div>
            <dt>Community Type</dt>
            <dd>{COMMUNITY_TYPES[estate.communityType] ?? 'Residential Estate'}</dd>
          </div>
          <div className={styles.codeRow}>
            <dt>Join Code</dt>
            <dd>
              <code>{estate.joinCode}</code>
              <button type="button" onClick={copyCode} aria-label="Copy join code" title="Copy">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
              <button
                type="button"
                onClick={() => onSave({ regenerateJoinCode: true }).catch((error) => setProblem(error.message))}
                aria-label="Make a new join code"
                title="New code (the old one stops working)"
              >
                <RefreshCw size={16} />
              </button>
            </dd>
            <p>Residents enter this on Create Account ("Have a join code?") to join straight away, without waiting for approval.</p>
          </div>
        </dl>
        {problem && <FormAlert>{problem}</FormAlert>}
      </div>
      <div className={styles.photo}>
        {estate.imageUrl ? <img src={sizedPhoto(estate.imageUrl, 800)} alt="" /> : <Photo name="evening-street" sizes="(min-width: 1100px) 30vw, 100vw" />}
        <button type="button" className={styles.changeImage} onClick={() => fileInput.current?.click()} disabled={uploading}>
          <ImagePlus size={16} aria-hidden="true" /> {uploading ? 'Uploading…' : 'Change image'}
        </button>
        <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/heic" hidden onChange={(event) => changeImage(event.target.files?.[0])} />
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- Join requests */

function JoinRequests({ requests, estateId, onChanged }) {
  const toast = useToast()
  const paged = usePaged(requests, REQUESTS_PER_PAGE)
  const [busy, setBusy] = useState(null)
  const [units, setUnits] = useState({})
  const [problem, setProblem] = useState('')

  async function answer(person, approve) {
    setBusy(person.id)
    setProblem('')
    try {
      const path = `/estates/${estateId}/join-requests/${person.id}`
      if (approve) {
        const unitNumber = units[person.id]?.trim()
        await api(`${path}/approve`, { method: 'POST', body: unitNumber ? { unitNumber } : {} })
      } else {
        await api(path, { method: 'DELETE' })
      }
      toast.success(approve ? `${person.name} approved and added to the estate` : `${person.name}'s request declined`)
      onChanged()
    } catch (error) {
      setProblem(error.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className={`${shared.card} ${styles.requests}`} aria-labelledby="requests-title">
      <h2 id="requests-title" className={shared.cardTitle}>
        <UserPlus aria-hidden="true" /> Join Requests ({requests.length})
      </h2>
      <p className={shared.cardText}>These people found your estate and asked to join. They can’t see anything until you approve them.</p>
      <ul className={styles.requestList}>
        {paged.rows.map((person) => (
          <li key={person.id}>
            <span className={styles.avatar} aria-hidden="true">
              {initials(person.name)}
            </span>
            <span className={styles.requestWho}>
              <strong>{person.name}</strong>
              {person.email}
              {person.phone && ` · ${person.phone}`}
              <small>Asked {formatDate(person.requestedAt)}</small>
            </span>
            <input
              className={styles.unitInput}
              placeholder="Unit (optional)"
              aria-label={`Unit for ${person.name}`}
              value={units[person.id] ?? person.unitNumber ?? ''}
              onChange={(event) => setUnits((shown) => ({ ...shown, [person.id]: event.target.value }))}
            />
            <span className={styles.requestActions}>
              <button type="button" className={shared.secondary} disabled={busy === person.id} onClick={() => answer(person, false)}>
                Decline
              </button>
              <Button busy={busy === person.id} onClick={() => answer(person, true)} className={styles.approve}>
                Approve
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <Pagination paged={paged} noun="requests" />
      {problem && <FormAlert>{problem}</FormAlert>}
    </section>
  )
}

/* ---------------------------------------------------------------- Residents */

function Residents({ estate, residents, invites, featured, ownerId, myId, onChanged, onAdd }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [problem, setProblem] = useState('')
  const [editing, setEditing] = useState(null)
  const toast = useToast()
  const overdue = featured?.deadline && featured.deadline < dayFromToday(0)

  const shown = residents.filter((person) => {
    const text = `${person.name} ${person.email} ${person.phone ?? ''} ${person.unitNumber ?? ''}`.toLowerCase()
    if (query && !text.includes(query.toLowerCase())) return false
    if (filter === 'admins') return person.role === 'admin'
    if (filter === 'active' || filter === 'suspended') return person.status === filter
    if (filter === 'owing') return person.payment && person.payment.status !== 'paid'
    return true
  })
  const paged = usePaged(shown, RESIDENTS_PER_PAGE, `${query}|${filter}`)
  const invitesPaged = usePaged(invites, INVITES_PER_PAGE)

  async function act(person, change) {
    setProblem('')
    try {
      if (change === 'remove') {
        if (!window.confirm(`Remove ${person.name} from ${estate.name}? Their past contributions stay on record.`)) return
        await api(`/estates/${estate.id}/residents/${person.id}`, { method: 'DELETE' })
      } else {
        await api(`/estates/${estate.id}/residents/${person.id}`, { method: 'PUT', body: change })
      }
      toast.success(changeMessage(person, change, estate))
      onChanged()
    } catch (error) {
      setProblem(error.message)
    }
  }

  function exportCsv() {
    const header = ['Name', 'Email', 'Phone', 'Unit', 'Units', 'Role', 'Status', 'Contribution Status', 'Paid', 'Still Owed']
    const rows = shown.map((person) => [
      person.name,
      person.email,
      person.phone ?? '',
      person.unitNumber ?? '',
      person.units,
      person.role,
      person.status,
      person.payment ? PAYMENT_LABELS[person.payment.status][0] : '',
      person.payment?.paid ?? '',
      person.payment?.balance ?? '',
    ])
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const link = Object.assign(document.createElement('a'), { href: url, download: `${estate.name} residents.csv` })
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <section className={shared.card} aria-labelledby="residents-title">
      <div className={`${shared.cardHead} ${styles.residentsHead}`}>
        <div>
          <h2 id="residents-title" className={shared.cardTitle}>
            <Users aria-hidden="true" /> Residents
          </h2>
          <p className={shared.cardText}>
            Manage residents who belong to this estate.
            {featured && ` Contribution status is for “${featured.title}”.`}
          </p>
        </div>
        <Button onClick={onAdd} className={styles.addResident}>
          <Plus size={17} aria-hidden="true" /> Add Resident
        </Button>
      </div>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search residents…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search residents"
          />
        </label>
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          aria-label="Filter residents"
          className={styles.filter}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="admins">Admins</option>
          {featured && <option value="owing">Still owing</option>}
        </select>
        <button type="button" className={`${shared.secondary} ${styles.export}`} onClick={exportCsv}>
          <Download size={17} aria-hidden="true" /> Export
        </button>
      </div>

      {problem && <FormAlert>{problem}</FormAlert>}

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Resident</th>
              <th scope="col">Unit</th>
              <th scope="col">Phone</th>
              {featured && <th scope="col">Contribution Status</th>}
              <th scope="col">Joined</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map((person) => {
              const [label, tone] = person.payment
                ? person.payment.status !== 'paid' && overdue
                  ? ['Overdue', 'overdue']
                  : PAYMENT_LABELS[person.payment.status]
                : []
              return (
                <tr key={person.id}>
                  <td>
                    <span className={styles.person}>
                      <span className={styles.avatar} aria-hidden="true">
                        {initials(person.name)}
                      </span>
                      <span>
                        <strong>{person.name}</strong>
                        <small>{person.email}</small>
                      </span>
                    </span>
                  </td>
                  <td>{person.unitNumber ?? 'Not set'}</td>
                  <td>{person.phone ? person.phone.replace(/^\+234/, '0') : 'Not added'}</td>
                  {featured && (
                    <td>
                      <span className={`${styles.pill} ${styles[tone]}`}>{label}</span>
                    </td>
                  )}
                  <td>{formatDate(person.createdAt)}</td>
                  <td>
                    <span className={`${styles.pill} ${person.status === 'suspended' ? styles.suspended : styles.active}`}>
                      {person.id === ownerId ? 'Owner' : person.role === 'admin' ? 'Admin' : person.status === 'suspended' ? 'Suspended' : 'Active'}
                    </span>
                  </td>
                  <td>
                    <ResidentMenu
                      person={person}
                      locked={person.id === ownerId || person.id === myId}
                      onEdit={() => setEditing(person)}
                      onAct={(change) => act(person, change)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {shown.length === 0 && <p className={styles.empty}>No residents match.</p>}
      </div>
      <Pagination paged={paged} noun="residents" />

      {invites.length > 0 && (
        <div className={styles.invites}>
          <h3>Invited, not signed up yet</h3>
          <ul>
            {invitesPaged.rows.map((invite) => (
              <li key={invite.id}>
                <span>
                  {invite.email}
                  {invite.unitNumber && ` · ${invite.unitNumber}`}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    api(`/estates/${estate.id}/invites/${encodeURIComponent(invite.email)}`, { method: 'DELETE' })
                      .then(() => {
                        toast.success(`Invite for ${invite.email} cancelled`)
                        onChanged()
                      })
                      .catch((error) => setProblem(error.message))
                  }
                >
                  Cancel invite
                </button>
              </li>
            ))}
          </ul>
          <Pagination paged={invitesPaged} noun="invites" />
        </div>
      )}

      {editing && (
        <EditResident
          estateId={estate.id}
          person={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            toast.success(`Unit details for ${editing.name} saved`)
            setEditing(null)
            onChanged()
          }}
        />
      )}
    </section>
  )
}

// What a change to a resident did, for the confirmation message.
function changeMessage(person, change, estate) {
  if (change === 'remove') return `${person.name} removed from ${estate.name}`
  if (change.role === 'admin') return `${person.name} is now a co-admin`
  if (change.role === 'resident') return `${person.name} is no longer an admin`
  if (change.status === 'suspended') return `${person.name} has been suspended`
  if (change.status === 'active') return `${person.name} can use CIRF again`
  return 'Changes saved'
}

function ResidentMenu({ person, locked, onEdit, onAct }) {
  const [open, setOpen] = useState(false)
  const run = (action) => () => {
    setOpen(false)
    action()
  }
  return (
    <div className={styles.menuWrap}>
      <button type="button" className={styles.kebab} aria-label={`Actions for ${person.name}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <MoreVertical size={18} />
      </button>
      {open && (
        <div className={styles.menu} role="menu" onMouseLeave={() => setOpen(false)}>
          <button type="button" role="menuitem" onClick={run(onEdit)}>
            Edit unit details
          </button>
          {!locked && (
            <>
              <button type="button" role="menuitem" onClick={run(() => onAct({ role: person.role === 'admin' ? 'resident' : 'admin' }))}>
                {person.role === 'admin' ? 'Remove admin access' : 'Make co-admin'}
              </button>
              <button type="button" role="menuitem" onClick={run(() => onAct({ status: person.status === 'suspended' ? 'active' : 'suspended' }))}>
                {person.status === 'suspended' ? 'Reactivate' : 'Suspend'}
              </button>
              <button type="button" role="menuitem" className={styles.dangerItem} onClick={run(() => onAct('remove'))}>
                Remove from estate
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- Side column */

function MyProfile({ profile, isOwner, onEdit }) {
  return (
    <section className={shared.card} aria-labelledby="me-title">
      <div className={shared.cardHead}>
        <h2 id="me-title" className={shared.cardTitle}>
          <UserRound aria-hidden="true" /> My Profile
        </h2>
        <button type="button" className={styles.edit} onClick={onEdit}>
          <Pencil size={16} aria-hidden="true" /> Edit
        </button>
      </div>
      <div className={styles.me}>
        <span className={styles.bigAvatar} aria-hidden="true">
          {initials(profile.name)}
        </span>
        <span>
          <strong>{profile.name}</strong>
          {isOwner ? 'Community Lead (owner)' : 'Co-admin'}
        </span>
      </div>
      <ul className={styles.meFacts}>
        <li>
          <Mail aria-hidden="true" /> {profile.email}
        </li>
        <li>
          <Phone aria-hidden="true" /> {profile.phone ? profile.phone.replace(/^\+234/, '0') : 'No phone number yet'}
        </li>
        <li>
          <House aria-hidden="true" /> {profile.unitNumber ? `Unit ${profile.unitNumber}` : 'No unit set'}
          {profile.units > 1 && ` (${profile.units} units)`}
        </li>
      </ul>
    </section>
  )
}

function Administrators({ residents, ownerId, onManage }) {
  const admins = residents.filter((person) => person.role === 'admin').sort((a, b) => (b.id === ownerId) - (a.id === ownerId))
  return (
    <section className={shared.card} aria-labelledby="admins-title">
      <h2 id="admins-title" className={`${shared.cardTitle} ${styles.sideTitle}`}>
        <ShieldCheck aria-hidden="true" /> Community Administrators
      </h2>
      <ul className={styles.admins}>
        {admins.map((person) => (
          <li key={person.id}>
            <span className={styles.bigAvatar} aria-hidden="true">
              {initials(person.name)}
            </span>
            <span>
              <strong>{person.name}</strong>
              {person.id === ownerId ? 'Community Lead' : 'Co-admin'}
            </span>
            {person.id === ownerId && <em className={styles.primary}>Primary</em>}
          </li>
        ))}
      </ul>
      <button type="button" className={styles.manage} onClick={onManage}>
        <Users size={18} aria-hidden="true" /> Manage access <ArrowRight size={16} aria-hidden="true" />
      </button>
    </section>
  )
}

function CommunityAccess({ estate, onSave }) {
  const [problem, setProblem] = useState('')
  const toggle = (field) => (value) => {
    setProblem('')
    onSave({ [field]: value }).catch((error) => setProblem(error.message))
  }
  return (
    <section className={shared.card} aria-labelledby="access-title">
      <h2 id="access-title" className={`${shared.cardTitle} ${styles.sideTitle}`}>
        <ShieldCheck aria-hidden="true" /> Community Access
      </h2>
      <div className={styles.setting}>
        <span>
          <strong>Resident registration</strong>
          Allow new residents to find this estate and ask to join.
        </span>
        <Switch checked={estate.allowRegistration !== false} onChange={toggle('allowRegistration')} label="Resident registration" />
      </div>
      <div className={styles.setting}>
        <span>
          <strong>Require admin approval</strong>
          New registrations wait for an admin to approve them.
        </span>
        <Switch checked={estate.requireApproval !== false} onChange={toggle('requireApproval')} label="Require admin approval" />
      </div>
      <div className={styles.setting}>
        <span>
          <strong>Campaign visibility</strong>
          Who can see campaign details and reports.
          <span className={styles.visibility}>Community members only</span>
          <small>Each transparency report also has a public link, with contributors’ names left out.</small>
        </span>
      </div>
      {problem && <FormAlert>{problem}</FormAlert>}
    </section>
  )
}

function DangerZone({ onTransfer }) {
  return (
    <section className={styles.danger} aria-labelledby="danger-title">
      <h2 id="danger-title">
        <AlertTriangle size={20} aria-hidden="true" /> Danger Zone
      </h2>
      <strong>Transfer community ownership</strong>
      <p>This hands all management rights to another member. You stay on as a co-admin.</p>
      <button type="button" onClick={onTransfer}>
        <ArrowRight size={16} aria-hidden="true" /> Transfer ownership
      </button>
    </section>
  )
}

/* ---------------------------------------------------------------- Dialogs */

function EditEstate({ estate, onClose, onSave }) {
  const [form, setForm] = useState({
    name: estate.name,
    address: estate.address ?? '',
    totalHouseholds: estate.totalHouseholds ?? '',
    totalUnits: estate.totalUnits ?? '',
    communityType: estate.communityType ?? 'residential_estate',
  })
  const [errors, setErrors] = useState({})
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (field) => (event) => setForm((shown) => ({ ...shown, [field]: event.target.value }))

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    setProblem('')
    const changes = { name: form.name.trim(), communityType: form.communityType }
    if (form.address.trim()) changes.address = form.address.trim()
    if (parseNaira(form.totalHouseholds)) changes.totalHouseholds = parseNaira(form.totalHouseholds)
    if (parseNaira(form.totalUnits)) changes.totalUnits = parseNaira(form.totalUnits)
    try {
      await onSave(changes)
      onClose()
    } catch (error) {
      const found = {}
      for (const detail of error.details ?? []) found[detail.field] = detail.message
      setErrors(found)
      if (!Object.keys(found).length) setProblem(error.message)
      setBusy(false)
    }
  }

  return (
    <Modal title="Edit Estate Information" description="New counts apply to new campaigns; existing ones keep the levy they started with." onClose={onClose}>
      <form onSubmit={submit} noValidate className={styles.dialogForm}>
        <FormField label="Estate / Community Name" required value={form.name} onChange={set('name')} error={errors.name} />
        <FormField label="Address" icon={MapPin} value={form.address} onChange={set('address')} error={errors.address} placeholder="e.g. Alagbado, Lagos" />
        <div className={styles.twoFields}>
          <FormField label="Total Households" icon={House} inputMode="numeric" value={form.totalHouseholds} onChange={set('totalHouseholds')} error={errors.totalHouseholds} />
          <FormField label="Total Units" icon={Hash} inputMode="numeric" value={form.totalUnits} onChange={set('totalUnits')} error={errors.totalUnits} hint="For per-unit levies" />
        </div>
        <FormField label="Community Type" as="select" value={form.communityType} onChange={set('communityType')}>
          {Object.entries(COMMUNITY_TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </FormField>
        {problem && <FormAlert>{problem}</FormAlert>}
        <div className={styles.dialogActions}>
          <button type="button" className={shared.secondary} onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" busy={busy}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function AddResident({ estateId, onClose, onAdded }) {
  const [email, setEmail] = useState('')
  const [unitNumber, setUnitNumber] = useState('')
  const [units, setUnits] = useState('1')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await api(`/estates/${estateId}/residents`, {
        method: 'POST',
        body: { email: email.trim(), ...(unitNumber.trim() && { unitNumber: unitNumber.trim() }), units: parseNaira(units) || 1 },
      })
      setResult(response)
    } catch (problem) {
      setError(problem.fieldMessage?.('email') ?? problem.message)
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <Modal title={result.invited ? 'Invite saved' : 'Resident added'} onClose={onAdded}>
        <div className={styles.dialogForm}>
          <p className={styles.dialogText}>
            {result.invited
              ? `${result.email} doesn’t have a CIRF account yet. When they sign up with that email, they join your estate automatically.`
              : `${result.resident.name} is now a member of your estate.`}
          </p>
          <div className={styles.dialogActions}>
            <Button onClick={onAdded}>Done</Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Add Resident" description="Add someone by email. If they haven’t signed up yet, they’re invited and join automatically when they do." onClose={onClose}>
      <form onSubmit={submit} noValidate className={styles.dialogForm}>
        <FormField label="Email Address" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="resident@example.com" />
        <div className={styles.twoFields}>
          <FormField label="Unit" optional value={unitNumber} onChange={(event) => setUnitNumber(event.target.value)} placeholder="e.g. B12" />
          <FormField label="Number of Units" inputMode="numeric" value={units} onChange={(event) => setUnits(event.target.value)} hint="For per-unit levies" />
        </div>
        {error && <FormAlert>{error}</FormAlert>}
        <div className={styles.dialogActions}>
          <button type="button" className={shared.secondary} onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" busy={busy}>
            Add Resident
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function EditResident({ estateId, person, onClose, onSaved }) {
  const [unitNumber, setUnitNumber] = useState(person.unitNumber ?? '')
  const [units, setUnits] = useState(String(person.units ?? 1))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api(`/estates/${estateId}/residents/${person.id}`, {
        method: 'PUT',
        body: { unitNumber: unitNumber.trim() || null, units: parseNaira(units) || 1 },
      })
      onSaved()
    } catch (problem) {
      setError(problem.message)
      setBusy(false)
    }
  }

  return (
    <Modal title={`Unit details for ${person.name}`} description="Units only matter for per-unit levies: a landlord with 4 flats pays 4×." onClose={onClose}>
      <form onSubmit={submit} noValidate className={styles.dialogForm}>
        <div className={styles.twoFields}>
          <FormField label="Unit" value={unitNumber} onChange={(event) => setUnitNumber(event.target.value)} placeholder="e.g. B12" />
          <FormField label="Number of Units" inputMode="numeric" value={units} onChange={(event) => setUnits(event.target.value)} />
        </div>
        {error && <FormAlert>{error}</FormAlert>}
        <div className={styles.dialogActions}>
          <button type="button" className={shared.secondary} onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" busy={busy}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function TransferOwnership({ estate, residents, onClose, onDone }) {
  const [userId, setUserId] = useState('')
  const [confirmName, setConfirmName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const ready = userId && confirmName.trim().toLowerCase() === estate.name.trim().toLowerCase()

  async function submit(event) {
    event.preventDefault()
    if (!ready) return setError('Choose the new owner and type the estate name to confirm')
    setBusy(true)
    setError('')
    try {
      await api(`/estates/${estate.id}/transfer-ownership`, { method: 'POST', body: { userId } })
      onDone(residents.find((person) => person.id === userId))
    } catch (problem) {
      setError(problem.message)
      setBusy(false)
    }
  }

  return (
    <Modal title="Transfer Ownership" description="The new owner gets full control of the estate. You stay on as a co-admin." onClose={onClose}>
      <form onSubmit={submit} noValidate className={styles.dialogForm}>
        <FormField label="New Owner" required as="select" value={userId} onChange={(event) => setUserId(event.target.value)}>
          <option value="">Choose a member…</option>
          {residents.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
              {person.unitNumber ? ` (${person.unitNumber})` : ''}
            </option>
          ))}
        </FormField>
        <FormField
          label={`Type “${estate.name}” to confirm`}
          required
          value={confirmName}
          onChange={(event) => setConfirmName(event.target.value)}
          hint="This can only be undone by the new owner."
        />
        {error && <FormAlert>{error}</FormAlert>}
        <div className={styles.dialogActions}>
          <button type="button" className={shared.secondary} onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" busy={busy} disabled={!ready} className={styles.dangerButton}>
            Transfer Ownership
          </Button>
        </div>
      </form>
    </Modal>
  )
}

