import styles from './PaymentDonut.module.css'

const RADIUS = 60
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const SEGMENTS = [
  { key: 'paid', label: 'Paid', color: 'var(--paid)' },
  { key: 'pending', label: 'Pending', color: 'var(--pending)' },
  { key: 'overdue', label: 'Overdue', color: 'var(--overdue)' },
]

// Households that have paid in full, still owe, or owe past the deadline.
// `counts` is overview.contributors from GET /campaigns/:id/overview.
export function PaymentDonut({ counts }) {
  const { total } = counts
  const percent = (value) => (total ? Math.round((value / total) * 100) : 0)

  // Each arc starts where the ones before it end.
  const shown = SEGMENTS.filter((segment) => counts[segment.key] > 0)
  const lengths = shown.map((segment) => (counts[segment.key] / total) * CIRCUMFERENCE)
  const arcs = shown.map((segment, i) => ({
    ...segment,
    length: lengths[i],
    offset: lengths.slice(0, i).reduce((sum, length) => sum + length, 0),
  }))

  return (
    <div className={styles.donut}>
      <svg viewBox="0 0 160 160" className={styles.ring} aria-hidden="true">
        <circle cx="80" cy="80" r={RADIUS} className={styles.track} />
        {/* Rotated so the first segment starts at 12 o'clock and runs clockwise. */}
        <g transform="rotate(-90 80 80)">
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx="80"
              cy="80"
              r={RADIUS}
              stroke={arc.color}
              className={styles.arc}
              strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
              strokeDashoffset={-arc.offset}
            />
          ))}
        </g>
        <text x="80" y="76" textAnchor="middle" className={styles.total}>
          {total}
        </text>
        <text x="80" y="100" textAnchor="middle" className={styles.totalLabel}>
          Total
        </text>
      </svg>

      <ul className={styles.legend}>
        {SEGMENTS.map((segment) => (
          <li key={segment.key}>
            <span className={styles.swatch} style={{ background: segment.color }} />
            <span className={styles.label}>{segment.label}</span>
            <span className={styles.count}>
              {counts[segment.key]} ({percent(counts[segment.key])}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
