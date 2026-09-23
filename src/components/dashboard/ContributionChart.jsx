import { useId, useRef } from 'react'
import { formatDay, formatNaira, formatNairaShort } from '../../lib/format.js'
import { axisLabel, labelIndexes, useWidth, yTicks } from './chartUtils.js'
import styles from './ContributionChart.module.css'

const HEIGHT = 282
const PAD = { top: 44, right: 22, bottom: 40, left: 62 }

// The fund's verified total, day by day, as an area chart. `timeline` comes from
// GET /campaigns/:id/overview: [{ date: "YYYY-MM-DD", total }], one entry per day.
export function ContributionChart({ timeline, target }) {
  const box = useRef(null)
  const width = useWidth(box)
  const gradientId = useId()

  const last = timeline.at(-1)?.total ?? 0
  const ticks = yTicks(Math.max(target, last))
  const top = ticks.at(-1)

  const plotWidth = Math.max(width - PAD.left - PAD.right, 1)
  const plotHeight = HEIGHT - PAD.top - PAD.bottom
  const x = (index) => PAD.left + (timeline.length > 1 ? (index / (timeline.length - 1)) * plotWidth : plotWidth / 2)
  const y = (value) => PAD.top + plotHeight - (value / top) * plotHeight

  // A dot wherever the total changed, plus the first and last day.
  const points = timeline
    .map((point, index) => ({ ...point, index }))
    .filter((point, index) => index === 0 || index === timeline.length - 1 || point.total !== timeline[index - 1].total)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.index).toFixed(1)},${y(p.total).toFixed(1)}`).join(' ')
  const area = points.length
    ? `${line} L${x(points.at(-1).index).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`
    : ''
  const end = points.at(-1)

  const labels = labelIndexes(timeline.length, width < 420 ? 4 : 6)

  const summary = timeline.length
    ? `${formatNaira(last)} collected between ${formatDay(timeline[0].date)} and ${formatDay(timeline.at(-1).date)}`
    : 'No contributions yet'

  return (
    <div ref={box} className={styles.chart}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label={summary}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--progress)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--progress)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {ticks.map((tick) => (
            <g key={tick}>
              <line className={styles.grid} x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} />
              <text className={styles.axis} x={PAD.left - 14} y={y(tick)} textAnchor="end" dominantBaseline="middle">
                {axisLabel(tick)}
              </text>
            </g>
          ))}
          {labels.map((index) => (
            <g key={index}>
              <line className={styles.grid} x1={x(index)} x2={x(index)} y1={PAD.top} y2={y(0)} />
              <text className={styles.axis} x={x(index)} y={HEIGHT - 12} textAnchor="middle">
                {formatDay(timeline[index].date)}
              </text>
            </g>
          ))}

          {points.length > 0 && (
            <>
              <path d={area} fill={`url(#${gradientId})`} />
              <path d={line} className={styles.line} />
              {points.map((p) => (
                <circle key={p.index} cx={x(p.index)} cy={y(p.total)} r="3.6" className={styles.point} />
              ))}
              <Bubble x={Math.min(x(end.index), width - PAD.right - 32)} y={y(end.total)} text={formatNairaShort(end.total)} />
            </>
          )}
        </svg>
      )}
    </div>
  )
}

// The dark label above the latest point, e.g. "₦2.85M".
function Bubble({ x, y, text }) {
  const width = text.length * 8.4 + 22
  return (
    <g transform={`translate(${x - width / 2}, ${Math.max(y - 44, 2)})`}>
      <rect width={width} height="28" rx="5" className={styles.bubble} />
      <text x={width / 2} y="14.5" textAnchor="middle" dominantBaseline="middle" className={styles.bubbleText}>
        {text}
      </text>
    </g>
  )
}
