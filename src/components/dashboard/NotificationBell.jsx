import { Bell } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../lib/api.js'
import { useVisibleInterval } from '../../lib/useVisibleInterval.js'
import styles from './AppShell.module.css'

// The bell in the top bar, with a dot while anything is unread. Checked once a minute.
export function NotificationBell() {
  const [unread, setUnread] = useState(0)

  const check = useCallback(() => {
    api('/users/me/notifications')
      .then((data) => setUnread(data.unreadCount))
      .catch(() => {}) // a missed check just keeps the last count
  }, [])

  useEffect(check, [check])
  useVisibleInterval(check, 60_000)

  const label = unread ? `Notifications, ${unread} unread` : 'Notifications'
  return (
    <Link to="/notifications" className={styles.bell} aria-label={label} title={label}>
      <Bell size={21} aria-hidden="true" />
      {unread > 0 && <span className={styles.dot} />}
    </Link>
  )
}
