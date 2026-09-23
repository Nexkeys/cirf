import { Cable, Droplets, UtilityPole, Wrench, Zap } from 'lucide-react'

// What a campaign can be for, as the Supported Categories list describes them. The keys
// match CAMPAIGN_CATEGORIES in server/services/campaigns.js.
export const CATEGORIES = [
  { value: 'transformer', label: 'Transformer', detail: 'Power transformers and related equipment', icon: Zap },
  { value: 'pole', label: 'Pole', detail: 'Electricity poles and fittings', icon: UtilityPole },
  { value: 'cable', label: 'Cable', detail: 'Distribution and connection cables', icon: Cable },
  { value: 'borehole', label: 'Borehole', detail: 'Water boreholes and water systems', icon: Droplets },
  { value: 'other', label: 'Other', detail: 'Miscellaneous infrastructure repairs', icon: Wrench },
]

export const categoryLabel = (value) => CATEGORIES.find((category) => category.value === value)?.label ?? value

// Payment methods the API accepts (PAYMENT_METHODS in server/services/contributions.js).
export const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'pos', label: 'POS' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'other', label: 'Other' },
]

export const methodLabel = (value) => PAYMENT_METHODS.find((method) => method.value === value)?.label ?? value

// Residents can pay while the fund is open and while the repair is underway.
export const acceptsContributions = (campaign) => ['fundraising', 'repairing'].includes(campaign?.status)

// "YYYY-MM-DD" for a day `days` from today, in Nigerian time. Used for deadlines.
export function dayFromToday(days, now = new Date()) {
  return new Date(now.getTime() + 60 * 60 * 1000 + days * 86_400_000).toISOString().slice(0, 10)
}

// A reference residents can put on their bank transfer so the lead can match it, e.g.
// "MapleEstate-2026-09-28-JD".
export function transferReference(estateName, payerName, now = new Date()) {
  const estate = (estateName ?? 'CIRF').replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ').map(capitalise).join('')
  const initials = (payerName ?? '').trim().split(/\s+/).map((part) => part[0]?.toUpperCase() ?? '').join('').slice(0, 3)
  return [estate || 'CIRF', dayFromToday(0, now), initials].filter(Boolean).join('-')
}

const capitalise = (word) => word.charAt(0).toUpperCase() + word.slice(1)

// Whole naira from what someone typed: "2,850,000" or "₦2850000" -> 2850000.
export const parseNaira = (text) => {
  const digits = String(text ?? '').replace(/[^\d]/g, '')
  return digits ? Number(digits) : null
}

// 2850000 -> "2,850,000", for showing an amount inside an input as it's typed.
export const groupDigits = (value) => (value == null || value === '' ? '' : new Intl.NumberFormat('en-NG').format(value))

// The campaign the dashboards focus on: the newest one still raising money or being
// repaired, then the newest finished one, then (for admins, who can see them) a draft.
const FEATURE_ORDER = ['fundraising', 'repairing', 'completed', 'reconciled', 'draft']
export const pickFeatured = (campaigns) =>
  FEATURE_ORDER.map((status) => campaigns.find((campaign) => campaign.status === status)).find(Boolean)
