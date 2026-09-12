import { Router } from 'express'
import { z } from 'zod'
import { docToJson } from '../lib/firestore.js'
import { notFound } from '../lib/httpError.js'
import { parse } from '../lib/validate.js'
import { collections } from '../services/collections.js'
import { searchableName } from '../services/estates.js'
import { streamTransparencyPdf } from '../services/pdfReport.js'
import { buildTransparencyReport } from '../services/transparencyReport.js'

// No sign-in on these routes. Anyone holding a campaign's share link (journalists,
// other estates) can read its anonymized transparency report, and someone creating an
// account can find their estate by name. Nothing else.

const router = Router()

async function loadByPublicToken(token) {
  const snapshot = await collections.campaigns.where('publicToken', '==', token).limit(1).get()
  if (snapshot.empty) throw notFound('This transparency link is invalid or no longer available')
  return docToJson(snapshot.docs[0])
}

// GET /api/public/campaigns/:publicToken
router.get('/public/campaigns/:publicToken', async (req, res) => {
  const campaign = await loadByPublicToken(req.params.publicToken)
  res.json({ report: await buildTransparencyReport(campaign, { anonymize: true }) })
})

// GET /api/public/campaigns/:publicToken/pdf
router.get('/public/campaigns/:publicToken/pdf', async (req, res) => {
  const campaign = await loadByPublicToken(req.params.publicToken)
  streamTransparencyPdf(await buildTransparencyReport(campaign, { anonymize: true }), res)
})

const estateSearchSchema = z.object({
  q: z.string().trim().min(2, 'Type at least 2 letters of the estate name').max(120),
})

// GET /api/public/estates?q=maple
// Finds estates whose name starts with what a new resident typed on Create Account.
// Returns only what's needed to pick the right one: no join code, no residents, no
// money. Estates that switched off "Resident registration" never appear.
router.get('/public/estates', async (req, res) => {
  const prefix = searchableName(parse(estateSearchSchema, req.query).q)
  const snapshot = await collections.estates
    .where('nameLower', '>=', prefix)
    .where('nameLower', '<=', `${prefix}\uf8ff`)
    .limit(20)
    .get()

  const estates = snapshot.docs
    .map(docToJson)
    .filter((estate) => estate.allowRegistration !== false)
    .slice(0, 8)
    .map(({ id, name, address }) => ({ id, name, address: address ?? null }))

  res.json({ estates })
})

export default router
