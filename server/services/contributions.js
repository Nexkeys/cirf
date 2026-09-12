import { FieldValue } from 'firebase-admin/firestore'

export const PAYMENT_METHODS = ['bank_transfer', 'cash', 'pos', 'mobile_money', 'other']

// The campaign fields to write when a contribution becomes verified, and whether this
// payment is the one that pushed the fund past its target.
//
// `campaign` is the campaign data read inside the same transaction, so the running
// totals can't be thrown off by two admins verifying at the same moment.
export function totalsAfterVerifying(campaign, amount, { wasPending }) {
  const totalCollected = campaign.totalCollected + amount
  const targetJustReached =
    !campaign.targetReachedAt &&
    campaign.totalCollected < campaign.targetAmount &&
    totalCollected >= campaign.targetAmount

  return {
    targetJustReached,
    update: {
      totalCollected,
      verifiedCount: campaign.verifiedCount + 1,
      ...(wasPending && {
        pendingAmount: campaign.pendingAmount - amount,
        pendingCount: campaign.pendingCount - 1,
      }),
      ...(targetJustReached && { targetReachedAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
    },
  }
}
