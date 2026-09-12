import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { badRequest } from '../lib/httpError.js'
import { parse } from '../lib/validate.js'
import { registered } from '../middleware/guards.js'
import { uploadImage } from '../services/cloudinary.js'

const router = Router()

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

// Kept in memory and passed straight to Cloudinary. 4 MB stays under Vercel's 4.5 MB
// request body limit for serverless functions.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, done) =>
    ALLOWED_TYPES.includes(file.mimetype)
      ? done(null, true)
      : done(badRequest('Upload a JPG, PNG, WebP or HEIC image')),
})

const purposeSchema = z.object({
  purpose: z.enum(['campaign', 'contribution-proof', 'receipt', 'quote', 'other']).default('other'),
})

// POST /api/uploads/image   multipart/form-data: file=<image>, purpose=<campaign|...>
// Returns the Cloudinary URL to send along with the campaign, contribution or quote.
router.post('/uploads/image', registered, upload.single('file'), async (req, res) => {
  if (!req.file) throw badRequest('Attach the image as a form field named "file"')
  const { purpose } = parse(purposeSchema, req.body)

  const result = await uploadImage(req.file.buffer, {
    folder: `cirf/${req.user.estateId ?? 'no-estate'}/${purpose}`,
  })

  res.status(201).json({
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
    format: result.format,
  })
})

export default router
