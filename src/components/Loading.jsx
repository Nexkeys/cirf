import { LoaderCircle } from 'lucide-react'
import { Logo } from './Logo.jsx'
import styles from './Loading.module.css'

// What people see while something loads, so no screen is ever blank:
//   LoadingNote    "Please wait, loading…" with a spinner, announced to screen readers
//   Skeleton       one grey placeholder block with a moving shine
//   PageSkeleton   a note plus blocks shaped like the screen that's on its way
//   FullPageLoader the whole window, while the sign-in session is being restored

export function LoadingNote({ children = 'Please wait, loading…', className = '' }) {
  return (
    <p className={`${styles.note} ${className}`} role="status">
      <LoaderCircle className={styles.spinner} size={18} aria-hidden="true" />
      {children}
    </p>
  )
}

export function Skeleton({ height = 16, width = '100%', radius = 10, className = '' }) {
  return <span className={`${styles.block} ${className}`} style={{ height, width, borderRadius: radius }} aria-hidden="true" />
}

// Stat cards across the top, then the page's main area.
//   dashboard  stats, a chart beside a side card, then a table
//   detail     a wide header card, then a main column and a side column
//   table      a search row and table rows
//   cards      a grid of cards (Campaigns)
//   list       stacked rows (Notifications)
//   form       a single form card
export function PageSkeleton({ label = 'Please wait, loading…', layout = 'dashboard', stats = 4 }) {
  return (
    <div className={styles.page} aria-busy="true">
      <LoadingNote>{label}</LoadingNote>
      {layout === 'dashboard' && (
        <>
          <StatRow count={stats} />
          <div className={styles.split}>
            <Skeleton height={300} radius={14} />
            <Skeleton height={300} radius={14} />
          </div>
          <TableRows />
        </>
      )}
      {layout === 'detail' && (
        <>
          <Skeleton height={220} radius={14} />
          <div className={styles.split}>
            <div className={styles.stack}>
              <Skeleton height={260} radius={14} />
              <TableRows rows={4} />
            </div>
            <div className={styles.stack}>
              <Skeleton height={180} radius={14} />
              <Skeleton height={220} radius={14} />
            </div>
          </div>
        </>
      )}
      {layout === 'table' && (
        <>
          {stats > 0 && <StatRow count={stats} />}
          <TableRows rows={7} />
        </>
      )}
      {layout === 'cards' && (
        <div className={styles.cards}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={styles.card}>
              <Skeleton height={150} radius={10} />
              <Skeleton height={18} width="70%" />
              <Skeleton height={12} width="90%" />
              <Skeleton height={8} radius={99} />
            </div>
          ))}
        </div>
      )}
      {layout === 'list' && (
        <div className={styles.split}>
          <div className={styles.listCard}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={styles.listRow}>
                <Skeleton width={42} height={42} radius={99} />
                <div className={styles.stack}>
                  <Skeleton height={14} width="45%" />
                  <Skeleton height={12} width="80%" />
                </div>
              </div>
            ))}
          </div>
          <Skeleton height={420} radius={14} />
        </div>
      )}
      {layout === 'form' && (
        <div className={styles.formCard}>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={styles.stack}>
              <Skeleton height={12} width={120} />
              <Skeleton height={42} radius={9} />
            </div>
          ))}
          <Skeleton height={44} width={180} radius={9} />
        </div>
      )}
    </div>
  )
}

function StatRow({ count }) {
  return (
    <div className={styles.stats} style={{ '--count': count }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.stat}>
          <Skeleton width={46} height={46} radius={99} />
          <div className={styles.stack}>
            <Skeleton height={12} width="60%" />
            <Skeleton height={22} width="80%" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function TableRows({ rows = 5 }) {
  return (
    <div className={styles.table}>
      <Skeleton height={36} radius={8} />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={styles.row}>
          <Skeleton width={36} height={36} radius={99} />
          <Skeleton height={14} />
          <Skeleton height={14} width="70%" />
          <Skeleton height={22} width={70} radius={99} />
        </div>
      ))}
    </div>
  )
}

export function FullPageLoader({ label = 'Please wait, loading your account…' }) {
  return (
    <div className={styles.full}>
      <Logo />
      <LoadingNote>{label}</LoadingNote>
    </div>
  )
}
