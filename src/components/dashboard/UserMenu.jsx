import { ChevronDown, LogOut, Settings } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/AuthContext.js'
import { ROLE_LABELS, initials } from '../../lib/format.js'
import styles from './AppShell.module.css'

// The signed-in person's initials, name and role, opening a small menu.
export function UserMenu() {
  const { profile, estate, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const box = useRef(null)

  // Close on a click outside the menu or on Escape.
  useEffect(() => {
    if (!open) return undefined
    const onClick = (event) => box.current?.contains(event.target) || setOpen(false)
    const onKey = (event) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={styles.user} ref={box}>
      <button
        type="button"
        className={styles.userButton}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.avatar} aria-hidden="true">
          {initials(profile.name)}
        </span>
        <span className={styles.who}>
          <span className={styles.name}>{profile.name}</span>
          <span className={styles.role}>{ROLE_LABELS[profile.role]}</span>
        </span>
        <ChevronDown size={16} className={styles.chevron} aria-hidden="true" />
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          <p className={styles.menuHeader}>
            <strong>{profile.name}</strong>
            <span>{profile.email}</span>
            {estate && <span>{estate.name}</span>}
          </p>
          <Link to="/settings" role="menuitem" className={styles.menuItem} onClick={() => setOpen(false)}>
            <Settings size={17} aria-hidden="true" />
            Settings
          </Link>
          <button type="button" role="menuitem" className={styles.menuItem} onClick={signOut}>
            <LogOut size={17} aria-hidden="true" />
            Log Out
          </button>
        </div>
      )}
    </div>
  )
}
