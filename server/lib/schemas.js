import { z } from 'zod'
import { normalizePhone } from './phone.js'

// Validation pieces shared by several routes.

// Money is stored as whole Naira. N10bn cap keeps typos from creating absurd funds.
export const naira = z
  .number({ error: 'Enter an amount in Naira' })
  .int('Use whole Naira amounts')
  .positive('Amount must be more than zero')
  .max(10_000_000_000)

// Images must be ones uploaded through POST /api/uploads/image, not links to anywhere.
export const cloudinaryUrl = z
  .url()
  .refine(
    (url) => url.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`),
    'Upload the file through CIRF first',
  )

export const notEmpty = [(body) => Object.keys(body).length > 0, 'Send at least one field to update']

// A Firestore document id sent by the client. Checked so a "/" can't point at another path.
export const documentId = z.string().trim().regex(/^[A-Za-z0-9_-]{1,128}$/, 'That id is not valid')

// A resident's unit ("B12") and how many units they hold, which sets their levy.
export const unitNumber = z.string().trim().max(40)
export const units = z.number().int().positive().max(1_000)

export const estateName = z.string().trim().min(2, 'Enter the estate or community name').max(120)

// Any usual way of writing a phone number, stored in E.164 form (see lib/phone.js).
export const phoneNumber = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const phone = normalizePhone(value)
    if (!phone) {
      ctx.issues.push({ code: 'custom', message: 'Enter a valid phone number, e.g. 08012345678', input: value })
      return z.NEVER
    }
    return phone
  })
