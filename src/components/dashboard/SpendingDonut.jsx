import { formatNaira } from '../../lib/format.js'
import styles from './SpendingDonut.module.css'

const RADIUS = 58
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
// Greens from the design, darkest first, then a grey for the smallest slice.
const COLORS = ['#0b3d2c', '#1f8a5c', '#3fb27a', '#7fcfa3', '#b9c8c2', '#d6e0dc', '#8fb3a3', '#56796b', '#2f5f4c', '#a8d8bd']

// "Spending Breakdown" from the Transparency Report design: what the vendor payment was
// spent on, with the total in the middle. `items` is [{ label, amount }].
export function SpendingDonut({ items, total, caption = 'Total Paid' }) {
  const lengths = items.map((item) => (total ? (item.amount / total) * CIRCUMFERENCE : 0))
  const offsets = lengths.map((_, i) => lengths.slice(0, i).reduce((sum, length) => sum + length, 0))
  const percent = (amount) => (total ? Math.round((amount / total) * 100) : 0)

  return (
    <div className={styles.donut}>
      <svg viewBox="0 0 160 160" className={styles.ring} role="img" aria-label={`${formatNaira(total)} paid: ${items.map((item) => `${item.label} ${percent(item.amount)}%`).join(', ')}`}>
        <circle cx="80" cy="80" r={RADIUS} className={styles.track} />
        <g transform="rotate(-90 80 80)">
          {items.map((item, i) => (
            <circle
              key={item.label}
              cx="80"
              cy="80"
              r={RADIUS}
              stroke={COLORS[i % COLORS.length]}
              className={styles.arc}
              strokeDasharray={`${lengths[i]} ${CIRCUMFERENCE - lengths[i]}`}
              strokeDashoffset={-offsets[i]}
            />
          ))}
        </g>
        <text x="80" y="78" textAnchor="middle" className={styles.total}>
          {formatNaira(total)}
        </text>
        <text x="80" y="97" textAnchor="middle" className={styles.caption}>
          {caption}
        </text>
      </svg>
      <ul className={styles.legend}>
        {items.map((item, i) => (
          <li key={item.label}>
            <span className={styles.dot} style={{ background: COLORS[i % COLORS.length] }} aria-hidden="true" />
            <span className={styles.label}>
              {item.label}
              <strong>{formatNaira(item.amount)}</strong>
            </span>
            <span className={styles.share}>{percent(item.amount)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
