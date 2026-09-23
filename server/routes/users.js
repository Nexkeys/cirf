import { Router } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { isAdmin } from '../lib/access.js'
import { docToJson } from '../lib/firestore.js'
import { badRequest, conflict, forbidden, notFound } from '../lib/httpError.js'
import { documentId, estateName, phoneNumber, unitNumber, units } from '../lib/schemas.js'
import { parse } from '../lib/validate.js'
import { registered, signedIn } from '../middleware/guards.js'
import { collections } from '../services/collections.js'
import { estateJson, loadEstate, newEstate, resolveJoin } from '../services/estates.js'
import { db } from '../services/firebaseAdmin.js'
import { notificationPrefs, notify, PREFERENCE_KEYS, toEach } from '../services/notifications.js'
import { estateMembers, forgetUserProfile, publicProfile } from '../services/users.js'

const router = Router()

const name = z.string().trim().min(2, 'Enter your full name').max(80)
const joinCode = z.string().trim().toUpperCase()

const phoneTaken = () =>
  conflict('That phone number is already linked to another CIRF account', [
    { field: 'phone', message: 'This number is already linked to another account' },
  ])

// Firestore's "already exists" error, from create() when two requests race.
const alreadyExists = (err) => err?.code === 6

// Tells an estate's admins that someone is waiting for their approval.
async function notifyJoinRequest(estate, residentName) {
  const admins = (await estateMembers(estate.id)).filter(isAdmin)
  await notify(
    toEach(
      admins.map((admin) => admin.id),
      {
        type: 'join_request',
        title: 'New resident request',
        message: `${residentName} asked to join ${estate.name}. Approve or decline them in Estate Settings.`,
      },
    ),
  )
}

const registerSchema = z.object({
  name,
  phone: phoneNumber.optional(),
  role: z.enum(['resident', 'admin']).default('resident'),
  unitNumber: z.string().trim().max(40).optional(),
  // Residents: how they get into an estate (see resolveJoin)
  joinCode: joinCode.optional(),
  estateId: documentId.optional(),
  // Community leads: the estate to create along with the account
  estateName: estateName.optional(),
})

// POST /api/users/register
// Creates the CIRF profile straight after a Firebase Auth sign-up. Ways in:
//   Resident whose email an admin invited  -> joins that estate
//   Resident with the estate's join code   -> joins that estate
//   Resident who picked their estate       -> asks to join, waits for approval if required
//   Community lead with estateName         -> creates that estate and becomes its admin
//   Community lead without estateName      -> no estate yet, creates one with POST /estates
router.post('/users/register', signedIn, async (req, res) => {
  if (req.user) throw conflict('This account is already registered')
  if (!req.auth.email) throw badRequest('Your sign-in method did not share an email address')

  const body = parse(registerSchema, req.body)
  const email = req.auth.email.toLowerCase()
  const profile = {
    name: body.name,
    email,
    phone: body.phone ?? null,
    role: body.role,
    estateId: null,
    requestedEstateId: null,
    requestedAt: null,
    unitNumber: body.unitNumber ?? null,
    units: 1,
    status: 'active',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }

  const batch = db.batch()
  let requestedEstate = null

  // Phone numbers are unique, because phone sign-in has to find exactly one account.
  if (body.phone) {
    const phoneRef = collections.phoneNumbers.doc(body.phone)
    if ((await phoneRef.get()).exists) throw phoneTaken()
    batch.create(phoneRef, { uid: req.auth.uid, createdAt: FieldValue.serverTimestamp() })
  }

  if (body.role === 'resident') {
    const inviteRef = collections.invites.doc(email)
    const invite = await inviteRef.get()

    if (invite.exists) {
      profile.estateId = invite.get('estateId')
      profile.unitNumber = invite.get('unitNumber') ?? profile.unitNumber
      profile.units = invite.get('units') ?? 1
      batch.delete(inviteRef)
    } else {
      const join = await resolveJoin(body)
      if (!join) {
        throw badRequest('Choose your estate, or ask your estate admin to invite your email', [
          { field: 'estateId', message: 'Choose your estate from the list' },
        ])
      }
      Object.assign(profile, join.membership)
      if (join.membership.requestedEstateId) requestedEstate = join.estate
    }
  } else if (body.estateName) {
    const estateRef = collections.estates.doc()
    batch.create(estateRef, await newEstate({ name: body.estateName }, req.auth.uid))
    profile.estateId = estateRef.id
  }

  const userRef = collections.users.doc(req.auth.uid)
  batch.create(userRef, profile)
  try {
    await batch.commit()
  } catch (err) {
    if (alreadyExists(err)) throw conflict('That phone number or account was just registered. Refresh and try again.')
    throw err
  }
  forgetUserProfile(req.auth.uid)
  if (requestedEstate) await notifyJoinRequest(requestedEstate, profile.name)

  res.status(201).json({ user: publicProfile(docToJson(await userRef.get())) })
})

// GET /api/users/me
// The signed-in user's profile, their estate, and the estate they're waiting to join (if
// any), so the app knows which screen to show.
router.get('/users/me', registered, async (req, res) => {
  const estate = req.user.estateId ? estateJson(await loadEstate(req.user.estateId), req.user) : null

  let joinRequest = null
  if (req.user.requestedEstateId) {
    const requested = await loadEstate(req.user.requestedEstateId).catch(() => null)
    joinRequest = requested && {
      estateId: requested.id,
      estateName: requested.name,
      address: requested.address ?? null,
      requestedAt: req.user.requestedAt ?? null,
    }
  }

  res.json({ user: { ...publicProfile(req.user), notificationPrefs: notificationPrefs(req.user) }, estate, joinRequest })
})

const updateMeSchema = z
  .object({
    name: name.optional(),
    phone: phoneNumber.optional(),
    // Admins only (see below)
    unitNumber: unitNumber.nullable().optional(),
    units: units.optional(),
    // Which kinds of notification to get; leaving a key out keeps its current setting.
    notificationPrefs: z.partialRecord(z.enum(PREFERENCE_KEYS), z.boolean()).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Send at least one field to update')

// PUT /api/users/me
// Everyone can change their name, phone and notification settings. Unit details affect
// how much someone owes, so a resident's are changed by an admin (PUT
// /api/estates/:id/residents/:userId). Admins can already do that for anyone, so they may
// change their own here too.
router.put('/users/me', registered, async (req, res) => {
  const { notificationPrefs: prefs, ...body } = parse(updateMeSchema, req.body)
  if ((body.unitNumber !== undefined || body.units !== undefined) && !isAdmin(req.user)) {
    throw forbidden('Ask your community lead to change your unit details')
  }
  const userRef = collections.users.doc(req.user.id)

  // A transaction, so the old number is released and the new one claimed together.
  await db.runTransaction(async (tx) => {
    const current = (await tx.get(userRef)).data()
    if (body.phone !== undefined && body.phone !== current.phone) {
      const phoneRef = collections.phoneNumbers.doc(body.phone)
      if ((await tx.get(phoneRef)).exists) throw phoneTaken()
      if (current.phone) tx.delete(collections.phoneNumbers.doc(current.phone))
      tx.create(phoneRef, { uid: req.user.id, createdAt: FieldValue.serverTimestamp() })
    }
    const changes = { ...body, updatedAt: FieldValue.serverTimestamp() }
    if (prefs) changes.notificationPrefs = { ...notificationPrefs(current), ...prefs }
    tx.update(userRef, changes)
  })
  forgetUserProfile(req.user.id)

  const saved = docToJson(await userRef.get())
  res.json({ user: { ...publicProfile(saved), notificationPrefs: notificationPrefs(saved) } })
})

const joinRequestSchema = z
  .object({ joinCode: joinCode.optional(), estateId: documentId.optional() })
  .refine((body) => body.joinCode || body.estateId, 'Choose your estate or enter its join code')

// POST /api/users/me/join-request
// A resident without an estate (for example after a declined request) asks to join one.
router.post('/users/me/join-request', registered, async (req, res) => {
  if (isAdmin(req.user)) throw forbidden('Community leads create an estate instead of joining one')
  if (req.user.estateId) throw conflict('You already belong to an estate')

  const join = await resolveJoin(parse(joinRequestSchema, req.body))
  const userRef = collections.users.doc(req.user.id)
  await userRef.update({
    requestedEstateId: null,
    requestedAt: null,
    ...join.membership,
    updatedAt: FieldValue.serverTimestamp(),
  })
  forgetUserProfile(req.user.id)
  if (join.membership.requestedEstateId) await notifyJoinRequest(join.estate, req.user.name)

  res.json({ user: publicProfile(docToJson(await userRef.get())) })
})

// DELETE /api/users/me/join-request
// Withdraws a request that hasn't been answered yet.
router.delete('/users/me/join-request', registered, async (req, res) => {
  if (!req.user.requestedEstateId) throw notFound('You have no pending join request')

  await collections.users.doc(req.user.id).update({
    requestedEstateId: null,
    requestedAt: null,
    updatedAt: FieldValue.serverTimestamp(),
  })
  forgetUserProfile(req.user.id)

  res.status(204).end()
})

export default router
