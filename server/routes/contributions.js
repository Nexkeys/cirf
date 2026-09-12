import { Router } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { assertSameEstate, isAdmin } from '../lib/access.js'
import { docToJson, newestFirst } from '../lib/firestore.js'
import { badRequest, conflict, forbidden, notFound } from '../lib/httpError.js'
import { formatNaira } from '../lib/money.js'
import { cloudinaryUrl, naira } from '../lib/schemas.js'
import { parse } from '../lib/validate.js'
import { adminOnly, registered } from '../middleware/guards.js'
import { recordEvent } from '../services/audit.js'
import { ACCEPTS_CONTRIBUTIONS, assertStatus, loadCampaignFor } from '../services/campaigns.js'
import { collections } from '../services/collections.js'
import { PAYMENT_METHODS, totalsAfterVerifying } from '../services/contributions.js'
import { db } from '../services/firebaseAdmin.js'
import { notify, toEach } from '../services/notifications.js'
import { estateMembers } from '../services/users.js'

const router = Router()

// When a contribution pushes a campaign past its target, tell the whole estate.
async function announceTargetReached(campaignId, estateId, title) {
  const members = await estateMembers(estateId)
  await notify(
    toEach(
      members.map((member) => member.id),
      {
        type: 'target_reached',
        campaignId,
        title: `Target reached: ${title}`,
        message: 'The repair fund has reached its target. Thank you to everyone who contributed.',
      },
    ),
  )
}

// GET /api/campaigns/:id/contributions
// Admins see everything. Residents see verified contributions (that's the transparency)
// plus their own pending or rejected ones.
router.get('/campaigns/:id/contributions', registered, async (req, res) => {
  const campaign = await loadCampaignFor(req.user, req.params.id)
  const snapshot = await collections.contributions.where('campaignId', '==', campaign.id).get()

  const contributions = snapshot.docs
    .map(docToJson)
    .filter((c) => isAdmin(req.user) || c.status === 'verified' || c.userId === req.user.id)
    .sort(newestFirst('createdAt'))

  res.json({ contributions })
})

const createContributionSchema = z.object({
  amount: naira,
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
  paidAt: z.iso.date().optional(),
  proofUrl: cloudinaryUrl.optional(),
  // Admin only: record money collected in person on a resident's behalf.
  userId: z.string().min(1).optional(),
})

// POST /api/campaigns/:id/contributions
// CIRF records payments, it doesn't process them. A resident's own record stays
// "pending" until an admin checks it against the bank alert or receipt. An admin
// recording cash they personally collected is vouching for it, so that starts verified.
router.post('/campaigns/:id/contributions', registered, async (req, res) => {
  const body = parse(createContributionSchema, req.body)
  const campaign = await loadCampaignFor(req.user, req.params.id)
  assertStatus(campaign, ACCEPTS_CONTRIBUTIONS, 'record contributions')

  let payer = req.user
  const onBehalf = Boolean(body.userId) && body.userId !== req.user.id
  if (onBehalf) {
    if (!isAdmin(req.user)) throw forbidden('Only admins can record a contribution for someone else')
    const payerSnapshot = await collections.users.doc(body.userId).get()
    if (!payerSnapshot.exists || payerSnapshot.get('estateId') !== campaign.estateId) {
      throw badRequest('That resident is not a member of this estate')
    }
    payer = docToJson(payerSnapshot)
  }

  const status = onBehalf ? 'verified' : 'pending'
  const now = FieldValue.serverTimestamp()
  const campaignRef = collections.campaigns.doc(campaign.id)
  const contributionRef = collections.contributions.doc()
  let targetJustReached = false

  await db.runTransaction(async (tx) => {
    const fresh = (await tx.get(campaignRef)).data()
    assertStatus(fresh, ACCEPTS_CONTRIBUTIONS, 'record contributions')

    tx.create(contributionRef, {
      campaignId: campaign.id,
      estateId: campaign.estateId,
      userId: payer.id,
      userName: payer.name,
      unitNumber: payer.unitNumber ?? null,
      amount: body.amount,
      method: body.method,
      reference: body.reference ?? null,
      note: body.note ?? null,
      paidAt: body.paidAt ?? null,
      proofUrl: body.proofUrl ?? null,
      status,
      recordedBy: req.user.id,
      recordedByName: req.user.name,
      verifiedBy: onBehalf ? req.user.id : null,
      verifiedByName: onBehalf ? req.user.name : null,
      verifiedAt: onBehalf ? now : null,
      rejectionReason: null,
      createdAt: now,
      updatedAt: now,
    })

    if (status === 'verified') {
      const totals = totalsAfterVerifying(fresh, body.amount, { wasPending: false })
      tx.update(campaignRef, totals.update)
      targetJustReached = totals.targetJustReached
    } else {
      tx.update(campaignRef, {
        pendingAmount: fresh.pendingAmount + body.amount,
        pendingCount: fresh.pendingCount + 1,
        updatedAt: now,
      })
    }

    recordEvent(tx, campaign.id, {
      type: onBehalf ? 'contribution_verified' : 'contribution_recorded',
      actor: req.user,
      message: onBehalf
        ? `${req.user.name} recorded and verified ${formatNaira(body.amount)} from ${payer.name}`
        : `${payer.name} recorded a contribution of ${formatNaira(body.amount)}`,
      data: { contributionId: contributionRef.id, userId: payer.id, amount: body.amount, method: body.method },
    })
    if (targetJustReached) {
      recordEvent(tx, campaign.id, { type: 'target_reached', actor: null, message: 'Fundraising target reached' })
    }
  })

  if (targetJustReached) await announceTargetReached(campaign.id, campaign.estateId, campaign.title)

  res.status(201).json({ contribution: docToJson(await contributionRef.get()) })
})

const reviewSchema = z
  .object({
    status: z.enum(['verified', 'rejected']).default('verified'),
    reason: z.string().trim().min(3).max(300).optional(),
  })
  .refine((body) => body.status !== 'rejected' || body.reason, {
    message: 'Say why the contribution is being rejected',
    path: ['reason'],
  })

// PUT /api/contributions/:id/verify   body: { status?: "verified" | "rejected", reason? }
// An admin confirms the money really arrived, or rejects the record with a reason.
router.put('/contributions/:id/verify', adminOnly, async (req, res) => {
  const body = parse(reviewSchema, req.body)
  const contributionRef = collections.contributions.doc(req.params.id)
  let outcome

  await db.runTransaction(async (tx) => {
    const contributionSnapshot = await tx.get(contributionRef)
    if (!contributionSnapshot.exists) throw notFound('Contribution not found')

    const contribution = contributionSnapshot.data()
    assertSameEstate(req.user, contribution.estateId)
    if (contribution.status !== 'pending') {
      throw conflict(`This contribution has already been ${contribution.status}`)
    }

    const campaignRef = collections.campaigns.doc(contribution.campaignId)
    const campaign = (await tx.get(campaignRef)).data()
    // Still allowed after the repair is marked complete, so everything can be settled
    // before reconciliation. Once reconciled, the numbers are final.
    assertStatus(campaign, ['fundraising', 'repairing', 'completed'], 'review contributions')

    const now = FieldValue.serverTimestamp()
    tx.update(contributionRef, {
      status: body.status,
      verifiedBy: req.user.id,
      verifiedByName: req.user.name,
      verifiedAt: now,
      rejectionReason: body.status === 'rejected' ? body.reason : null,
      updatedAt: now,
    })

    let targetJustReached = false
    if (body.status === 'verified') {
      const totals = totalsAfterVerifying(campaign, contribution.amount, { wasPending: true })
      tx.update(campaignRef, totals.update)
      targetJustReached = totals.targetJustReached
    } else {
      tx.update(campaignRef, {
        pendingAmount: campaign.pendingAmount - contribution.amount,
        pendingCount: campaign.pendingCount - 1,
        updatedAt: now,
      })
    }

    recordEvent(tx, contribution.campaignId, {
      type: body.status === 'verified' ? 'contribution_verified' : 'contribution_rejected',
      actor: req.user,
      message:
        body.status === 'verified'
          ? `${req.user.name} verified ${formatNaira(contribution.amount)} from ${contribution.userName}`
          : `${req.user.name} rejected ${formatNaira(contribution.amount)} from ${contribution.userName}: ${body.reason}`,
      data: {
        contributionId: contributionRef.id,
        userId: contribution.userId,
        amount: contribution.amount,
        reason: body.reason ?? null,
      },
    })
    if (targetJustReached) {
      recordEvent(tx, contribution.campaignId, { type: 'target_reached', actor: null, message: 'Fundraising target reached' })
    }

    outcome = { contribution, campaign, targetJustReached }
  })

  const { contribution, campaign, targetJustReached } = outcome
  await notify([
    {
      userId: contribution.userId,
      type: `contribution_${body.status}`,
      campaignId: contribution.campaignId,
      title: body.status === 'verified' ? 'Contribution verified' : 'Contribution rejected',
      message:
        body.status === 'verified'
          ? `Your ${formatNaira(contribution.amount)} toward ${campaign.title} has been verified.`
          : `Your ${formatNaira(contribution.amount)} toward ${campaign.title} was rejected: ${body.reason}`,
    },
  ])
  if (targetJustReached) await announceTargetReached(contribution.campaignId, campaign.estateId, campaign.title)

  res.json({ contribution: docToJson(await contributionRef.get()) })
})

// GET /api/users/me/contributions
// The signed-in user's full payment history across every campaign.
router.get('/users/me/contributions', registered, async (req, res) => {
  const snapshot = await collections.contributions.where('userId', '==', req.user.id).get()
  const contributions = snapshot.docs.map(docToJson).sort(newestFirst('createdAt'))

  const campaignIds = [...new Set(contributions.map((c) => c.campaignId))]
  const campaignSnapshots = campaignIds.length
    ? await db.getAll(...campaignIds.map((id) => collections.campaigns.doc(id)))
    : []
  const titles = new Map(campaignSnapshots.map((snap) => [snap.id, snap.get('title') ?? null]))

  res.json({
    contributions: contributions.map((c) => ({ ...c, campaignTitle: titles.get(c.campaignId) ?? null })),
  })
})

export default router
