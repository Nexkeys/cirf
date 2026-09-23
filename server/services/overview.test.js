import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { campaignOverview, lagosDate } from './overview.js'

const campaign = {
  levyMethod: 'flat',
  levyPerHousehold: 50_000,
  targetAmount: 150_000,
  totalCollected: 110_000,
  deadline: '2026-09-30',
  publishedAt: '2026-09-10T09:00:00.000Z',
  completedAt: null,
  selectedQuoteId: null,
  selectedQuoteAmount: null,
  actualCost: null,
}
const members = [{ id: 'ada' }, { id: 'bola' }, { id: 'chidi' }, { id: 'dayo', status: 'suspended' }]
const contributions = [
  { userId: 'ada', amount: 50_000, status: 'verified', verifiedAt: '2026-09-11T10:00:00.000Z' },
  { userId: 'bola', amount: 30_000, status: 'verified', verifiedAt: '2026-09-13T23:30:00.000Z' },
  { userId: 'bola', amount: 30_000, status: 'verified', verifiedAt: '2026-09-14T08:00:00.000Z' },
  { userId: 'chidi', amount: 50_000, status: 'pending', createdAt: '2026-09-14T09:00:00.000Z' },
]
const overview = (changes = {}, now = '2026-09-14T12:00:00.000Z') =>
  campaignOverview({ campaign: { ...campaign, ...changes }, members, contributions, quotes: [], now: new Date(now) })

describe('lagosDate', () => {
  it('uses the Nigerian calendar day, an hour ahead of UTC', () => {
    assert.equal(lagosDate('2026-09-13T23:30:00.000Z'), '2026-09-14')
    assert.equal(lagosDate('2026-09-13T22:59:59.000Z'), '2026-09-13')
  })
})

describe('campaignOverview', () => {
  it('counts paid and pending households, leaving out suspended ones', () => {
    assert.deepEqual(overview().contributors, { total: 3, paid: 2, pending: 1, overdue: 0 })
  })

  it('treats everyone still owing as overdue once the deadline has passed', () => {
    assert.deepEqual(overview({}, '2026-10-01T12:00:00.000Z').contributors, {
      total: 3,
      paid: 2,
      pending: 0,
      overdue: 1,
    })
  })

  it('builds a running total for each day from opening to today', () => {
    const { timeline } = overview()
    assert.deepEqual(timeline, [
      { date: '2026-09-10', total: 0 },
      { date: '2026-09-11', total: 50_000 },
      { date: '2026-09-12', total: 50_000 },
      { date: '2026-09-13', total: 50_000 },
      { date: '2026-09-14', total: 110_000 },
    ])
  })

  it('adds up verified money from the last seven days only', () => {
    assert.equal(overview().collectedThisWeek, 110_000)
    assert.equal(overview({}, '2026-09-19T12:00:00.000Z').collectedThisWeek, 60_000)
  })

  it('estimates the refund from the selected quote, then from the actual cost', () => {
    assert.equal(overview().estimate, null)
    assert.deepEqual(overview({ selectedQuoteId: 'q1', selectedQuoteAmount: 100_000 }).estimate, {
      basis: 'quote',
      cost: 100_000,
      difference: 10_000,
    })
    assert.deepEqual(overview({ selectedQuoteId: 'q1', selectedQuoteAmount: 100_000, actualCost: 125_000 }).estimate, {
      basis: 'actual',
      cost: 125_000,
      difference: -15_000,
    })
  })
})
