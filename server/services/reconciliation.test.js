import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { reconcile } from './reconciliation.js'

const contributions = [
  { userId: 'ada', amount: 50_000 },
  { userId: 'bola', amount: 30_000 },
  { userId: 'chidi', amount: 20_000 },
]

const adjustments = (result) =>
  Object.fromEntries(result.perContributor.map((row) => [row.userId, row.adjustment]))

const sumOfAdjustments = (result) =>
  result.perContributor.reduce((sum, row) => sum + row.adjustment, 0)

describe('reconcile', () => {
  it('refunds a surplus in proportion to what each contributor paid', () => {
    const result = reconcile(90_000, contributions)

    assert.equal(result.totalCollected, 100_000)
    assert.equal(result.variance, 10_000)
    assert.equal(result.outcome, 'refund')
    assert.deepEqual(adjustments(result), { ada: 5_000, bola: 3_000, chidi: 2_000 })
    assert.deepEqual(
      result.perContributor.map((row) => row.finalShare),
      [45_000, 27_000, 18_000],
    )
  })

  it('asks for a shortfall in proportion to what each contributor paid', () => {
    const result = reconcile(110_000, contributions)

    assert.equal(result.variance, -10_000)
    assert.equal(result.outcome, 'balance_owed')
    assert.deepEqual(adjustments(result), { ada: -5_000, bola: -3_000, chidi: -2_000 })
  })

  it('marks the campaign settled with no adjustments when the cost matches', () => {
    const result = reconcile(100_000, contributions)

    assert.equal(result.variance, 0)
    assert.equal(result.outcome, 'settled')
    assert.deepEqual(adjustments(result), { ada: 0, bola: 0, chidi: 0 })
  })

  it('adds up several contributions from the same person', () => {
    const result = reconcile(40_000, [
      { userId: 'ada', amount: 10_000 },
      { userId: 'bola', amount: 20_000 },
      { userId: 'ada', amount: 10_000 },
    ])

    assert.equal(result.contributorCount, 2)
    assert.deepEqual(
      result.perContributor.map(({ userId, paid, sharePercent }) => ({ userId, paid, sharePercent })),
      [
        { userId: 'ada', paid: 20_000, sharePercent: 50 },
        { userId: 'bola', paid: 20_000, sharePercent: 50 },
      ],
    )
  })

  it('never loses or invents a Naira when the split does not divide evenly', () => {
    const equalThree = [
      { userId: 'a', amount: 10_000 },
      { userId: 'b', amount: 10_000 },
      { userId: 'c', amount: 10_000 },
    ]

    // 100 Naira across three equal payers: 34 + 33 + 33, tie broken by userId.
    assert.deepEqual(adjustments(reconcile(29_900, equalThree)), { a: 34, b: 33, c: 33 })
    assert.deepEqual(adjustments(reconcile(30_100, equalThree)), { a: -34, b: -33, c: -33 })

    const uneven = [
      { userId: 'u1', amount: 7_777 },
      { userId: 'u2', amount: 12_345 },
      { userId: 'u3', amount: 3_001 },
      { userId: 'u4', amount: 999 },
    ]
    for (const actualCost of [1, 9_999, 20_000, 24_121, 24_123, 50_000]) {
      const result = reconcile(actualCost, uneven)
      assert.equal(sumOfAdjustments(result), result.variance, `actualCost ${actualCost}`)
    }
  })

  it('reports the whole shortfall as unallocated when nobody has contributed', () => {
    const result = reconcile(50_000, [])

    assert.equal(result.totalCollected, 0)
    assert.equal(result.outcome, 'balance_owed')
    assert.equal(result.unallocated, 50_000)
    assert.deepEqual(result.perContributor, [])
  })

  it('rejects amounts that are not whole, positive Naira', () => {
    assert.throws(() => reconcile(-1, contributions), RangeError)
    assert.throws(() => reconcile(1_000, [{ userId: 'ada', amount: 100.5 }]), RangeError)
    assert.throws(() => reconcile(1_000, [{ userId: 'ada', amount: 0 }]), RangeError)
  })
})
