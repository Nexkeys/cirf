// Reconciliation engine: compares what was collected with what the repair actually
// cost, then splits the difference across contributors in proportion to what each
// one paid.
//
// This module is pure: no Firestore, no Express. The reconcile route loads the
// verified contributions, calls reconcile(), and stores the result. That keeps the
// maths testable with plain numbers (see reconciliation.test.js).
//
// All amounts are whole Naira (integers).

export function reconcile(actualCost, contributions) {
  assertWholeNaira(actualCost, 'actualCost', { allowZero: true })

  // A resident can contribute more than once, so total per contributor first.
  const paidByUser = new Map()
  for (const { userId, amount } of contributions) {
    assertWholeNaira(amount, 'contribution amount')
    paidByUser.set(userId, (paidByUser.get(userId) ?? 0) + amount)
  }

  const totalCollected = [...paidByUser.values()].reduce((sum, paid) => sum + paid, 0)
  const variance = totalCollected - actualCost
  const outcome = variance > 0 ? 'refund' : variance < 0 ? 'balance_owed' : 'settled'

  const shares = splitProportionally(Math.abs(variance), paidByUser, totalCollected)

  const perContributor = [...paidByUser].map(([userId, paid]) => {
    const share = shares.get(userId)
    // Positive = refund owed to the contributor, negative = extra balance they owe.
    const adjustment = share === 0 ? 0 : variance < 0 ? -share : share
    return {
      userId,
      paid,
      sharePercent: Math.round((paid / totalCollected) * 10000) / 100,
      adjustment,
      // How much of this contributor's money ends up covering the actual cost.
      finalShare: paid - adjustment,
    }
  })

  return {
    totalCollected,
    actualCost,
    variance,
    outcome,
    contributorCount: paidByUser.size,
    // Only non-zero when there is a shortfall but nobody has contributed to share it.
    unallocated: paidByUser.size === 0 ? Math.abs(variance) : 0,
    perContributor,
  }
}

// Splits `amount` Naira across contributors in proportion to what they paid, using
// the largest remainder method so the shares always add up to exactly `amount`.
// Rounding each share on its own (Math.round) can leave the books a few Naira off.
function splitProportionally(amount, paidByUser, totalCollected) {
  const shares = new Map()
  if (amount === 0 || totalCollected === 0) {
    for (const userId of paidByUser.keys()) shares.set(userId, 0)
    return shares
  }

  // BigInt keeps amount * paid exact even for very large funds.
  const total = BigInt(totalCollected)
  const rows = [...paidByUser].map(([userId, paid]) => {
    const exact = BigInt(amount) * BigInt(paid)
    return { userId, paid, floor: Number(exact / total), remainder: exact % total }
  })

  const leftover = amount - rows.reduce((sum, row) => sum + row.floor, 0)

  // Hand out the leftover Naira one each, biggest remainder first. Ties go to whoever
  // paid more, then to the lower userId, so the same input always gives the same result.
  rows.sort((a, b) => {
    if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1
    if (a.paid !== b.paid) return b.paid - a.paid
    return a.userId < b.userId ? -1 : 1
  })
  rows.forEach((row, index) => shares.set(row.userId, row.floor + (index < leftover ? 1 : 0)))

  return shares
}

function assertWholeNaira(value, label, { allowZero = false } = {}) {
  if (!Number.isSafeInteger(value) || value < 0 || (value === 0 && !allowZero)) {
    const kind = allowZero ? 'non-negative' : 'positive'
    throw new RangeError(`${label} must be a ${kind} whole Naira amount, got ${value}`)
  }
}
