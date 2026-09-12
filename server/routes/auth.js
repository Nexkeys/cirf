import { Router } from 'express'
import { z } from 'zod'
import { badRequest, unauthorized } from '../lib/httpError.js'
import { normalizePhone } from '../lib/phone.js'
import { parse } from '../lib/validate.js'
import { collections } from '../services/collections.js'
import { auth } from '../services/firebaseAdmin.js'
import { passwordMatches } from '../services/passwordCheck.js'

// Sign in with a phone number and password ("Email or Phone Number" on the Sign In
// screen). Firebase Auth only takes a password with an email (its own phone sign-in
// works with SMS codes), so the API bridges the gap:
//   1. find the account that registered this phone number (phoneNumbers collection)
//   2. check the password against that account's email, on the server
//   3. return a Firebase custom token, which the app swaps for a normal session with
//      signInWithCustomToken()
// The email never reaches the browser, and every failure gets the same message, so this
// can't be used to find out whose number is whose.

const router = Router()

const schema = z.object({
  phone: z.string().trim().min(1, 'Enter your phone number').max(30),
  password: z.string().min(1, 'Enter your password').max(200),
})

// POST /api/auth/phone-sign-in
router.post('/auth/phone-sign-in', async (req, res) => {
  const body = parse(schema, req.body)
  const phone = normalizePhone(body.phone)
  if (!phone) {
    throw badRequest('Enter a valid phone number, e.g. 08012345678', [
      { field: 'phone', message: 'Enter a valid phone number' },
    ])
  }

  const wrongDetails = unauthorized('Incorrect phone number or password', 'INVALID_CREDENTIALS')

  const entry = await collections.phoneNumbers.doc(phone).get()
  if (!entry.exists) throw wrongDetails

  const account = await auth.getUser(entry.get('uid')).catch(() => null)
  if (!account?.email || account.disabled) throw wrongDetails
  if (!(await passwordMatches(account.email, body.password))) throw wrongDetails

  res.json({ customToken: await auth.createCustomToken(account.uid) })
})

export default router
