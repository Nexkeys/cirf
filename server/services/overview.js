// The figures on the dashboard's Overview screen for one campaign: who has paid, how the
// fund grew day by day, money in this week, and the likely refund or shortfall.
// Pure functions only, see overview.test.js.
import { paymentStatus } from './levy.js'

const DAY_MS = 24 * 60 * 60 * 1000
const LAGOS_OFFSET_MS = 60 * 60 * 1000 // West Africa Time is UTC+1 all year

// The calendar day an ISO timestamp falls on in Nigeria, as "YYYY-MM-DD".
export const lagosDate = (iso) => new Date(new Date(iso).getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10)

const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)

// Money counts toward the fund on the day an admin verified it.
const countedOn = (contribution) => lagosDate(contribution.verifiedAt ?? contribution.createdAt)

export function campaignOverview({ campaign, members, contributions, quotes, now = new Date() }) {
  const today = lagosDate(now.toISOString())
  const verified = contributions.filter((c) => c.status === 'verified' && (c.verifiedAt ?? c.createdAt))

  return {
    contributors: contributorCounts(campaign, members, contributions, today),
    collectedThisWeek: verified
      .filter((c) => countedOn(c) > addDays(today, -7))
      .reduce((sum, c) => sum + c.amount, 0),
    quotes: {
      count: quotes.length,
      selected: Boolean(campaign.selectedQuoteId),
    },
    estimate: refundEstimate(campaign),
    timeline: fundTimeline(campaign, verified, today),
  }
}

// Paid, pending and overdue households. Overdue means the deadline has passed without
// the full levy being paid; before the deadline everyone still owing is pending.
function contributorCounts(campaign, members, contributions, today) {
  const active = members.filter((member) => member.status !== 'suspended')
  const rows = paymentStatus(campaign, active, contributions)
  const paid = rows.filter((row) => row.status === 'paid').length
  const pastDeadline = Boolean(campaign.deadline) && campaign.deadline < today
  const owing = rows.length - paid

  return {
    total: rows.length,
    paid,
    pending: pastDeadline ? 0 : owing,
    overdue: pastDeadline ? owing : 0,
  }
}

// Collected minus what the repair costs: the actual cost once the repair is complete,
// otherwise the selected vendor's quote. Positive is a refund, negative a shortfall.
function refundEstimate(campaign) {
  const cost = campaign.actualCost ?? campaign.selectedQuoteAmount
  if (cost == null) return null
  return {
    basis: campaign.actualCost == null ? 'quote' : 'actual',
    cost,
    difference: campaign.totalCollected - cost,
  }
}

// The verified total at the end of each day, from the day the campaign opened to today
// (or to the day the repair was completed, once it is).
function fundTimeline(campaign, verified, today) {
  const opened = campaign.publishedAt ?? campaign.createdAt
  if (!opened) return []

  const byDay = new Map()
  for (const contribution of verified) {
    const day = countedOn(contribution)
    byDay.set(day, (byDay.get(day) ?? 0) + contribution.amount)
  }

  const start = lagosDate(opened)
  const end = campaign.completedAt ? lagosDate(campaign.completedAt) : today
  const earliest = [...byDay.keys()].sort()[0]
  const first = earliest && earliest < start ? earliest : start

  const points = []
  let total = 0
  for (let day = first; day <= end; day = addDays(day, 1)) {
    total += byDay.get(day) ?? 0
    points.push({ date: day, total })
  }
  return points
}
