import {
  Bell,
  BellRing,
  Check,
  ChevronRight,
  CircleX,
  ClipboardCheck,
  FileText,
  HandCoins,
  Info,
  Megaphone,
  ShieldCheck,
  Target,
  UserPlus,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext.js'
import { AppShell } from '../components/dashboard/AppShell.jsx'
import { PageHeading } from '../components/dashboard/PageHeading.jsx'
import { Pagination } from '../components/dashboard/Pagination.jsx'
import { Pylons } from '../components/dashboard/Pylons.jsx'
import { Switch } from '../components/dashboard/Switch.jsx'
import { FormAlert } from '../components/FormAlert.jsx'
import { PageSkeleton } from '../components/Loading.jsx'
import { useToast } from '../components/ToastContext.js'
import { api } from '../lib/api.js'
import { lagosDay, timeAgo } from '../lib/format.js'
import { NOTIFICATIONS_CHANGED } from '../lib/notifications.js'
import { usePaged } from '../lib/usePaged.js'
import { usePageTitle } from '../lib/usePageTitle.js'
import { useVisibleInterval } from '../lib/useVisibleInterval.js'
import shared from './campaigns/campaigns.module.css'
import styles from './Notifications.module.css'

const PAGE_SIZE = 10

// The filter chips, and which categories (from the API) each one shows.
const FILTERS = [
  ['all', 'All', null],
  ['unread', 'Unread', null],
  ['campaigns', 'Campaigns', ['campaigns', 'reminders']],
  ['contributions', 'Contributions', ['contributions']],
  ['repairs', 'Repairs', ['repairs', 'reports']],
]

// The switches, matching PREFERENCE_KEYS in server/services/notifications.js.
const PREFERENCES = [
  ['campaigns', Target, 'Campaign updates', 'New campaigns, milestones, target reached'],
  ['contributions', Wallet, 'Contribution confirmations', 'Payments verified or rejected, new ones to check'],
  ['repairs', Wrench, 'Repair updates', 'Vendor chosen, repair completed'],
  ['reminders', BellRing, 'Payment reminders', 'Reminders about levies still owed'],
  ['reports', FileText, 'Transparency reports', 'Final reports and reconciliations'],
]

// Each type's icon, and the screen that has more about it.
const TYPES = {
  campaign_published: { icon: Megaphone, to: (n) => `/campaigns/${n.campaignId}` },
  target_reached: { icon: Target, to: (n) => `/campaigns/${n.campaignId}` },
  contribution_recorded: { icon: HandCoins, to: (n) => `/campaigns/${n.campaignId}/contributions` },
  contribution_verified: { icon: Wallet, to: (n) => `/campaigns/${n.campaignId}/contributions` },
  contribution_rejected: { icon: CircleX, to: (n) => `/campaigns/${n.campaignId}/contributions` },
  vendor_selected: { icon: ClipboardCheck, to: (n) => `/campaigns/${n.campaignId}/quotes` },
  repair_completed: { icon: Wrench, to: (n) => `/campaigns/${n.campaignId}/reconciliation` },
  campaign_reconciled: { icon: FileText, to: (n) => `/campaigns/${n.campaignId}/report` },
  payment_reminder: { icon: Bell, to: (n) => `/campaigns/${n.campaignId}/contribute` },
  join_request: { icon: UserPlus, to: () => '/settings' },
  join_approved: { icon: Users, to: () => '/dashboard' },
  join_declined: { icon: Users, to: () => '/account' },
  ownership_transferred: { icon: ShieldCheck, to: () => '/settings' },
}

// Notifications, from Notification-Screen.png: the list grouped by day, filters, "Mark
// all as read", and the switches for which kinds of update to get.
export default function Notifications() {
  usePageTitle('Notifications')
  const { profile, estate, refresh } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [state, setState] = useState({ status: 'loading' })
  const [filter, setFilter] = useState('all')
  const [marking, setMarking] = useState(false)

  const load = useCallback(() => {
    let current = true
    api('/users/me/notifications')
      .then((data) => current && setState({ status: 'ready', ...data }))
      .catch((error) => current && setState((shown) => (shown.status === 'ready' ? shown : { status: 'error', message: error.message })))
    return () => {
      current = false
    }
  }, [])

  useEffect(load, [load])
  useVisibleInterval(load, 60_000, state.status === 'ready')

  const all = state.notifications ?? []
  const categories = FILTERS.find(([key]) => key === filter)[2]
  const shown = all.filter((n) => (filter === 'unread' ? !n.read : !categories || categories.includes(n.category)))
  const paged = usePaged(shown, PAGE_SIZE, filter)

  // Marks read here straight away, then tells the API (and the bell in the top bar).
  function markRead(ids) {
    setState((current) => ({
      ...current,
      notifications: current.notifications.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)),
      unreadCount: Math.max(current.unreadCount - ids.length, 0),
    }))
    return Promise.all(ids.map((id) => api(`/notifications/${id}/read`, { method: 'PUT' }))).finally(() =>
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED)),
    )
  }

  async function markAllRead() {
    setMarking(true)
    try {
      const { markedRead } = await api('/users/me/notifications/read-all', { method: 'PUT' })
      setState((current) => ({ ...current, notifications: current.notifications.map((n) => ({ ...n, read: true })), unreadCount: 0 }))
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED))
      toast.success(markedRead ? `Marked ${markedRead} ${markedRead === 1 ? 'notification' : 'notifications'} as read` : 'Everything was already read')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setMarking(false)
    }
  }

  function open(n) {
    if (!n.read) markRead([n.id]).catch(() => {})
    const target = TYPES[n.type]?.to(n)
    if (target && !target.includes('/null')) navigate(target)
  }

  const heading = <PageHeading back={{ to: '/dashboard', label: 'Back to Dashboard' }} />

  if (state.status !== 'ready') {
    return (
      <AppShell heading={heading}>
        {state.status === 'loading' ? <PageSkeleton layout="list" label="Please wait, loading your notifications…" /> : <FormAlert>{state.message}</FormAlert>}
      </AppShell>
    )
  }

  const groups = groupByDay(paged.rows)

  return (
    <AppShell heading={heading}>
      <div className={styles.page}>
        <header className={styles.intro}>
          <h1 className={styles.title}>Notifications</h1>
          <p className={styles.subtitle}>Stay up to date with your community&apos;s repair activity.</p>
        </header>

        <div className={styles.layout}>
          <div className={styles.main}>
            <div className={styles.toolbar}>
              <div className={styles.chips} role="tablist" aria-label="Show">
                {FILTERS.map(([key, label]) => (
                  <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? styles.activeChip : ''} onClick={() => setFilter(key)}>
                    {label}
                    {key === 'unread' && state.unreadCount > 0 && <span className={styles.count}>{state.unreadCount}</span>}
                  </button>
                ))}
              </div>
              <button type="button" className={styles.markAll} onClick={markAllRead} disabled={marking || state.unreadCount === 0}>
                <Check size={17} aria-hidden="true" /> {marking ? 'Marking…' : 'Mark all as read'}
              </button>
            </div>

            <section className={`${shared.card} ${styles.list}`} aria-label="Notifications">
              {shown.length === 0 ? (
                <div className={styles.empty}>
                  <Bell aria-hidden="true" />
                  <h2>{filter === 'unread' ? 'No unread notifications' : all.length ? 'Nothing here yet' : 'No notifications yet'}</h2>
                  <p>
                    {filter === 'all'
                      ? 'Updates about campaigns, contributions and repairs in your estate will show up here.'
                      : 'Try another filter to see the rest of your notifications.'}
                  </p>
                </div>
              ) : (
                groups.map(([label, items]) => (
                  <div key={label} className={styles.group}>
                    <h2 className={styles.day}>{label}</h2>
                    <ul>
                      {items.map((n) => (
                        <Item key={n.id} notification={n} onOpen={() => open(n)} onRead={() => markRead([n.id]).catch(() => {})} />
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </section>
            <Pagination paged={paged} noun="notifications" />
          </div>

          <aside className={styles.side}>
            <Preferences initial={profile.notificationPrefs} onSaved={refresh} />
            <div className={styles.trust}>
              <ShieldCheck aria-hidden="true" />
              <div>
                <strong>Staying informed builds trust</strong>
                <p>Get the right updates at the right time, and stay connected to your community&apos;s progress.</p>
              </div>
            </div>
            <Link to="/settings" className={styles.community}>
              <Users aria-hidden="true" />
              <span>
                Your community
                <strong>{estate.name}</strong>
              </span>
              <ChevronRight aria-hidden="true" />
            </Link>
            <div className={styles.caughtUp}>
              <Pylons className={styles.caughtArt} />
              {state.unreadCount === 0 ? (
                <>
                  <span className={styles.tick} aria-hidden="true">
                    <Check size={16} />
                  </span>
                  <strong>You&apos;re all caught up.</strong>
                  <p>No new notifications at the moment.</p>
                </>
              ) : (
                <>
                  <strong>
                    {state.unreadCount} unread {state.unreadCount === 1 ? 'notification' : 'notifications'}
                  </strong>
                  <p>Open one to see more, or mark them all as read.</p>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}

function Item({ notification: n, onOpen, onRead }) {
  const Icon = TYPES[n.type]?.icon ?? Info
  return (
    <li className={`${styles.item} ${n.read ? '' : styles.unread}`}>
      <span className={`${styles.dot} ${styles[n.category] ?? ''}`} aria-hidden="true" />
      <button type="button" className={styles.itemMain} onClick={onOpen}>
        <span className={styles.icon} aria-hidden="true">
          <Icon />
        </span>
        <span className={styles.text}>
          <strong>
            {n.title}
            {!n.read && <span className="visually-hidden"> (unread)</span>}
          </strong>
          {/* Messages are written with NGN (the PDF font has no ₦); on screen, use the sign. */}
          <span>{n.message.replaceAll('NGN ', '₦')}</span>
          {n.campaignTitle && <span className={styles.tag}>{n.campaignTitle}</span>}
        </span>
      </button>
      <span className={styles.meta}>
        <time dateTime={n.createdAt}>{timeAgo(n.createdAt)}</time>
        {n.read ? (
          <span className={styles.readBadge}>
            <Check size={13} aria-hidden="true" /> Read
          </span>
        ) : (
          <button type="button" className={styles.readButton} onClick={onRead}>
            Mark as read
          </button>
        )}
      </span>
    </li>
  )
}

// Which kinds of update to get. Each switch saves on its own.
function Preferences({ initial, onSaved }) {
  const toast = useToast()
  const [prefs, setPrefs] = useState(() => Object.fromEntries(PREFERENCES.map(([key]) => [key, initial?.[key] !== false])))
  const [saving, setSaving] = useState(null)

  async function toggle(key, on) {
    setPrefs((current) => ({ ...current, [key]: on }))
    setSaving(key)
    try {
      await api('/users/me', { method: 'PUT', body: { notificationPrefs: { [key]: on } } })
      const label = PREFERENCES.find(([k]) => k === key)[2]
      toast.success(`${label} ${on ? 'turned on' : 'turned off'}`)
      onSaved()
    } catch (error) {
      setPrefs((current) => ({ ...current, [key]: !on }))
      toast.error(error.message)
    } finally {
      setSaving(null)
    }
  }

  return (
    <section className={`${shared.card} ${styles.prefs}`} aria-labelledby="prefs-title">
      <div className={styles.prefsHead}>
        <Bell aria-hidden="true" />
        <div>
          <h2 id="prefs-title">Notification Preferences</h2>
          <p>Choose what kind of updates you want to receive.</p>
        </div>
      </div>
      <ul>
        {PREFERENCES.map(([key, Icon, label, detail]) => (
          <li key={key}>
            <span className={styles.prefIcon} aria-hidden="true">
              <Icon />
            </span>
            <span className={styles.prefText}>
              <strong>{label}</strong>
              {detail}
            </span>
            <Switch checked={prefs[key]} onChange={(on) => toggle(key, on)} disabled={saving === key} label={label} />
          </li>
        ))}
      </ul>
      <p className={styles.prefsNote}>Updates about your own account, like join requests and approvals, always come through.</p>
    </section>
  )
}

// [["Today", [...]], ["Yesterday", [...]], ["Earlier", [...]]], keeping the order.
function groupByDay(items, now = new Date()) {
  const today = lagosDay(now.toISOString())
  const yesterday = lagosDay(new Date(now.getTime() - 86_400_000).toISOString())
  const groups = new Map()
  for (const n of items) {
    const day = n.createdAt ? lagosDay(n.createdAt) : today
    const label = day === today ? 'Today' : day === yesterday ? 'Yesterday' : 'Earlier'
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label).push(n)
  }
  return [...groups]
}
