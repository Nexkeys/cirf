import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { computeLevy, expectedLevy, paymentStatus } from './levy.js'

describe('computeLevy', () => {
  it('splits a flat levy evenly across households, rounding up', () => {
    assert.deepEqual(
      computeLevy({ targetAmount: 100_000, levyMethod: 'flat', totalHouseholds: 30 }),
      { levyMethod: 'flat', levyPerHousehold: 3_334, levyPerUnit: null },
    )
  })

  it('splits a per-unit levy across units', () => {
    assert.deepEqual(
      computeLevy({ targetAmount: 3_700_000, levyMethod: 'per_unit', totalUnits: 185 }),
      { levyMethod: 'per_unit', levyPerHousehold: null, levyPerUnit: 20_000 },
    )
  })

  it('rejects unknown methods and empty estates', () => {
    assert.throws(() => computeLevy({ targetAmount: 1, levyMethod: 'by_vibes', totalHouseholds: 1 }), RangeError)
    assert.throws(() => computeLevy({ targetAmount: 1, levyMethod: 'flat', totalHouseholds: 0 }), RangeError)
  })
})

describe('expectedLevy', () => {
  it('charges per-unit campaigns by the number of units a resident has', () => {
    const campaign = { levyMethod: 'per_unit', levyPerUnit: 20_000 }
    assert.equal(expectedLevy(campaign, { units: 4 }), 80_000)
    assert.equal(expectedLevy(campaign, {}), 20_000)
  })

  it('charges flat campaigns the same for everyone', () => {
    const campaign = { levyMethod: 'flat', levyPerHousehold: 15_000 }
    assert.equal(expectedLevy(campaign, { units: 4 }), 15_000)
  })
})

describe('paymentStatus', () => {
  it('works out who has paid, part-paid, is awaiting verification, or has not paid', () => {
    const campaign = { levyMethod: 'flat', levyPerHousehold: 20_000 }
    const residents = [
      { id: 'ada', name: 'Ada' },
      { id: 'bola', name: 'Bola' },
      { id: 'chidi', name: 'Chidi' },
      { id: 'dayo', name: 'Dayo' },
    ]
    const contributions = [
      { userId: 'ada', amount: 20_000, status: 'verified' },
      { userId: 'bola', amount: 5_000, status: 'verified' },
      { userId: 'bola', amount: 15_000, status: 'pending' },
      { userId: 'chidi', amount: 20_000, status: 'pending' },
      { userId: 'dayo', amount: 20_000, status: 'rejected' },
    ]

    const rows = paymentStatus(campaign, residents, contributions)

    assert.deepEqual(
      rows.map(({ userId, paid, pending, balance, status }) => ({ userId, paid, pending, balance, status })),
      [
        { userId: 'ada', paid: 20_000, pending: 0, balance: 0, status: 'paid' },
        { userId: 'bola', paid: 5_000, pending: 15_000, balance: 15_000, status: 'partial' },
        { userId: 'chidi', paid: 0, pending: 20_000, balance: 20_000, status: 'pending' },
        { userId: 'dayo', paid: 0, pending: 0, balance: 20_000, status: 'unpaid' },
      ],
    )
  })
})
