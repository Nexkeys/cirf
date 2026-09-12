import { Router } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { assertSameEstate } from '../lib/access.js'
import { docToJson } from '../lib/firestore.js'
import { badRequest, conflict, notFound } from '../lib/httpError.js'
import { parse } from '../lib/validate.js'
import { adminOnly, registered } from '../middleware/guards.js'
import { CAMPAIGN_STATUSES, loadCampaignFor } from '../services/campaigns.js'
import { collections } from '../services/collections.js'
import { estateJson, generateJoinCode, loadEstate } from '../services/estates.js'
import { db } from '../services/firebaseAdmin.js'
import { paymentStatus } from '../services/levy.js'
import { estateMembers, forgetUserProfile, publicProfile } from '../services/users.js'

const router = Router()

const count = z.number().int().positive().max(100_000)

const createEstateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().min(5).max(300),
  totalHouseholds: count,
  // Defaults to one unit per household when the estate doesn't use per-unit levies.
  totalUnits: count.optional(),
})

// POST /api/estates
// A community lead creates their estate and becomes its admin.
router.post('/estates', adminOnly, async (req, res) => {
  if (req.user.estateId) throw conflict('You already manage an estate')

  const body = parse(createEstateSchema, req.body)
  const estateRef = collections.estates.doc()
  const batch = db.batch()

  batch.create(estateRef, {
    ...body,
    totalUnits: body.totalUnits ?? body.totalHouseholds,
    joinCode: await generateJoinCode(),
    createdBy: req.user.id,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  batch.update(collections.users.doc(req.user.id), {
    estateId: estateRef.id,
    updatedAt: FieldValue.serverTimestamp(),
  })
  await batch.commit()
  forgetUserProfile(req.user.id)

  res.status(201).json({ estate: docToJson(await estateRef.get()) })
})

// GET /api/estates/:id
// Estate details plus headline stats for the dashboard.
router.get('/estates/:id', registered, async (req, res) => {
  assertSameEstate(req.user, req.params.id)

  const [estate, residentCount, campaignsSnapshot] = await Promise.all([
    loadEstate(req.params.id),
    collections.users.where('estateId', '==', req.params.id).count().get(),
    collections.campaigns.where('estateId', '==', req.params.id).get(),
  ])

  const campaigns = campaignsSnapshot.docs.map((doc) => doc.data())
  const byStatus = Object.fromEntries(CAMPAIGN_STATUSES.map((status) => [status, 0]))
  for (const campaign of campaigns) byStatus[campaign.status]++

  res.json({
    estate: estateJson(estate, req.user),
    stats: {
      residentCount: residentCount.data().count,
      campaignCount: campaigns.length,
      campaignsByStatus: byStatus,
      totalRaised: campaigns.reduce((sum, campaign) => sum + (campaign.totalCollected ?? 0), 0),
      totalSpent: campaigns.reduce((sum, campaign) => sum + (campaign.actualCost ?? 0), 0),
    },
  })
})

const updateEstateSchema = createEstateSchema
  .partial()
  .extend({ regenerateJoinCode: z.boolean().optional() })
  .refine((body) => Object.keys(body).length > 0, 'Send at least one field to update')

// PUT /api/estates/:id
// Existing campaigns keep the levy they were created with; changes apply to new campaigns.
router.put('/estates/:id', adminOnly, async (req, res) => {
  assertSameEstate(req.user, req.params.id)

  const { regenerateJoinCode, ...changes } = parse(updateEstateSchema, req.body)
  if (regenerateJoinCode) changes.joinCode = await generateJoinCode()

  const estateRef = collections.estates.doc(req.params.id)
  await estateRef.update({ ...changes, updatedAt: FieldValue.serverTimestamp() })

  res.json({ estate: docToJson(await estateRef.get()) })
})

// GET /api/estates/:id/residents[?campaignId=]
// Every resident, pending invites, and (with campaignId) who has and hasn't paid.
router.get('/estates/:id/residents', adminOnly, async (req, res) => {
  assertSameEstate(req.user, req.params.id)

  const [residents, invitesSnapshot] = await Promise.all([
    estateMembers(req.params.id),
    collections.invites.where('estateId', '==', req.params.id).get(),
  ])
  residents.sort((a, b) => a.name.localeCompare(b.name))

  let rows = residents
  let paymentSummary = null

  if (req.query.campaignId) {
    const campaign = await loadCampaignFor(req.user, String(req.query.campaignId))
    const contributionsSnapshot = await collections.contributions
      .where('campaignId', '==', campaign.id)
      .get()
    const payments = paymentStatus(campaign, residents, contributionsSnapshot.docs.map(docToJson))

    rows = residents.map((resident, index) => ({ ...resident, payment: payments[index] }))
    paymentSummary = { paid: 0, partial: 0, pending: 0, unpaid: 0 }
    for (const payment of payments) paymentSummary[payment.status]++
  }

  res.json({
    residents: rows,
    paymentSummary,
    invites: invitesSnapshot.docs.map(docToJson),
  })
})

const unitNumber = z.string().trim().max(40)
const units = z.number().int().positive().max(1_000)

const addResidentSchema = z.object({
  email: z.email().transform((email) => email.toLowerCase()),
  unitNumber: unitNumber.optional(),
  units: units.optional(),
})

// POST /api/estates/:id/residents
// Adds someone who already has a CIRF account, or invites an email that hasn't signed
// up yet. The invite is claimed automatically when that email registers.
router.post('/estates/:id/residents', adminOnly, async (req, res) => {
  assertSameEstate(req.user, req.params.id)
  const body = parse(addResidentSchema, req.body)

  const existing = await collections.users.where('email', '==', body.email).limit(1).get()

  if (existing.empty) {
    await collections.invites.doc(body.email).set({
      email: body.email,
      estateId: req.params.id,
      unitNumber: body.unitNumber ?? null,
      units: body.units ?? 1,
      invitedBy: req.user.id,
      createdAt: FieldValue.serverTimestamp(),
    })
    return res.status(201).json({ invited: true, email: body.email })
  }

  const user = docToJson(existing.docs[0])
  if (user.estateId === req.params.id) throw conflict('That person is already in your estate')
  if (user.estateId) throw conflict('That person already belongs to another estate')

  const userRef = collections.users.doc(user.id)
  await userRef.update({
    estateId: req.params.id,
    ...(body.unitNumber !== undefined && { unitNumber: body.unitNumber }),
    ...(body.units !== undefined && { units: body.units }),
    updatedAt: FieldValue.serverTimestamp(),
  })
  forgetUserProfile(user.id)

  res.status(201).json({ invited: false, resident: publicProfile(docToJson(await userRef.get())) })
})

const updateResidentSchema = z
  .object({
    unitNumber: unitNumber.nullable().optional(),
    units: units.optional(),
    status: z.enum(['active', 'suspended']).optional(),
    role: z.enum(['resident', 'admin']).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Send at least one field to update')

// Loads a resident of this estate, or 404s.
async function loadResident(estateId, userId) {
  const snapshot = await collections.users.doc(userId).get()
  if (!snapshot.exists || snapshot.get('estateId') !== estateId) {
    throw notFound('Resident not found in this estate')
  }
  return snapshot
}

// PUT /api/estates/:id/residents/:userId
// Change unit details, suspend or reactivate, or promote a resident to co-admin.
router.put('/estates/:id/residents/:userId', adminOnly, async (req, res) => {
  assertSameEstate(req.user, req.params.id)
  const body = parse(updateResidentSchema, req.body)

  if (req.params.userId === req.user.id && (body.status || body.role)) {
    throw badRequest("You can't change your own role or suspend yourself")
  }

  const snapshot = await loadResident(req.params.id, req.params.userId)
  await snapshot.ref.update({ ...body, updatedAt: FieldValue.serverTimestamp() })
  forgetUserProfile(req.params.userId)

  res.json({ resident: publicProfile(docToJson(await snapshot.ref.get())) })
})

// DELETE /api/estates/:id/residents/:userId
// Removes someone from the estate. Their past contributions stay on record, since the
// audit trail must not change after the fact.
router.delete('/estates/:id/residents/:userId', adminOnly, async (req, res) => {
  assertSameEstate(req.user, req.params.id)
  if (req.params.userId === req.user.id) throw badRequest("You can't remove yourself from the estate")

  const snapshot = await loadResident(req.params.id, req.params.userId)
  await snapshot.ref.update({ estateId: null, updatedAt: FieldValue.serverTimestamp() })
  forgetUserProfile(req.params.userId)

  res.status(204).end()
})

// DELETE /api/estates/:id/invites/:email
// Cancels an invite that hasn't been claimed yet.
router.delete('/estates/:id/invites/:email', adminOnly, async (req, res) => {
  assertSameEstate(req.user, req.params.id)

  const inviteRef = collections.invites.doc(req.params.email.toLowerCase())
  const invite = await inviteRef.get()
  if (!invite.exists || invite.get('estateId') !== req.params.id) throw notFound('Invite not found')

  await inviteRef.delete()
  res.status(204).end()
})

export default router
