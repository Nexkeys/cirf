import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { isAdmin } from '../lib/access.js'
import { docToJson, newestFirst } from '../lib/firestore.js'
import { badRequest } from '../lib/httpError.js'
import { formatNaira } from '../lib/money.js'
import { cloudinaryUrl, naira, notEmpty } from '../lib/schemas.js'
import { parse } from '../lib/validate.js'
import { adminOnly, registered } from '../middleware/guards.js'
import { recordEvent } from '../services/audit.js'
import {
  ACCEPTS_CONTRIBUTIONS,
  CAMPAIGN_CATEGORIES,
  assertStatus,
  campaignJson,
  loadCampaignFor,
} from '../services/campaigns.js'
import { collections } from '../services/collections.js'
import { assertLevyCounts, loadEstate } from '../services/estates.js'
import { db } from '../services/firebaseAdmin.js'
import { LEVY_METHODS, computeLevy, paymentStatus } from '../services/levy.js'
import { notify, toEach } from '../services/notifications.js'
import { estateMembers } from '../services/users.js'

const router = Router()

const fields = {
  title: z.string().trim().min(4, 'Give the campaign a clearer title').max(120),
  description: z.string().trim().min(10, 'Describe the repair in a little more detail').max(4000),
  category: z.enum(CAMPAIGN_CATEGORIES),
  targetAmount: naira,
  levyMethod: z.enum(LEVY_METHODS),
  deadline: z.iso.date().nullable(), // "YYYY-MM-DD"
  imageUrl: cloudinaryUrl.nullable(),
}

const createCampaignSchema = z.object({
  ...fields,
  levyMethod: fields.levyMethod.optional(),
  deadline: fields.deadline.optional(),
  imageUrl: fields.imageUrl.optional(),
})

const updateCampaignSchema = z.object(fields).partial().refine(...notEmpty)

// The signed-in user's own payment position on a campaign, shown on every campaign card.
const myPayment = (campaign, user, myContributions) =>
  paymentStatus(
    campaign,
    [user],
    myContributions.filter((contribution) => contribution.campaignId === campaign.id),
  )[0]

// GET /api/campaigns[?status=fundraising,repairing]
router.get('/campaigns', registered, async (req, res) => {
  if (!req.user.estateId) return res.json({ campaigns: [] })

  const [campaignsSnapshot, mineSnapshot] = await Promise.all([
    collections.campaigns.where('estateId', '==', req.user.estateId).get(),
    collections.contributions.where('userId', '==', req.user.id).get(),
  ])
  const myContributions = mineSnapshot.docs.map(docToJson)
  const statuses = req.query.status ? String(req.query.status).split(',') : null

  const campaigns = campaignsSnapshot.docs
    .map(docToJson)
    .filter((campaign) => isAdmin(req.user) || campaign.status !== 'draft')
    .filter((campaign) => !statuses || statuses.includes(campaign.status))
    .sort(newestFirst('createdAt'))
    .map((campaign) => ({
      ...campaignJson(campaign),
      myPayment: myPayment(campaign, req.user, myContributions),
    }))

  res.json({ campaigns })
})

// POST /api/campaigns
// Creates a draft. The levy is worked out now from the estate's household/unit counts
// and stored on the campaign, so later estate edits can't change what people owe.
router.post('/campaigns', adminOnly, async (req, res) => {
  if (!req.user.estateId) throw badRequest('Create your estate before starting a campaign')

  const body = parse(createCampaignSchema, req.body)
  const estate = await loadEstate(req.user.estateId)
  assertLevyCounts(estate, body.levyMethod ?? 'flat')
  const levy = computeLevy({
    targetAmount: body.targetAmount,
    levyMethod: body.levyMethod ?? 'flat',
    totalHouseholds: estate.totalHouseholds,
    totalUnits: estate.totalUnits,
  })

  const campaignRef = collections.campaigns.doc()
  const now = FieldValue.serverTimestamp()
  const batch = db.batch()

  batch.create(campaignRef, {
    estateId: estate.id,
    title: body.title,
    description: body.description,
    category: body.category,
    imageUrl: body.imageUrl ?? null,
    deadline: body.deadline ?? null,
    targetAmount: body.targetAmount,
    ...levy,
    status: 'draft',
    publicToken: null,
    // Running totals, updated inside transactions as contributions come in.
    totalCollected: 0,
    pendingAmount: 0,
    verifiedCount: 0,
    pendingCount: 0,
    targetReachedAt: null,
    selectedQuoteId: null,
    selectedVendorName: null,
    selectedQuoteAmount: null,
    actualCost: null,
    completionNote: null,
    receiptUrl: null,
    createdBy: req.user.id,
    createdByName: req.user.name,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    repairStartedAt: null,
    completedAt: null,
    reconciledAt: null,
  })
  recordEvent(batch, campaignRef.id, {
    type: 'campaign_created',
    actor: req.user,
    message: `Campaign created with a target of ${formatNaira(body.targetAmount)}`,
    data: { targetAmount: body.targetAmount, ...levy },
  })
  await batch.commit()

  res.status(201).json({ campaign: campaignJson(docToJson(await campaignRef.get())) })
})

// GET /api/campaigns/:id
router.get('/campaigns/:id', registered, async (req, res) => {
  const campaign = await loadCampaignFor(req.user, req.params.id)
  const mineSnapshot = await collections.contributions
    .where('campaignId', '==', campaign.id)
    .where('userId', '==', req.user.id)
    .get()

  res.json({
    campaign: {
      ...campaignJson(campaign),
      myPayment: myPayment(campaign, req.user, mineSnapshot.docs.map(docToJson)),
    },
  })
})

// GET /api/campaigns/:id/progress
// The cheap endpoint the frontend polls every few seconds for the live progress bar:
// one document read. Refetch the contribution list only when the counts here change.
router.get('/campaigns/:id/progress', registered, async (req, res) => {
  const campaign = campaignJson(await loadCampaignFor(req.user, req.params.id))

  res.json({
    progress: {
      id: campaign.id,
      status: campaign.status,
      targetAmount: campaign.targetAmount,
      totalCollected: campaign.totalCollected,
      pendingAmount: campaign.pendingAmount,
      verifiedCount: campaign.verifiedCount,
      pendingCount: campaign.pendingCount,
      percentFunded: campaign.percentFunded,
      targetReachedAt: campaign.targetReachedAt,
      updatedAt: campaign.updatedAt,
    },
  })
})

// PUT /api/campaigns/:id
// Details can only change while the campaign is a draft. Once residents can see it and
// pay toward it, the terms are locked.
router.put('/campaigns/:id', adminOnly, async (req, res) => {
  const campaign = await loadCampaignFor(req.user, req.params.id)
  const changes = parse(updateCampaignSchema, req.body)

  if (changes.targetAmount !== undefined || changes.levyMethod !== undefined) {
    const estate = await loadEstate(campaign.estateId)
    assertLevyCounts(estate, changes.levyMethod ?? campaign.levyMethod)
    Object.assign(
      changes,
      computeLevy({
        targetAmount: changes.targetAmount ?? campaign.targetAmount,
        levyMethod: changes.levyMethod ?? campaign.levyMethod,
        totalHouseholds: estate.totalHouseholds,
        totalUnits: estate.totalUnits,
      }),
    )
  }

  const campaignRef = collections.campaigns.doc(campaign.id)
  await db.runTransaction(async (tx) => {
    assertStatus((await tx.get(campaignRef)).data(), ['draft'], 'edit the campaign details')
    tx.update(campaignRef, { ...changes, updatedAt: FieldValue.serverTimestamp() })
    recordEvent(tx, campaign.id, {
      type: 'campaign_updated',
      actor: req.user,
      message: 'Campaign details updated before publishing',
      data: { fields: Object.keys(changes) },
    })
  })

  res.json({ campaign: campaignJson(docToJson(await campaignRef.get())) })
})

// POST /api/campaigns/:id/publish
// Opens the campaign to residents and creates the token for its public transparency link.
router.post('/campaigns/:id/publish', adminOnly, async (req, res) => {
  const campaign = await loadCampaignFor(req.user, req.params.id)
  const campaignRef = collections.campaigns.doc(campaign.id)

  await db.runTransaction(async (tx) => {
    assertStatus((await tx.get(campaignRef)).data(), ['draft'], 'publish')
    tx.update(campaignRef, {
      status: 'fundraising',
      // 144 random bits: unguessable, so only people given the link can open the report.
      publicToken: randomBytes(18).toString('base64url'),
      publishedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    recordEvent(tx, campaign.id, {
      type: 'campaign_published',
      actor: req.user,
      message: 'Campaign published and opened for contributions',
    })
  })

  const members = await estateMembers(campaign.estateId)
  await notify(
    toEach(
      members.map((member) => member.id),
      {
        type: 'campaign_published',
        campaignId: campaign.id,
        title: `New repair fund: ${campaign.title}`,
        message: `Your estate has started raising ${formatNaira(campaign.targetAmount)} for this repair.`,
      },
    ),
  )

  res.json({ campaign: campaignJson(docToJson(await campaignRef.get())) })
})

// POST /api/campaigns/:id/reminders
// Sends an in-app reminder to every active resident who still owes on this campaign.
router.post('/campaigns/:id/reminders', adminOnly, async (req, res) => {
  const campaign = await loadCampaignFor(req.user, req.params.id)
  assertStatus(campaign, ACCEPTS_CONTRIBUTIONS, 'send payment reminders')

  const [members, contributionsSnapshot] = await Promise.all([
    estateMembers(campaign.estateId),
    collections.contributions.where('campaignId', '==', campaign.id).get(),
  ])
  const owing = paymentStatus(
    campaign,
    members.filter((member) => member.status === 'active'),
    contributionsSnapshot.docs.map(docToJson),
  ).filter((row) => row.balance > 0)

  await notify(
    owing.map((row) => ({
      userId: row.userId,
      type: 'payment_reminder',
      campaignId: campaign.id,
      title: `Reminder: ${campaign.title}`,
      message: `You have ${formatNaira(row.balance)} outstanding toward this repair.`,
    })),
  )

  res.json({ remindersSent: owing.length })
})

export default router
