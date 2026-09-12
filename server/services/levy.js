// Levy maths: how much each household is asked to pay toward a campaign.
//
//   'flat'     -> the target is split evenly across every household in the estate.
//   'per_unit' -> the target is split across units, so a landlord with 4 flats pays 4x.
//
// Levies round up to the next Naira so rounding can never leave the estate short of
// the target. Pure functions only, see levy.test.js.

export const LEVY_METHODS = ['flat', 'per_unit']

export function computeLevy({ targetAmount, levyMethod, totalHouseholds, totalUnits }) {
  if (levyMethod === 'flat') {
    assertCount(totalHouseholds, 'totalHouseholds')
    return { levyMethod, levyPerHousehold: Math.ceil(targetAmount / totalHouseholds), levyPerUnit: null }
  }
  if (levyMethod === 'per_unit') {
    assertCount(totalUnits, 'totalUnits')
    return { levyMethod, levyPerHousehold: null, levyPerUnit: Math.ceil(targetAmount / totalUnits) }
  }
  throw new RangeError(`Unknown levy method: ${levyMethod}`)
}

// What one resident is expected to pay toward a campaign.
export function expectedLevy(campaign, resident) {
  return campaign.levyMethod === 'per_unit'
    ? campaign.levyPerUnit * (resident.units ?? 1)
    : campaign.levyPerHousehold
}

// Who has and hasn't paid, for the admin contributor list. `contributions` is every
// contribution on the campaign in any status; only verified money counts as paid.
export function paymentStatus(campaign, residents, contributions) {
  const totalsByUser = new Map()
  for (const contribution of contributions) {
    const totals = totalsByUser.get(contribution.userId) ?? { paid: 0, pending: 0 }
    if (contribution.status === 'verified') totals.paid += contribution.amount
    if (contribution.status === 'pending') totals.pending += contribution.amount
    totalsByUser.set(contribution.userId, totals)
  }

  return residents.map((resident) => {
    const expected = expectedLevy(campaign, resident)
    const { paid, pending } = totalsByUser.get(resident.id) ?? { paid: 0, pending: 0 }

    let status = 'unpaid'
    if (paid >= expected) status = 'paid'
    else if (paid > 0) status = 'partial'
    else if (pending > 0) status = 'pending'

    return {
      userId: resident.id,
      name: resident.name,
      unitNumber: resident.unitNumber ?? null,
      units: resident.units ?? 1,
      expected,
      paid,
      pending,
      balance: Math.max(expected - paid, 0),
      status,
    }
  })
}

function assertCount(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive whole number, got ${value}`)
  }
}
