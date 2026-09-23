import { useId, useRef } from 'react'
import { formatDay, formatNaira } from '../../lib/format.js'
import { axisLabel, labelIndexes, useWidth, yTicks } from './chartUtils.js'
import styles from './FundFlowChart.module.css'

const HEIGHT = 250
const PAD = { top: 16, right: 16, bottom: 36, left: 58 }

// "Fund Flow Overview" from the Transparency Report design: one line per series over
// the same days, the first series shaded underneath. `series` is
// [{ label, color, values: [one number per date] }] and `dates` the matching days.
export function FundFlowChart({ dates, series }) {
  const box = useRef(null)
  const width = useWidth(box)
  const gradientId = useId()

  const highest = Math.max(0, ...series.flatMap((one) => one.values))
  const ticks = yTicks(highest)
  const top = ticks.at(-1)
  const plotWidth = Math.max(width - PAD.left - PAD.right, 1)
  const plotHeight = HEIGHT - PAD.top - PAD.bottom
  const x = (index) => PAD.left + (dates.length > 1 ? (index / (dates.length - 1)) * plotWidth : plotWidth / 2)
  const y = (value) => PAD.top + plotHeight - (Math.max(value, 0) / top) * plotHeight

  // A point wherever a series changes, plus its first and last day.
  const pointsOf = (values) =>
    values.map((value, index) => ({ value, index })).filter((point, index) => index === 0 || index === values.length - 1 || point.value !== values[index - 1])
  const pathOf = (points) => points.map((p, i) => `${i ? 'L' : 'M'}${x(p.index).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')

  const summary = series.map((one) => `${one.label} ${formatNaira(one.values.at(-1) ?? 0)}`).join(', ')

  return (
    <div className={styles.chart}>
      <ul className={styles.legend}>
        {series.map((one) => (
          <li key={one.label}>
            <span style={{ background: one.color }} aria-hidden="true" />
            {one.label}
          </li>
        ))}
      </ul>
      <div ref={box}>
        {width > 0 && dates.length > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label={`By ${formatDay(dates.at(-1))}: ${summary}`}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={series[0].color} stopOpacity="0.2" />
                <stop offset="100%" stopColor={series[0].color} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {ticks.map((tick) => (
              <g key={tick}>
                <line className={styles.grid} x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} />
                <text className={styles.axis} x={PAD.left - 12} y={y(tick)} textAnchor="end" dominantBaseline="middle">
                  {axisLabel(tick)}
                </text>
              </g>
            ))}
            {labelIndexes(dates.length, width < 420 ? 4 : 7).map((index) => (
              <g key={index}>
                <line className={styles.grid} x1={x(index)} x2={x(index)} y1={PAD.top} y2={y(0)} />
                <text className={styles.axis} x={x(index)} y={HEIGHT - 10} textAnchor="middle">
                  {formatDay(dates[index])}
                </text>
              </g>
            ))}
            {series.map((one, seriesIndex) => {
              const points = pointsOf(one.values)
              const line = pathOf(points)
              return (
                <g key={one.label}>
                  {seriesIndex === 0 && (
                    <path
                      d={`${line} L${x(points.at(-1).index).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`}
                      fill={`url(#${gradientId})`}
                    />
                  )}
                  <path d={line} fill="none" stroke={one.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
                  {points.map((p) => (
                    <circle key={p.index} cx={x(p.index)} cy={y(p.value)} r="3.3" fill={one.color} />
                  ))}
                </g>
              )
            })}
          </svg>
        )}
      </div>
    </div>
  )
}
