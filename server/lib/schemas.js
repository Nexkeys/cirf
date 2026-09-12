import { z } from 'zod'

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
