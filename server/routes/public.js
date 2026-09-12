import { Router } from 'express'
import { docToJson } from '../lib/firestore.js'
import { notFound } from '../lib/httpError.js'
import { collections } from '../services/collections.js'
import { streamTransparencyPdf } from '../services/pdfReport.js'
import { buildTransparencyReport } from '../services/transparencyReport.js'

// No sign-in on these routes. Anyone holding a campaign's share link (journalists,
// other estates) can read its anonymized transparency report, and nothing else.

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

export default router
