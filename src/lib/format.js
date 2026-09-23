// How money, dates and names read across the dashboards.

const naira = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 })

// ₦2,850,000
export const formatNaira = (amount) => `₦${naira.format(amount ?? 0)}`

// ₦2.85M, ₦850K: for chart labels, where space is tight.
export function formatNairaShort(amount, digits = 2) {
  const value = amount ?? 0
  if (Math.abs(value) >= 1_000_000) return `₦${trim((value / 1_000_000).toFixed(digits))}M`
  if (Math.abs(value) >= 1_000) return `₦${trim((value / 1_000).toFixed(digits))}K`
  return `₦${value}`
}
const trim = (text) => text.replace(/\.?0+$/, '')

// Dates from the API are either "YYYY-MM-DD" (deadlines) or full ISO timestamps. A plain
// day is read as that day in Nigeria, not as UTC midnight.
const toDate = (value) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+01:00` : value)

// Sep 30, 2026
export const formatDate = (value) =>
  value ? toDate(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Africa/Lagos' }) : ''

// Sep 30
export const formatDay = (value) =>
  value ? toDate(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Africa/Lagos' }) : ''

// Whole days from today until a "YYYY-MM-DD" deadline, counting in Nigerian days.
export function daysUntil(deadline, now = new Date()) {
  if (!deadline) return null
  const today = new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10)
  return Math.round((Date.parse(deadline) - Date.parse(today)) / 86_400_000)
}

export const firstName = (name = '') => name.trim().split(/\s+/)[0]

// "John Doe" -> "JD"
export const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

export const ROLE_LABELS = { admin: 'Community Lead', resident: 'Resident' }

export function greeting(now = new Date()) {
  const hour = now.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

// The Nigerian calendar day of a timestamp, as "YYYY-MM-DD" (WAT is UTC+1 all year).
export const lagosDay = (iso) => new Date(new Date(iso).getTime() + 3_600_000).toISOString().slice(0, 10)
