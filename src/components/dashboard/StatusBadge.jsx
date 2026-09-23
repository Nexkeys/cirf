import styles from './StatusBadge.module.css'

// What each step of the campaign lifecycle is called on screen.
const STATUS_LABELS = {
  draft: 'Draft',
  fundraising: 'Active',
  repairing: 'Repairing',
  completed: 'Completed',
  reconciled: 'Reconciled',
}

export function StatusBadge({ status, className = '' }) {
  return (
    <span className={`${styles.badge} ${styles[status] ?? ''} ${className}`}>
      <span className={styles.dot} aria-hidden="true" />
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
