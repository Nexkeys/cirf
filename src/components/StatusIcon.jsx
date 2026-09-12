import { Check } from 'lucide-react'
import styles from './StatusIcon.module.css'

// The pale green circle with an icon and a small green badge, from Check Your Email.
// Other status screens reuse it with a different icon.
export function StatusIcon({ icon: Icon, badge: Badge = Check }) {
  return (
    <div className={styles.circle} aria-hidden="true">
      <span className={styles.art}>
        <Icon className={styles.icon} strokeWidth={1.5} />
        {Badge && (
          <span className={styles.badge}>
            <Badge strokeWidth={3} />
          </span>
        )}
      </span>
    </div>
  )
}
