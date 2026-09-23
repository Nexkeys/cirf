import { Hammer } from 'lucide-react'
import { Link } from 'react-router'
import { AppShell } from '../components/dashboard/AppShell.jsx'
import { usePageTitle } from '../lib/usePageTitle.js'
import styles from './Dashboard.module.css'

// Holds the place of a dashboard screen that hasn't been built yet, so every link in
// the sidebar already goes somewhere. Each one is replaced as its screen is built.
export default function ComingSoon({ title }) {
  usePageTitle(title)

  return (
    <AppShell heading={<h1 className={styles.greeting}>{title}</h1>}>
      <section className={styles.empty}>
        <span className={styles.statIcon} aria-hidden="true">
          <Hammer />
        </span>
        <h2 className={styles.emptyTitle}>This screen is on its way</h2>
        <p className={styles.emptyText}>
          {title} is being built next. Everything on the Overview is live in the meantime.
        </p>
        <Link to="/dashboard" className={styles.emptyAction}>
          Back to Overview
        </Link>
      </section>
    </AppShell>
  )
}
