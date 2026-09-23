import { formatNaira } from '../../lib/format.js'
import styles from './ProgressRing.module.css'

const RADIUS = 62
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// "Campaign Progress" from the campaign designs: a ring of what's collected against the
// target, the percentage in the middle, and Collected / Remaining beside it.
export function ProgressRing({ collected, target }) {
  const percent = target ? Math.min(Math.round((collected / target) * 100), 100) : 0
  const remaining = Math.max(target - collected, 0)
  const filled = (percent / 100) * CIRCUMFERENCE

  return (
    <div className={styles.progress}>
      <svg
        viewBox="0 0 160 160"
        className={styles.ring}
        role="img"
        aria-label={`${percent}% collected: ${formatNaira(collected)} of ${formatNaira(target)}`}
      >
        <circle cx="80" cy="80" r={RADIUS} className={styles.track} />
        <circle
          cx="80"
          cy="80"
          r={RADIUS}
          className={styles.fill}
          strokeDasharray={`${filled} ${CIRCUMFERENCE - filled}`}
          transform="rotate(-90 80 80)"
        />
        <text x="80" y="72" textAnchor="middle" className={styles.percent}>
          {percent}%
        </text>
        <text x="80" y="94" textAnchor="middle" className={styles.amount}>
          {formatNaira(collected)}
        </text>
        <text x="80" y="111" textAnchor="middle" className={styles.caption}>
          collected
        </text>
      </svg>

      <dl className={styles.legend}>
        <div>
          <dt>
            <span className={`${styles.dot} ${styles.collected}`} aria-hidden="true" />
            Collected
          </dt>
          <dd>{formatNaira(collected)}</dd>
          <dd className={styles.share}>{percent}%</dd>
        </div>
        <div>
          <dt>
            <span className={`${styles.dot} ${styles.remaining}`} aria-hidden="true" />
            Remaining
          </dt>
          <dd>{formatNaira(remaining)}</dd>
          <dd className={styles.share}>{100 - percent}%</dd>
        </div>
      </dl>
    </div>
  )
}
