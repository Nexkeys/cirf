import { Router } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { assertSameEstate, isAdmin } from '../lib/access.js'
import { docToJson, oldestFirst } from '../lib/firestore.js'
import { badRequest, conflict, forbidden, notFound } from '../lib/httpError.js'
import { cloudinaryUrl, documentId, estateName, notEmpty } from '../lib/schemas.js'
import { parse } from '../lib/validate.js'
import { adminOnly, registered } from '../middleware/guards.js'
import { CAMPAIGN_STATUSES, loadCampaignFor } from '../services/campaigns.js'
import { collections } from '../services/collections.js'
import {
  COMMUNITY_TYPES,
  estateJson,
  estateOwnerId,
  generateJoinCode,
  loadEstate,
  newEstate,
  searchableName,
} from '../services/estates.js'
import { db } from '../services/firebaseAdmin.js'
import { paymentStatus } from '../services/levy.js'
import { notify } from '../services/notifications.js'
import { estateMembers, forgetUserProfile, publicProfile } from '../services/users.js'

const router = Router()

const count = z.number().int().positive().max(100_000)
const address = z.string().trim().min(5, 'Enter the full address').max(300)

const createEstateSchema = z.object({
  name: estateName,
  address: address.optional(),
  totalHouseholds: count.optional(),
  // Defaults to one unit per household when the estate doesn't use per-unit levies.
  totalUnits: count.optional(),
})

// POST /api/estates
// A community lead who didn't name their estate when signing up creates it here and
// becomes its admin.
router.post('/estates', adminOnly, async (req, res) => {
  if (req.user.estateId) throw conflict('You already manage an estate')

  const body = parse(createEstateSchema, req.body)
  const estateRef = collections.estates.doc()
  const batch = db.batch()

  batch.create(estateRef, await newEstate(body, req.user.id))
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

  const [estate, residentCount, campaignsSnapshot, joinRequestCount] = await Promise.all([
    loadEstate(req.params.id),
    collections.users.where('estateId', '==', req.params.id).count().get(),
    collections.campaigns.where('estateId', '==', req.params.id).get(),
    isAdmin(req.user) ? collections.users.where('requestedEstateId', '==', req.params.id).count().get() : null,
  ])

  const campaigns = campaignsSnapshot.docs.map((doc) => doc.data())
  const byStatus = Object.fromEntries(CAMPAIGN_STATUSES.map((status) => [status, 0]))
  for (const campaign of campaigns) byStatus[campaign.status]++

  res.json({
    estate: estateJson(estate, req.user),
    stats: {
      residentCount: residentCount.data().count,
      ...(joinRequestCount && { joinRequestCount: joinRequestCount.data().count }),
      campaignCount: campaigns.length,
      campaignsByStatus: byStatus,
      totalRaised: campaigns.reduce((sum, campaign) => sum + (campaign.totalCollected ?? 0), 0),
      totalSpent: campaigns.reduce((sum, campaign) => sum + (campaign.actualCost ?? 0), 0),
    },
  })
})

const updateEstateSchema = z
  .object({
    name: estateName,
    address,
    totalHouseholds: count,
    totalUnits: count,
    communityType: z.enum(COMMUNITY_TYPES),
    imageUrl: cloudinaryUrl.nullable(),
    // Community Access settings
    allowRegistration: z.boolean(),
    requireApproval: z.boolean(),
    regenerateJoinCode: z.boolean(),
  })
  .partial()
  .refine(...notEmpty)

// PUT /api/estates/:id
// Existing campaigns keep the levy they were created with; changes apply to new campaigns.
router.put('/estates/:id', adminOnly, async (req, res) => {
  assertSameEstate(req.user, req.params.id)

  const { regenerateJoinCode, ...changes } = parse(updateEstateSchema, req.body)
  if (regenerateJoinCode) changes.joinCode = await generateJoinCode()
  if (changes.name) changes.nameLower = searchableName(changes.name)

  // An estate created with just a name counts one unit per household unless told otherwise.
  if (changes.totalHouseholds && changes.totalUnits === undefined) {
    const current = await loadEstate(req.params.id)
    if (!current.totalUnits) changes.totalUnits = changes.totalHouseholds
  }

  const estateRef = collections.estates.doc(req.params.id)
  await estateRef.update({ ...changes, updatedAt: FieldValue.serverTimestamp() })

  res.json({ estate: docToJson(await estateRef.get()) })
})

// GET /api/estates/:id/residents[?campaignId=]
// Every resident, pending invites, people asking to join, and (with campaignId) who has
// and hasn't paid.
router.get('/estates/:id/residents', adminOnly, async (req, res) => {
  assertSameEstate(req.user, req.params.id)

  const [residents, invitesSnapshot, requestsSnapshot] = await Promise.all([
    estateMembers(req.params.id),
    collections.invites.where('estateId', '==', req.params.id).get(),
    collections.users.where('requestedEstateId', '==', req.params.id).get(),
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
    joinRequests: requestsSnapshot.docs.map(docToJson).map(publicProfile).sort(oldestFirst('requestedAt')),
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
    // Being added by an admin replaces any request they had waiting elsewhere.
    requestedEstateId: null,
    requestedAt: null,
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

// Co-admins can manage residents, but never the estate's owner: nobody can demote,
// suspend or remove them. Ownership only moves when the owner transfers it.
async function assertNotOwner(estateId, userId, changesStanding) {
  if (!changesStanding) return
  if (estateOwnerId(await loadEstate(estateId)) === userId) {
    throw badRequest("The estate's owner can't be demoted, suspended or removed")
  }
}

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
  await assertNotOwner(req.params.id, req.params.userId, body.status || body.role)

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
  await assertNotOwner(req.params.id, req.params.userId, true)

  const snapshot = await loadResident(req.params.id, req.params.userId)
  await snapshot.ref.update({ estateId: null, updatedAt: FieldValue.serverTimestamp() })
  forgetUserProfile(req.params.userId)

  res.status(204).end()
})

const transferSchema = z.object({ userId: documentId })

// POST /api/estates/:id/transfer-ownership   body: { userId }
// The owner hands the estate to another member, who becomes an admin if they weren't.
// The old owner stays on as a co-admin, so nothing is lost if it was a mistake.
router.post('/estates/:id/transfer-ownership', adminOnly, async (req, res) => {
  assertSameEstate(req.user, req.params.id)
  const { userId } = parse(transferSchema, req.body)
  const estateRef = collections.estates.doc(req.params.id)
  const userRef = collections.users.doc(userId)

  await db.runTransaction(async (tx) => {
    const [estateSnapshot, userSnapshot] = await Promise.all([tx.get(estateRef), tx.get(userRef)])
    if (estateOwnerId(estateSnapshot.data()) !== req.user.id) {
      throw forbidden("Only the estate's owner can transfer ownership")
    }
    if (userId === req.user.id) throw badRequest('You already own this estate')
    if (!userSnapshot.exists || userSnapshot.get('estateId') !== req.params.id) {
      throw notFound('Resident not found in this estate')
    }
    if (userSnapshot.get('status') === 'suspended') {
      throw badRequest('Reactivate this resident before handing them the estate')
    }

    tx.update(estateRef, { ownerId: userId, updatedAt: FieldValue.serverTimestamp() })
    tx.update(userRef, { role: 'admin', updatedAt: FieldValue.serverTimestamp() })
  })
  forgetUserProfile(userId)

  const estate = await loadEstate(req.params.id)
  await notify([
    {
      userId,
      type: 'ownership_transferred',
      title: `You now own ${estate.name}`,
      message: `${req.user.name} handed the estate to you. You can manage residents, campaigns and settings.`,
    },
  ])

  res.json({ estate: estateJson(estate, req.user) })
})

// Answers someone's request to join this estate. A transaction, so an approval and the
// person withdrawing their request at the same moment can't cross.
async function answerJoinRequest(estateId, userId, change) {
  const userRef = collections.users.doc(userId)
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(userRef)
    if (!snapshot.exists || snapshot.get('requestedEstateId') !== estateId) {
      throw notFound('Join request not found')
    }
    tx.update(userRef, {
      ...change,
      requestedEstateId: null,
      requestedAt: null,
      updatedAt: FieldValue.serverTimestamp(),
    })
  })
  forgetUserProfile(userId)
  return userRef
}

const approveSchema = z.object({ unitNumber: unitNumber.optional(), units: units.optional() })

// POST /api/estates/:id/join-requests/:userId/approve
// Lets a resident in, optionally setting their unit details at the same time.
router.post('/estates/:id/join-requests/:userId/approve', adminOnly, async (req, res) => {
  assertSameEstate(req.user, req.params.id)
  const body = parse(approveSchema, req.body)
  const estate = await loadEstate(req.params.id)

  const userRef = await answerJoinRequest(req.params.id, req.params.userId, { ...body, estateId: req.params.id })
  await notify([
    {
      userId: req.params.userId,
      type: 'join_approved',
      title: `Welcome to ${estate.name}`,
      message: 'Your request to join was approved. You can now follow and contribute to repair campaigns.',
    },
  ])

  res.json({ resident: publicProfile(docToJson(await userRef.get())) })
})

// DELETE /api/estates/:id/join-requests/:userId
// Declines a request. The person keeps their account and can ask to join again.
router.delete('/estates/:id/join-requests/:userId', adminOnly, async (req, res) => {
  assertSameEstate(req.user, req.params.id)
  const estate = await loadEstate(req.params.id)

  await answerJoinRequest(req.params.id, req.params.userId, {})
  await notify([
    {
      userId: req.params.userId,
      type: 'join_declined',
      title: `Request to join ${estate.name} declined`,
      message: 'Check the estate with your community lead, then ask to join again or ask them to invite you.',
    },
  ])

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
