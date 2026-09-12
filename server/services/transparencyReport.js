import { docToJson, oldestFirst } from '../lib/firestore.js'
import { formatNaira } from '../lib/money.js'
import { eventsOf } from './audit.js'
import { collections } from './collections.js'
import { loadEstate } from './estates.js'

// Builds the full audit trail for one campaign: summary, timeline, verified
// contributions, vendor quotes and the reconciliation. The JSON route, the PDF and the
// public link all use this, so they can never disagree with each other.
//
// anonymize: true for the public link. Contributors become "Contributor 1, 2, ..." and
// names, unit numbers and payment references are left out. Amounts, vendors and the
// maths stay, because those are what outsiders need to judge whether the fund was
// handled honestly.
export async function buildTransparencyReport(campaign, { anonymize }) {
  const [estate, contributionsSnapshot, quotesSnapshot, reconciliationSnapshot, eventsSnapshot] =
    await Promise.all([
      loadEstate(campaign.estateId),
      collections.contributions
        .where('campaignId', '==', campaign.id)
        .where('status', '==', 'verified')
        .get(),
      collections.vendorQuotes.where('campaignId', '==', campaign.id).get(),
      collections.reconciliations.doc(campaign.id).get(),
      eventsOf(campaign.id).get(),
    ])

  const contributions = contributionsSnapshot.docs.map(docToJson).sort(oldestFirst('verifiedAt'))

  // Numbered in the order people first contributed.
  const labels = new Map()
  for (const contribution of contributions) {
    if (!labels.has(contribution.userId)) labels.set(contribution.userId, `Contributor ${labels.size + 1}`)
  }
  const who = (userId, name) => (anonymize ? (labels.get(userId) ?? 'Contributor') : name)
  // List reconciliation rows in that same order, so Contributor 1 comes first.
  const position = new Map([...labels.keys()].map((userId, index) => [userId, index]))
  const byContributorOrder = (a, b) => (position.get(a.userId) ?? Infinity) - (position.get(b.userId) ?? Infinity)

  const reconciliation = reconciliationSnapshot.exists ? docToJson(reconciliationSnapshot) : null

  return {
    generatedAt: new Date().toISOString(),
    anonymized: anonymize,
    estate: { name: estate.name, address: anonymize ? null : estate.address },
    campaign: {
      id: campaign.id,
      title: campaign.title,
      description: campaign.description,
      category: campaign.category,
      status: campaign.status,
      imageUrl: campaign.imageUrl,
      levyMethod: campaign.levyMethod,
      levyPerHousehold: campaign.levyPerHousehold,
      levyPerUnit: campaign.levyPerUnit,
      deadline: campaign.deadline,
      createdAt: campaign.createdAt,
      publishedAt: campaign.publishedAt,
      repairStartedAt: campaign.repairStartedAt,
      completedAt: campaign.completedAt,
      reconciledAt: campaign.reconciledAt,
      receiptUrl: campaign.receiptUrl,
      completionNote: campaign.completionNote,
    },
    summary: {
      targetAmount: campaign.targetAmount,
      totalCollected: campaign.totalCollected,
      contributorCount: labels.size,
      verifiedContributionCount: contributions.length,
      selectedVendorName: campaign.selectedVendorName,
      selectedQuoteAmount: campaign.selectedQuoteAmount,
      actualCost: campaign.actualCost,
      variance: reconciliation?.variance ?? null,
      outcome: reconciliation?.outcome ?? null,
    },
    contributions: contributions.map((c) => ({
      contributor: who(c.userId, c.userName),
      unitNumber: anonymize ? null : c.unitNumber,
      amount: c.amount,
      method: c.method,
      reference: anonymize ? null : c.reference,
      paidAt: c.paidAt,
      verifiedAt: c.verifiedAt,
    })),
    quotes: quotesSnapshot.docs
      .map(docToJson)
      .sort((a, b) => a.quotedAmount - b.quotedAmount)
      .map((q) => ({
        vendorName: q.vendorName,
        quotedAmount: q.quotedAmount,
        notes: q.notes,
        attachmentUrl: q.attachmentUrl,
        selected: q.selected,
        selectionReason: q.selectionReason,
        submittedAt: q.submittedAt,
      })),
    reconciliation: reconciliation && {
      totalCollected: reconciliation.totalCollected,
      actualCost: reconciliation.actualCost,
      variance: reconciliation.variance,
      outcome: reconciliation.outcome,
      averageAdjustment: reconciliation.averageAdjustment,
      unallocated: reconciliation.unallocated,
      generatedAt: reconciliation.generatedAt,
      perContributor: [...reconciliation.perContributor].sort(byContributorOrder).map((row) => ({
        contributor: who(row.userId, row.name),
        paid: row.paid,
        sharePercent: row.sharePercent,
        adjustment: row.adjustment,
        finalShare: row.finalShare,
      })),
    },
    timeline: eventsSnapshot.docs
      .map(docToJson)
      .sort(oldestFirst('createdAt'))
      // Unverified claims aren't part of the public record.
      .filter((event) => !(anonymize && event.type === 'contribution_recorded'))
      .map((event) => ({
        type: event.type,
        at: event.createdAt,
        message: anonymize ? publicMessage(event) : event.message,
        by: anonymize ? null : event.actorName,
      })),
  }
}

// Contribution events name residents, so the public version is rewritten from the data.
function publicMessage(event) {
  switch (event.type) {
    case 'contribution_verified':
      return `Contribution of ${formatNaira(event.data.amount)} verified`
    case 'contribution_rejected':
      return `A contribution record of ${formatNaira(event.data.amount)} was rejected`
    default:
      return event.message
  }
}
