// End-to-end test of a whole repair campaign, from sign-up to the public transparency
// report, through the real Express app against the Firebase emulators.
//
//   npm run test:e2e     (starts the Auth + Firestore emulators, needs Java)
//
// It never touches the real Firebase project: it refuses to run without emulator hosts.
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'

// Set E2E_PDF_DIR to keep copies of the generated PDFs for a visual check.
const savePdf = (name, buffer) => {
  if (process.env.E2E_PDF_DIR) writeFileSync(join(process.env.E2E_PDF_DIR, name), buffer)
}

const { FIRESTORE_EMULATOR_HOST, FIREBASE_AUTH_EMULATOR_HOST } = process.env
if (!FIRESTORE_EMULATOR_HOST || !FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run through `npm run test:e2e` so this uses the emulators, never the real project')
}

const { default: app } = await import('../app.js')
const { auth } = await import('../services/firebaseAdmin.js')

let server
let base

async function signUp(email) {
  const password = 'password123'
  await auth.createUser({ email, password })
  const response = await fetch(
    `http://${FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  )
  return (await response.json()).idToken
}

async function call(token, method, path, body) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(token && { authorization: `Bearer ${token}` }),
      ...(body && { 'content-type': 'application/json' }),
    },
    body: body && JSON.stringify(body),
  })
  const type = response.headers.get('content-type') ?? ''
  const data = type.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer())
  return { status: response.status, type, data }
}

const token = {}
const state = {}

describe('campaign lifecycle', () => {
  before(async () => {
    server = app.listen(0)
    await new Promise((resolve) => server.on('listening', resolve))
    base = `http://localhost:${server.address().port}`

    for (const name of ['lead', 'ada', 'bola', 'chidi']) token[name] = await signUp(`${name}@example.com`)
  })

  after(() => server.close())

  it('rejects requests without a valid token', async () => {
    assert.equal((await call(null, 'GET', '/api/users/me')).status, 401)
    assert.equal((await call('not-a-token', 'GET', '/api/users/me')).status, 401)
    assert.equal((await call(token.ada, 'GET', '/api/users/me')).status, 403) // not registered yet
  })

  it('lets a community lead register and create an estate', async () => {
    const registered = await call(token.lead, 'POST', '/api/users/register', { name: 'Lead Okafor', role: 'admin' })
    assert.equal(registered.status, 201)

    const estate = await call(token.lead, 'POST', '/api/estates', {
      name: 'Katampe Gardens',
      address: '12 Katampe Road, Abuja',
      totalHouseholds: 4,
    })
    assert.equal(estate.status, 201)
    assert.match(estate.data.estate.joinCode, /^[A-Z2-9]{6}$/)
    state.estate = estate.data.estate
  })

  it('lets residents join by join code or by invite', async () => {
    const badCode = await call(token.ada, 'POST', '/api/users/register', { name: 'Ada Eze', joinCode: 'ZZZZZZ' })
    assert.equal(badCode.status, 400)

    for (const [name, fullName] of [['ada', 'Ada Eze'], ['bola', 'Bola Ade']]) {
      const joined = await call(token[name], 'POST', '/api/users/register', {
        name: fullName,
        joinCode: state.estate.joinCode.toLowerCase(),
      })
      assert.equal(joined.status, 201)
      assert.equal(joined.data.user.estateId, state.estate.id)
    }

    const invite = await call(token.lead, 'POST', `/api/estates/${state.estate.id}/residents`, {
      email: 'CHIDI@example.com',
      unitNumber: 'Block C',
    })
    assert.equal(invite.data.invited, true)

    const chidi = await call(token.chidi, 'POST', '/api/users/register', { name: 'Chidi Obi' })
    assert.equal(chidi.status, 201)
    assert.equal(chidi.data.user.estateId, state.estate.id)
    assert.equal(chidi.data.user.unitNumber, 'Block C')

    const me = await call(token.ada, 'GET', '/api/users/me')
    assert.equal(me.data.estate.joinCode, undefined) // residents don't see the join code
  })

  it('only lets admins create campaigns, and hides drafts from residents', async () => {
    const campaignBody = {
      title: 'Replace burnt transformer',
      description: 'The 500kVA transformer serving Katampe Gardens burnt out.',
      category: 'transformer',
      targetAmount: 100_000,
    }
    assert.equal((await call(token.ada, 'POST', '/api/campaigns', campaignBody)).status, 403)

    const created = await call(token.lead, 'POST', '/api/campaigns', campaignBody)
    assert.equal(created.status, 201)
    assert.equal(created.data.campaign.status, 'draft')
    assert.equal(created.data.campaign.levyPerHousehold, 25_000)
    state.campaignId = created.data.campaign.id

    assert.equal((await call(token.ada, 'GET', '/api/campaigns')).data.campaigns.length, 0)
    assert.equal((await call(token.ada, 'GET', `/api/campaigns/${state.campaignId}`)).status, 404)

    const published = await call(token.lead, 'POST', `/api/campaigns/${state.campaignId}/publish`)
    assert.equal(published.data.campaign.status, 'fundraising')
    state.publicToken = published.data.campaign.publicToken
    assert.ok(state.publicToken)

    assert.equal((await call(token.lead, 'POST', `/api/campaigns/${state.campaignId}/publish`)).status, 409)
    assert.equal((await call(token.ada, 'GET', '/api/campaigns')).data.campaigns.length, 1)
  })

  it('records contributions as pending until an admin verifies them', async () => {
    const path = `/api/campaigns/${state.campaignId}/contributions`
    const ada = await call(token.ada, 'POST', path, { amount: 25_000, method: 'bank_transfer', reference: 'TRF-001' })
    const bola = await call(token.bola, 'POST', path, { amount: 25_000, method: 'bank_transfer' })
    assert.equal(ada.data.contribution.status, 'pending')
    state.adaContribution = ada.data.contribution.id
    state.bolaContribution = bola.data.contribution.id

    // Residents can't record money for someone else; admins recording cash start verified.
    const chidiId = (await call(token.chidi, 'GET', '/api/users/me')).data.user.id
    assert.equal((await call(token.ada, 'POST', path, { amount: 1_000, method: 'cash', userId: chidiId })).status, 403)
    const cash = await call(token.lead, 'POST', path, { amount: 30_000, method: 'cash', userId: chidiId })
    assert.equal(cash.data.contribution.status, 'verified')

    const progress = await call(token.ada, 'GET', `/api/campaigns/${state.campaignId}/progress`)
    assert.equal(progress.data.progress.totalCollected, 30_000)
    assert.equal(progress.data.progress.pendingAmount, 50_000)
    assert.equal(progress.data.progress.pendingCount, 2)
  })

  it('lets admins verify or reject, exactly once', async () => {
    assert.equal((await call(token.ada, 'PUT', `/api/contributions/${state.adaContribution}/verify`)).status, 403)

    const verified = await call(token.lead, 'PUT', `/api/contributions/${state.adaContribution}/verify`)
    assert.equal(verified.data.contribution.status, 'verified')
    assert.equal((await call(token.lead, 'PUT', `/api/contributions/${state.adaContribution}/verify`)).status, 409)

    const noReason = await call(token.lead, 'PUT', `/api/contributions/${state.bolaContribution}/verify`, { status: 'rejected' })
    assert.equal(noReason.status, 400)
    const rejected = await call(token.lead, 'PUT', `/api/contributions/${state.bolaContribution}/verify`, {
      status: 'rejected',
      reason: 'No matching bank alert',
    })
    assert.equal(rejected.data.contribution.status, 'rejected')

    // Bola pays again and the lead pays their own share; that pushes the fund to target.
    const path = `/api/campaigns/${state.campaignId}/contributions`
    const retry = await call(token.bola, 'POST', path, { amount: 25_000, method: 'pos' })
    const own = await call(token.lead, 'POST', path, { amount: 20_000, method: 'bank_transfer' })
    await call(token.lead, 'PUT', `/api/contributions/${retry.data.contribution.id}/verify`)
    await call(token.lead, 'PUT', `/api/contributions/${own.data.contribution.id}/verify`)

    const { progress } = (await call(token.ada, 'GET', `/api/campaigns/${state.campaignId}/progress`)).data
    assert.equal(progress.totalCollected, 100_000)
    assert.equal(progress.pendingCount, 0)
    assert.equal(progress.percentFunded, 100)
    assert.ok(progress.targetReachedAt)
  })

  it('shows residents verified contributions plus only their own others', async () => {
    const asBola = await call(token.bola, 'GET', `/api/campaigns/${state.campaignId}/contributions`)
    assert.equal(asBola.data.contributions.length, 5) // 4 verified + Bola's own rejected one
    const asAda = await call(token.ada, 'GET', `/api/campaigns/${state.campaignId}/contributions`)
    assert.equal(asAda.data.contributions.length, 4)

    const residents = await call(token.lead, 'GET', `/api/estates/${state.estate.id}/residents?campaignId=${state.campaignId}`)
    assert.deepEqual(residents.data.paymentSummary, { paid: 3, partial: 1, pending: 0, unpaid: 0 })
    assert.equal((await call(token.ada, 'GET', `/api/estates/${state.estate.id}/residents`)).status, 403)
  })

  it('requires a reason to pick a vendor that is not the cheapest', async () => {
    const path = `/api/campaigns/${state.campaignId}/vendor-quotes`
    const expensive = await call(token.lead, 'POST', path, { vendorName: 'PowerFix Ltd', quotedAmount: 95_000 })
    await call(token.lead, 'POST', path, { vendorName: 'Budget Volts', quotedAmount: 70_000 })

    const quotes = await call(token.ada, 'GET', path)
    assert.deepEqual(quotes.data.summary, {
      count: 2, lowest: 70_000, highest: 95_000, average: 82_500, selectedQuoteId: null,
    })

    const selectPath = `/api/vendor-quotes/${expensive.data.quote.id}/select`
    assert.equal((await call(token.lead, 'PUT', selectPath)).status, 400)
    const selected = await call(token.lead, 'PUT', selectPath, { reason: 'Only vendor offering a 2-year warranty' })
    assert.equal(selected.data.quote.selected, true)

    const campaign = await call(token.ada, 'GET', `/api/campaigns/${state.campaignId}`)
    assert.equal(campaign.data.campaign.status, 'repairing')
    assert.equal(campaign.data.campaign.selectedVendorName, 'PowerFix Ltd')
  })

  it('completes the repair and reconciles the fund once', async () => {
    const reconcilePath = `/api/campaigns/${state.campaignId}/reconcile`
    assert.equal((await call(token.lead, 'POST', reconcilePath)).status, 409) // not complete yet

    const completed = await call(token.lead, 'POST', `/api/campaigns/${state.campaignId}/complete`, { actualCost: 70_000 })
    assert.equal(completed.data.campaign.status, 'completed')

    const reconciled = await call(token.lead, 'POST', reconcilePath)
    assert.equal(reconciled.status, 201)
    const { reconciliation } = reconciled.data
    assert.equal(reconciliation.variance, 30_000)
    assert.equal(reconciliation.outcome, 'refund')

    // Collected 100,000, cost 70,000: 30% of what each person paid comes back.
    const byName = Object.fromEntries(reconciliation.perContributor.map((row) => [row.name, row.adjustment]))
    assert.deepEqual(byName, { 'Chidi Obi': 9_000, 'Ada Eze': 7_500, 'Bola Ade': 7_500, 'Lead Okafor': 6_000 })

    assert.equal((await call(token.lead, 'POST', reconcilePath)).status, 409)

    const mine = await call(token.ada, 'GET', `/api/campaigns/${state.campaignId}/reconciliation`)
    assert.equal(mine.data.mine.adjustment, 7_500)
  })

  it('produces the transparency report as JSON and PDF', async () => {
    const report = await call(token.ada, 'GET', `/api/campaigns/${state.campaignId}/transparency-report`)
    assert.equal(report.status, 200)
    assert.equal(report.data.report.contributions.length, 4)
    assert.ok(report.data.report.timeline.some((event) => event.type === 'campaign_reconciled'))
    assert.ok(report.data.report.timeline.some((event) => event.type === 'target_reached'))

    const pdf = await call(token.ada, 'GET', `/api/campaigns/${state.campaignId}/transparency-report/pdf`)
    assert.equal(pdf.status, 200)
    assert.equal(pdf.type, 'application/pdf')
    assert.equal(pdf.data.subarray(0, 5).toString(), '%PDF-')
    savePdf('report-resident.pdf', pdf.data)
  })

  it('serves an anonymized report on the public link without sign-in', async () => {
    const report = await call(null, 'GET', `/api/public/campaigns/${state.publicToken}`)
    assert.equal(report.status, 200)

    const text = JSON.stringify(report.data)
    for (const name of ['Ada', 'Bola', 'Chidi', 'Lead Okafor', 'TRF-001']) {
      assert.ok(!text.includes(name), `public report leaked "${name}"`)
    }
    assert.equal(report.data.report.reconciliation.perContributor[0].contributor, 'Contributor 1')

    const pdf = await call(null, 'GET', `/api/public/campaigns/${state.publicToken}/pdf`)
    assert.equal(pdf.type, 'application/pdf')
    savePdf('report-public.pdf', pdf.data)
    assert.equal((await call(null, 'GET', '/api/public/campaigns/wrong-token')).status, 404)
  })

  it('notifies residents along the way', async () => {
    const { data } = await call(token.ada, 'GET', '/api/users/me/notifications')
    const types = data.notifications.map((n) => n.type)
    for (const type of ['campaign_published', 'contribution_verified', 'target_reached', 'vendor_selected', 'repair_completed', 'campaign_reconciled']) {
      assert.ok(types.includes(type), `missing ${type} notification`)
    }
    const refund = data.notifications.find((n) => n.type === 'campaign_reconciled')
    assert.match(refund.message, /refund of NGN 7,500/)

    const read = await call(token.ada, 'PUT', `/api/notifications/${refund.id}/read`)
    assert.equal(read.data.notification.read, true)
    assert.equal((await call(token.bola, 'PUT', `/api/notifications/${refund.id}/read`)).status, 404)

    const all = await call(token.ada, 'PUT', '/api/users/me/notifications/read-all')
    assert.equal(all.data.markedRead, data.unreadCount - 1)
  })

  it('keeps estate stats in step', async () => {
    const { data } = await call(token.lead, 'GET', `/api/estates/${state.estate.id}`)
    assert.equal(data.stats.residentCount, 4)
    assert.equal(data.stats.totalRaised, 100_000)
    assert.equal(data.stats.totalSpent, 70_000)
    assert.equal(data.stats.campaignsByStatus.reconciled, 1)
  })
})
