import { useLayoutEffect, useState } from 'react'

// Shared by the line charts (Contribution Trend, Fund Flow).

// ₦0, ₦250K, ₦1.0M, ₦2.5M: millions keep one decimal, like the designs' axes.
export function axisLabel(value) {
  if (value >= 1_000_000) return `₦${(value / 1_000_000).toFixed(2).replace(/0$/, '')}M`
  if (value >= 1_000) return `₦${value / 1_000}K`
  return `₦${value}`
}

// Four or five round-number steps from ₦0 up past the highest value, e.g. ₦0–₦4.0M.
export function yTicks(max) {
  if (!max) return [0, 250_000, 500_000, 750_000, 1_000_000]
  const rough = max / 4
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough)
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step)
}

// Which points get a date under them: up to `count`, spread evenly, first and last included.
export function labelIndexes(length, count) {
  const shown = Math.min(length, count)
  return [...new Set(Array.from({ length: shown }, (_, i) => Math.round((i * (length - 1)) / Math.max(shown - 1, 1))))]
}

// The rendered width of an element, kept up to date as the layout changes.
export function useWidth(ref) {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return width
}
