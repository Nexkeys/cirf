import { Router } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { assertSameEstate } from '../lib/access.js'
import { docToJson } from '../lib/firestore.js'
import { badRequest, conflict, notFound } from '../lib/httpError.js'
import { formatNaira } from '../lib/money.js'
import { cloudinaryUrl, naira } from '../lib/schemas.js'
import { parse } from '../lib/validate.js'
import { adminOnly, registered } from '../middleware/guards.js'
import { recordEvent } from '../services/audit.js'
import { assertStatus, loadCampaignFor } from '../services/campaigns.js'
import { collections } from '../services/collections.js'
import { db } from '../services/firebaseAdmin.js'
import { notify, toEach } from '../services/notifications.js'
import { estateMembers } from '../services/users.js'

const router = Router()

// GET /api/campaigns/:id/vendor-quotes
// Cheapest first, with a summary so residents can compare the selected quote at a glance.
router.get('/campaigns/:id/vendor-quotes', registered, async (req, res) => {
  const campaign = await loadCampaignFor(req.user, req.params.id)
  const snapshot = await collections.vendorQuotes.where('campaignId', '==', campaign.id).get()

  const quotes = snapshot.docs.map(docToJson).sort((a, b) => a.quotedAmount - b.quotedAmount)
  const amounts = quotes.map((quote) => quote.quotedAmount)

  res.json({
    quotes,
    summary: {
      count: quotes.length,
      lowest: quotes.length ? Math.min(...amounts) : null,
      highest: quotes.length ? Math.max(...amounts) : null,
      average: quotes.length ? Math.round(amounts.reduce((sum, a) => sum + a, 0) / quotes.length) : null,
      selectedQuoteId: campaign.selectedQuoteId,
    },
  })
})

const quoteSchema = z.object({
  vendorName: z.string().trim().min(2, 'Enter the vendor name').max(120),
  vendorPhone: z.string().trim().min(7).max(20).optional(),
  quotedAmount: naira,
  notes: z.string().trim().max(1000).optional(),
  attachmentUrl: cloudinaryUrl.optional(),
  deliveryDays: z.number().int().positive().max(365).optional(),
  warrantyMonths: z.number().int().min(0).max(120).optional(),
  // Who to talk to, and what the price covers, as shown on the Vendor Quotes screen.
  contactPerson: z.string().trim().max(120).optional(),
  vendorEmail: z.email('Enter a valid email address').optional(),
  vendorAddress: z.string().trim().max(200).optional(),
  scope: z.string().trim().max(120).optional(),
  inclusions: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
})

// POST /api/campaigns/:id/vendor-quotes
router.post('/campaigns/:id/vendor-quotes', adminOnly, async (req, res) => {
  const body = parse(quoteSchema, req.body)
  const campaign = await loadCampaignFor(req.user, req.params.id)
  assertStatus(campaign, ['draft', 'fundraising', 'repairing'], 'add vendor quotes')

  const quoteRef = collections.vendorQuotes.doc()
  const batch = db.batch()
  batch.create(quoteRef, {
    campaignId: campaign.id,
    estateId: campaign.estateId,
    vendorName: body.vendorName,
    vendorPhone: body.vendorPhone ?? null,
    quotedAmount: body.quotedAmount,
    notes: body.notes ?? null,
    attachmentUrl: body.attachmentUrl ?? null,
    deliveryDays: body.deliveryDays ?? null,
    warrantyMonths: body.warrantyMonths ?? null,
    contactPerson: body.contactPerson ?? null,
    vendorEmail: body.vendorEmail ?? null,
    vendorAddress: body.vendorAddress ?? null,
    scope: body.scope ?? null,
    inclusions: body.inclusions ?? [],
    selected: false,
    selectedAt: null,
    selectionReason: null,
    addedBy: req.user.id,
    addedByName: req.user.name,
    submittedAt: FieldValue.serverTimestamp(),
  })
  recordEvent(batch, campaign.id, {
    type: 'quote_added',
    actor: req.user,
    message: `Quote added: ${body.vendorName} for ${formatNaira(body.quotedAmount)}`,
    data: { quoteId: quoteRef.id, vendorName: body.vendorName, quotedAmount: body.quotedAmount },
  })
  await batch.commit()

  res.status(201).json({ quote: docToJson(await quoteRef.get()) })
})

const selectSchema = z.object({ reason: z.string().trim().min(5).max(500).optional() })

// PUT /api/vendor-quotes/:id/select   body: { reason? }
// Picks the vendor and moves the campaign into "repairing". Choosing anything other than
// the cheapest quote requires a written reason, which goes into the audit trail. That
// is the vendor-verification half of CIRF's accountability story.
router.put('/vendor-quotes/:id/select', adminOnly, async (req, res) => {
  const body = parse(selectSchema, req.body)
  const quoteRef = collections.vendorQuotes.doc(req.params.id)
  let outcome

  await db.runTransaction(async (tx) => {
    const quoteSnapshot = await tx.get(quoteRef)
    if (!quoteSnapshot.exists) throw notFound('Vendor quote not found')

    const quote = quoteSnapshot.data()
    assertSameEstate(req.user, quote.estateId)
    if (quote.selected) throw conflict('That quote is already selected')

    const campaignRef = collections.campaigns.doc(quote.campaignId)
    const campaign = (await tx.get(campaignRef)).data()
    assertStatus(campaign, ['fundraising', 'repairing'], 'select a vendor')

    const allQuotes = await tx.get(collections.vendorQuotes.where('campaignId', '==', quote.campaignId))
    const lowestQuoteAmount = Math.min(...allQuotes.docs.map((doc) => doc.get('quotedAmount')))
    if (quote.quotedAmount > lowestQuoteAmount && !body.reason) {
      throw badRequest('This is not the cheapest quote, so explain why it was chosen', [
        { field: 'reason', message: `The lowest quote is ${formatNaira(lowestQuoteAmount)}` },
      ])
    }

    const now = FieldValue.serverTimestamp()
    for (const doc of allQuotes.docs) {
      if (doc.get('selected')) tx.update(doc.ref, { selected: false, selectedAt: null, selectionReason: null })
    }
    tx.update(quoteRef, {
      selected: true,
      selectedAt: now,
      selectedBy: req.user.id,
      selectionReason: body.reason ?? null,
    })
    tx.update(campaignRef, {
      status: 'repairing',
      selectedQuoteId: quoteRef.id,
      selectedVendorName: quote.vendorName,
      selectedQuoteAmount: quote.quotedAmount,
      repairStartedAt: campaign.repairStartedAt ?? now,
      updatedAt: now,
    })
    recordEvent(tx, quote.campaignId, {
      type: 'vendor_selected',
      actor: req.user,
      message: `${quote.vendorName} selected at ${formatNaira(quote.quotedAmount)}`,
      data: {
        quoteId: quoteRef.id,
        vendorName: quote.vendorName,
        quotedAmount: quote.quotedAmount,
        lowestQuoteAmount,
        reason: body.reason ?? null,
      },
    })

    outcome = { quote, campaign }
  })

  const members = await estateMembers(outcome.campaign.estateId)
  await notify(
    toEach(
      members.map((member) => member.id),
      {
        type: 'vendor_selected',
        campaignId: outcome.quote.campaignId,
        title: `Vendor selected: ${outcome.campaign.title}`,
        message: `${outcome.quote.vendorName} will carry out the repair for ${formatNaira(outcome.quote.quotedAmount)}.`,
      },
    ),
  )

  res.json({ quote: docToJson(await quoteRef.get()) })
})

export default router
