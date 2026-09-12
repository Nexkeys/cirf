import { Router } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { docToJson } from '../lib/firestore.js'
import { badRequest, conflict } from '../lib/httpError.js'
import { parse } from '../lib/validate.js'
import { registered, signedIn } from '../middleware/guards.js'
import { collections } from '../services/collections.js'
import { estateJson, findEstateByJoinCode, loadEstate } from '../services/estates.js'
import { db } from '../services/firebaseAdmin.js'
import { forgetUserProfile, publicProfile } from '../services/users.js'

const router = Router()

const name = z.string().trim().min(2, 'Enter your full name').max(80)
const phone = z.string().trim().min(7, 'Enter a valid phone number').max(20)

const registerSchema = z.object({
  name,
  phone: phone.optional(),
  role: z.enum(['resident', 'admin']).default('resident'),
  joinCode: z.string().trim().toUpperCase().optional(),
  unitNumber: z.string().trim().max(40).optional(),
})

// POST /api/users/register
// Creates the CIRF profile straight after a Firebase Auth sign-up. Three ways in:
//   1. A resident whose email an admin already invited -> joins that estate
//   2. A resident with an estate join code            -> joins that estate
//   3. role "admin" (community lead)                  -> no estate yet, creates one next
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
    unitNumber: body.unitNumber ?? null,
    units: 1,
    status: 'active',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }

  const batch = db.batch()

  if (body.role === 'resident') {
    const inviteRef = collections.invites.doc(email)
    const invite = await inviteRef.get()

    if (invite.exists) {
      profile.estateId = invite.get('estateId')
      profile.unitNumber = invite.get('unitNumber') ?? profile.unitNumber
      profile.units = invite.get('units') ?? 1
      batch.delete(inviteRef)
    } else if (body.joinCode) {
      const estate = await findEstateByJoinCode(body.joinCode)
      if (!estate) throw badRequest('No estate matches that join code')
      profile.estateId = estate.id
    } else {
      throw badRequest('Enter your estate join code, or ask your estate admin to invite your email')
    }
  }

  const userRef = collections.users.doc(req.auth.uid)
  batch.create(userRef, profile)
  await batch.commit()
  forgetUserProfile(req.auth.uid)

  res.status(201).json({ user: publicProfile(docToJson(await userRef.get())) })
})

// GET /api/users/me
// The signed-in user's profile plus their estate, so the app knows which dashboard to show.
router.get('/users/me', registered, async (req, res) => {
  const estate = req.user.estateId ? estateJson(await loadEstate(req.user.estateId), req.user) : null
  res.json({ user: publicProfile(req.user), estate })
})

const updateMeSchema = z
  .object({ name: name.optional(), phone: phone.optional() })
  .refine((body) => Object.keys(body).length > 0, 'Send at least one field to update')

// PUT /api/users/me
// Residents can change their name and phone. Unit details affect how much someone owes,
// so only an admin can change those (PUT /api/estates/:id/residents/:userId).
router.put('/users/me', registered, async (req, res) => {
  const body = parse(updateMeSchema, req.body)
  const userRef = collections.users.doc(req.user.id)

  await userRef.update({ ...body, updatedAt: FieldValue.serverTimestamp() })
  forgetUserProfile(req.user.id)

  res.json({ user: publicProfile(docToJson(await userRef.get())) })
})

export default router
