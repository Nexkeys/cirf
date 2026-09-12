import { Clock, HandCoins, Scale } from 'lucide-react'
import styles from './FeatureList.module.css'

const FEATURES = [
  { icon: Scale, title: 'Fair Levies', detail: ['Everyone pays', 'their share'] },
  // The clock is already round, so it doesn't sit inside a ring like the others.
  { icon: Clock, title: 'Real-Time Tracking', detail: ['See progress', 'live'], round: true },
  { icon: HandCoins, title: 'Full Transparency', detail: ['From collection', 'to repair'] },
]

// The three promises under the headline on the photo screens. `withDetail` adds the
// two-line descriptions from the Welcome screen; Home shows the titles only.
export function FeatureList({ withDetail = false }) {
  return (
    <ul className={`${styles.list} ${withDetail ? styles.detailed : styles.compact}`}>
      {FEATURES.map(({ icon: Icon, title, detail, round }) => (
        <li key={title} className={styles.item}>
          <span className={`${styles.icon} ${round ? '' : styles.ring}`} aria-hidden="true">
            <Icon strokeWidth={round ? 1.75 : 2} />
          </span>
          <span className={styles.title}>{title}</span>
          {withDetail && (
            <span className={styles.detail}>
              {detail[0]}
              <br />
              {detail[1]}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
