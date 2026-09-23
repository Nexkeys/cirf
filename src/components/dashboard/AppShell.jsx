import { Menu } from 'lucide-react'
import { useState } from 'react'
import { NotificationBell } from './NotificationBell.jsx'
import { Sidebar } from './Sidebar.jsx'
import { UserMenu } from './UserMenu.jsx'
import styles from './AppShell.module.css'

// The frame around every signed-in screen: the green sidebar, and a top bar holding the
// screen's heading, the notification bell and the user menu. On phones the sidebar
// becomes a drawer opened from the menu button.
export function AppShell({ heading, children }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className={styles.shell}>
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className={styles.main}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.menuButton}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={22} />
          </button>
          <div className={styles.heading}>{heading}</div>
          <div className={styles.actions}>
            <NotificationBell />
            <span className={styles.divider} aria-hidden="true" />
            <UserMenu />
          </div>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  )
}
