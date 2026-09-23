import { Router } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { docToJson } from '../lib/firestore.js'
import { conflict, notFound } from '../lib/httpError.js'
import { formatNaira } from '../lib/money.js'
import { cloudinaryUrl, naira } from '../lib/schemas.js'
import { parse } from '../lib/validate.js'
import { adminOnly, registered } from '../middleware/guards.js'
import { recordEvent } from '../services/audit.js'
import { assertStatus, campaignJson, loadCampaignFor } from '../services/campaigns.js'
import { collections } from '../services/collections.js'
import { db } from '../services/firebaseAdmin.js'
import { notify, toEach } from '../services/notifications.js'
import { streamTransparencyPdf } from '../services/pdfReport.js'
import { reconcile } from '../services/reconciliation.js'
import { buildTransparencyReport } from '../services/transparencyReport.js'
import { estateMembers } from '../services/users.js'

const router = Router()

const costItem = z.object({
  label: z.string().trim().min(2, 'Name the cost').max(60),
  amount: naira,
})

const completeSchema = z
  .object({
    actualCost: naira,
    completionNote: z.string().trim().max(1000).optional(),
    receiptUrl: cloudinaryUrl.optional(),
    // What the money paid for (e.g. transformer, labour), shown as the Spending
    // Breakdown on the transparency report. Optional, but it must add up exactly.
    costItems: z.array(costItem).min(1).max(10).optional(),
  })
  .refine((body) => !body.costItems || body.costItems.reduce((sum, item) => sum + item.amount, 0) === body.actualCost, {
    message: 'The cost breakdown must add up to the actual cost',
    path: ['costItems'],
  })

// POST /api/campaigns/:id/complete
// The admin confirms the repair is done and enters what was actually paid to the vendor.
router.post('/campaigns/:id/complete', adminOnly, async (req, res) => {
  const body = parse(completeSchema, req.body)
  const campaign = await loadCampaignFor(req.user, req.params.id)
  const campaignRef = collections.campaigns.doc(campaign.id)

  await db.runTransaction(async (tx) => {
    const fresh = (await tx.get(campaignRef)).data()
    assertStatus(fresh, ['repairing'], 'mark the repair complete')

    tx.update(campaignRef, {
      status: 'completed',
      actualCost: body.actualCost,
      completionNote: body.completionNote ?? null,
      receiptUrl: body.receiptUrl ?? null,
      costItems: body.costItems ?? [],
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    recordEvent(tx, campaign.id, {
      type: 'repair_completed',
      actor: req.user,
      message:
        `Repair marked complete. Actual cost ${formatNaira(body.actualCost)} ` +
        `against a selected quote of ${formatNaira(fresh.selectedQuoteAmount)}`,
      data: {
        actualCost: body.actualCost,
        selectedQuoteAmount: fresh.selectedQuoteAmount,
        differenceFromQuote: body.actualCost - fresh.selectedQuoteAmount,
        costItems: body.costItems ?? [],
      },
    })
  })

  const members = await estateMembers(campaign.estateId)
  await notify(
    toEach(
      members.map((member) => member.id),
      {
        type: 'repair_completed',
        campaignId: campaign.id,
        title: `Repair complete: ${campaign.title}`,
        message: `The repair is done. Actual cost: ${formatNaira(body.actualCost)}. Reconciliation comes next.`,
      },
    ),
  )

  res.json({ campaign: campaignJson(docToJson(await campaignRef.get())) })
})

// POST /api/campaigns/:id/reconcile
// Runs the reconciliation engine on the verified contributions and stores the result.
// Refuses while any contribution is still pending, because unverified money can't be
// settled fairly. Reconciliation happens once; the stored result is final.
router.post('/campaigns/:id/reconcile', adminOnly, async (req, res) => {
  const campaign = await loadCampaignFor(req.user, req.params.id)
  const campaignRef = collections.campaigns.doc(campaign.id)
  const reconciliationRef = collections.reconciliations.doc(campaign.id)
  let result

  await db.runTransaction(async (tx) => {
    const fresh = (await tx.get(campaignRef)).data()
    assertStatus(fresh, ['completed'], 'reconcile')
    if (fresh.pendingCount > 0) {
      throw conflict(
        `Verify or reject the ${fresh.pendingCount} pending contribution(s) before reconciling`,
      )
    }

    const verifiedSnapshot = await tx.get(
      collections.contributions.where('campaignId', '==', campaign.id).where('status', '==', 'verified'),
    )
    const contributions = verifiedSnapshot.docs.map((doc) => doc.data())
    const names = new Map(contributions.map((c) => [c.userId, { name: c.userName, unitNumber: c.unitNumber }]))

    result = reconcile(fresh.actualCost, contributions)
    const perContributor = result.perContributor.map((row) => ({ ...row, ...names.get(row.userId) }))

    tx.create(reconciliationRef, {
      campaignId: campaign.id,
      estateId: campaign.estateId,
      ...result,
      perContributor,
      averageAdjustment: result.contributorCount ? Math.round(result.variance / result.contributorCount) : 0,
      generatedBy: req.user.id,
      generatedByName: req.user.name,
      generatedAt: FieldValue.serverTimestamp(),
    })
    tx.update(campaignRef, {
      status: 'reconciled',
      totalCollected: result.totalCollected,
      reconciledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    recordEvent(tx, campaign.id, {
      type: 'campaign_reconciled',
      actor: req.user,
      message:
        `Fund reconciled: collected ${formatNaira(result.totalCollected)}, ` +
        `cost ${formatNaira(result.actualCost)}, variance ${formatNaira(result.variance)} (${result.outcome.replace('_', ' ')})`,
      data: { variance: result.variance, outcome: result.outcome, contributorCount: result.contributorCount },
    })
  })

  // Each contributor hears exactly what the result means for them.
  await notify(
    result.perContributor.map((row) => ({
      userId: row.userId,
      type: 'campaign_reconciled',
      campaignId: campaign.id,
      title: `Reconciled: ${campaign.title}`,
      message:
        row.adjustment > 0
          ? `You are owed a refund of ${formatNaira(row.adjustment)}.`
          : row.adjustment < 0
            ? `You owe an extra ${formatNaira(-row.adjustment)} to cover the actual cost.`
            : 'Your contribution matched your share exactly. Nothing more is owed either way.',
    })),
  )

  res.status(201).json({ reconciliation: docToJson(await reconciliationRef.get()) })
})

// GET /api/campaigns/:id/reconciliation
router.get('/campaigns/:id/reconciliation', registered, async (req, res) => {
  const campaign = await loadCampaignFor(req.user, req.params.id)
  const snapshot = await collections.reconciliations.doc(campaign.id).get()
  if (!snapshot.exists) throw notFound('This campaign has not been reconciled yet')

  const reconciliation = docToJson(snapshot)
  res.json({
    reconciliation,
    mine: reconciliation.perContributor.find((row) => row.userId === req.user.id) ?? null,
  })
})

// GET /api/campaigns/:id/transparency-report
router.get('/campaigns/:id/transparency-report', registered, async (req, res) => {
  const campaign = await loadCampaignFor(req.user, req.params.id)
  res.json({ report: await buildTransparencyReport(campaign, { anonymize: false }) })
})

// GET /api/campaigns/:id/transparency-report/pdf
router.get('/campaigns/:id/transparency-report/pdf', registered, async (req, res) => {
  const campaign = await loadCampaignFor(req.user, req.params.id)
  streamTransparencyPdf(await buildTransparencyReport(campaign, { anonymize: false }), res)
})

export default router
