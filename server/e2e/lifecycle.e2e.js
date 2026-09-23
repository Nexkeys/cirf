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

// Calls the Auth emulator's REST API, the same one the Firebase web SDK uses.
async function authEmulator(action, body) {
  const response = await fetch(
    `http://${FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:${action}?key=emulator`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, returnSecureToken: true }),
    },
  )
  return (await response.json()).idToken
}

async function signUp(email) {
  const password = 'password123'
  await auth.createUser({ email, password })
  return authEmulator('signInWithPassword', { email, password })
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

    for (const name of ['lead', 'ada', 'bola', 'chidi', 'outsider', 'dayo', 'efe', 'funmi']) {
      token[name] = await signUp(`${name}@example.com`)
    }
  })

  after(() => server.close())

  it('rejects requests without a valid token', async () => {
    assert.equal((await call(null, 'GET', '/api/users/me')).status, 401)
    assert.equal((await call('not-a-token', 'GET', '/api/users/me')).status, 401)

    const unregistered = await call(token.ada, 'GET', '/api/users/me')
    assert.equal(unregistered.status, 403)
    assert.equal(unregistered.data.error.code, 'NOT_REGISTERED') // the app opens Create Account
  })

  it('lets a community lead sign up and name their estate in one step', async () => {
    const registered = await call(token.lead, 'POST', '/api/users/register', {
      name: 'Lead Okafor',
      role: 'admin',
      phone: '0801 234 5678',
      estateName: 'Katampe Gardens',
    })
    assert.equal(registered.status, 201)
    assert.equal(registered.data.user.phone, '+2348012345678')

    const { estate } = (await call(token.lead, 'GET', '/api/users/me')).data
    assert.equal(estate.name, 'Katampe Gardens')
    assert.match(estate.joinCode, /^[A-Z2-9]{6}$/)
    state.estate = estate
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

  it('signs people in with a phone number and password', async () => {
    const taken = await call(token.efe, 'POST', '/api/users/register', {
      name: 'Efe Musa',
      phone: '+234 801 234 5678',
      joinCode: state.estate.joinCode,
    })
    assert.equal(taken.status, 409) // the lead already registered this number

    const signIn = (phone, password) => call(null, 'POST', '/api/auth/phone-sign-in', { phone, password })
    const wrongPassword = await signIn('08012345678', 'not-the-password')
    const unknownNumber = await signIn('08099999999', 'password123')
    assert.equal(wrongPassword.status, 401)
    // Same answer either way, so nobody can find out which numbers have accounts.
    assert.deepEqual(unknownNumber.data, wrongPassword.data)
    assert.equal((await signIn('12345', 'password123')).status, 400)

    const signedIn = await signIn('2348012345678', 'password123')
    assert.equal(signedIn.status, 200)
    const idToken = await authEmulator('signInWithCustomToken', { token: signedIn.data.customToken })
    assert.equal((await call(idToken, 'GET', '/api/users/me')).data.user.name, 'Lead Okafor')
  })

  it('only lets admins create campaigns, and hides drafts from residents', async () => {
    const campaignBody = {
      title: 'Replace burnt transformer',
      description: 'The 500kVA transformer serving Katampe Gardens burnt out.',
      category: 'transformer',
      targetAmount: 100_000,
    }
    assert.equal((await call(token.ada, 'POST', '/api/campaigns', campaignBody)).status, 403)

    // The estate was created from the sign-up form, so there's no household count to split a levy by yet.
    const tooEarly = await call(token.lead, 'POST', '/api/campaigns', campaignBody)
    assert.equal(tooEarly.status, 400)
    assert.equal(tooEarly.data.error.details[0].field, 'totalHouseholds')
    await call(token.lead, 'PUT', `/api/estates/${state.estate.id}`, {
      address: '12 Katampe Road, Abuja',
      totalHouseholds: 4,
    })

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

    // The payment account can still be corrected after publishing, by the lead only.
    const paymentPath = `/api/campaigns/${state.campaignId}/payment-details`
    const account = { bankName: 'Moniepoint MFB', accountName: 'Katampe Gardens Repair Fund', accountNumber: '0123456789' }
    assert.equal((await call(token.lead, 'PUT', paymentPath, { ...account, accountNumber: '12345' })).status, 400)
    assert.equal((await call(token.ada, 'PUT', paymentPath, account)).status, 403)
    const withAccount = await call(token.lead, 'PUT', paymentPath, account)
    assert.deepEqual(withAccount.data.campaign.paymentDetails, account)
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
    const expensive = await call(token.lead, 'POST', path, {
      vendorName: 'PowerFix Ltd',
      quotedAmount: 95_000,
      contactPerson: 'Samuel Okafor',
      vendorEmail: 'jobs@powerfix.example',
      scope: 'Transformer Replacement (500kVA)',
      inclusions: ['Supply & installation', 'Includes testing'],
      deliveryDays: 3,
      warrantyMonths: 24,
    })
    assert.equal(expensive.status, 201)
    assert.deepEqual(expensive.data.quote.inclusions, ['Supply & installation', 'Includes testing'])
    assert.equal((await call(token.lead, 'POST', path, { vendorName: 'Bad Email', quotedAmount: 1, vendorEmail: 'nope' })).status, 400)
    await call(token.lead, 'POST', path, { vendorName: 'Budget Volts', quotedAmount: 70_000 })

    const quotes = await call(token.ada, 'GET', path)
    assert.deepEqual(quotes.data.summary, {
      count: 2, lowest: 70_000, highest: 95_000, average: 82_500, selectedQuoteId: null,
    })

    state.quoteId = expensive.data.quote.id
    const selectPath = `/api/vendor-quotes/${expensive.data.quote.id}/select`
    assert.equal((await call(token.lead, 'PUT', selectPath)).status, 400)
    const selected = await call(token.lead, 'PUT', selectPath, { reason: 'Only vendor offering a 2-year warranty' })
    assert.equal(selected.data.quote.selected, true)

    const campaign = await call(token.ada, 'GET', `/api/campaigns/${state.campaignId}`)
    assert.equal(campaign.data.campaign.status, 'repairing')
    assert.equal(campaign.data.campaign.selectedVendorName, 'PowerFix Ltd')

    // The dashboard overview: residents see estate-wide counts, with no names.
    const { overview } = (await call(token.ada, 'GET', `/api/campaigns/${state.campaignId}/overview`)).data
    assert.deepEqual(overview.contributors, { total: 4, paid: 3, pending: 1, overdue: 0 }) // the lead paid 20k of 25k
    assert.deepEqual(overview.quotes, { count: 2, selected: true })
    assert.deepEqual(overview.estimate, { basis: 'quote', cost: 95_000, difference: 5_000 })
    assert.equal(overview.collectedThisWeek, 100_000)
    assert.equal(overview.timeline.at(-1).total, 100_000)
  })

  it('completes the repair and reconciles the fund once', async () => {
    const reconcilePath = `/api/campaigns/${state.campaignId}/reconcile`
    assert.equal((await call(token.lead, 'POST', reconcilePath)).status, 409) // not complete yet

    const completePath = `/api/campaigns/${state.campaignId}/complete`
    // An itemised cost has to add up to the actual cost.
    const wrongSum = await call(token.lead, 'POST', completePath, {
      actualCost: 70_000,
      costItems: [{ label: 'Transformer', amount: 50_000 }, { label: 'Labour', amount: 10_000 }],
    })
    assert.equal(wrongSum.status, 400)
    assert.equal(wrongSum.data.error.details[0].field, 'costItems')

    const costItems = [{ label: 'Transformer', amount: 55_000 }, { label: 'Labour & installation', amount: 15_000 }]
    const completed = await call(token.lead, 'POST', completePath, { actualCost: 70_000, costItems })
    assert.equal(completed.data.campaign.status, 'completed')
    assert.deepEqual(completed.data.campaign.costItems, costItems)

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
    assert.equal(report.data.report.campaign.costItems.length, 2)
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

  it("keeps an estate's data away from admins of other estates", async () => {
    await call(token.outsider, 'POST', '/api/users/register', { name: 'Other Lead', role: 'admin' })
    await call(token.outsider, 'POST', '/api/estates', {
      name: 'Elsewhere Estate',
      address: '1 Elsewhere Close, Lagos',
      totalHouseholds: 10,
    })

    // Being an admin of *an* estate must not unlock anyone else's.
    const attempts = [
      ['GET', `/api/estates/${state.estate.id}`],
      ['PUT', `/api/estates/${state.estate.id}`, { name: 'Taken Over Estate' }],
      ['GET', `/api/estates/${state.estate.id}/residents`],
      ['POST', `/api/estates/${state.estate.id}/residents`, { email: 'spy@example.com' }],
      ['GET', `/api/campaigns/${state.campaignId}`],
      ['GET', `/api/campaigns/${state.campaignId}/overview`],
      ['GET', `/api/campaigns/${state.campaignId}/contributions`],
      ['POST', `/api/campaigns/${state.campaignId}/contributions`, { amount: 1_000, method: 'cash' }],
      ['GET', `/api/campaigns/${state.campaignId}/vendor-quotes`],
      ['PUT', `/api/vendor-quotes/${state.quoteId}/select`, { reason: 'Trying to pick for them' }],
      ['PUT', `/api/contributions/${state.adaContribution}/verify`],
      ['GET', `/api/campaigns/${state.campaignId}/reconciliation`],
      ['GET', `/api/campaigns/${state.campaignId}/transparency-report`],
      ['GET', `/api/campaigns/${state.campaignId}/transparency-report/pdf`],
    ]
    for (const [method, path, body] of attempts) {
      assert.equal((await call(token.outsider, method, path, body)).status, 403, `${method} ${path}`)
    }
    assert.deepEqual((await call(token.outsider, 'GET', '/api/campaigns')).data.campaigns, [])
  })

  it('keeps estate stats in step', async () => {
    const { data } = await call(token.lead, 'GET', `/api/estates/${state.estate.id}`)
    assert.equal(data.stats.residentCount, 4)
    assert.equal(data.stats.totalRaised, 100_000)
    assert.equal(data.stats.totalSpent, 70_000)
    assert.equal(data.stats.campaignsByStatus.reconciled, 1)
  })

  it('lets residents find their estate by name and wait for an admin to approve them', async () => {
    const search = await call(null, 'GET', '/api/public/estates?q=KATAMPE')
    assert.deepEqual(search.data.estates.map((estate) => estate.name), ['Katampe Gardens'])
    assert.equal(search.data.estates[0].joinCode, undefined)
    assert.equal((await call(null, 'GET', '/api/public/estates?q=k')).status, 400)

    const asked = await call(token.dayo, 'POST', '/api/users/register', {
      name: 'Dayo Bello',
      phone: '08033334444',
      estateId: state.estate.id,
    })
    assert.equal(asked.status, 201)
    assert.equal(asked.data.user.estateId, null)
    assert.equal(asked.data.user.requestedEstateId, state.estate.id)

    // Waiting for approval unlocks nothing in the estate.
    const me = await call(token.dayo, 'GET', '/api/users/me')
    assert.equal(me.data.joinRequest.estateName, 'Katampe Gardens')
    assert.equal((await call(token.dayo, 'GET', `/api/estates/${state.estate.id}`)).status, 403)
    assert.equal((await call(token.dayo, 'GET', `/api/campaigns/${state.campaignId}`)).status, 403)
    assert.deepEqual((await call(token.dayo, 'GET', '/api/campaigns')).data.campaigns, [])

    const leadInbox = await call(token.lead, 'GET', '/api/users/me/notifications')
    assert.ok(leadInbox.data.notifications.some((n) => n.type === 'join_request'))
    const residents = await call(token.lead, 'GET', `/api/estates/${state.estate.id}/residents`)
    assert.deepEqual(residents.data.joinRequests.map((person) => person.name), ['Dayo Bello'])
    assert.equal((await call(token.lead, 'GET', `/api/estates/${state.estate.id}`)).data.stats.joinRequestCount, 1)

    const approvePath = `/api/estates/${state.estate.id}/join-requests/${asked.data.user.id}/approve`
    assert.equal((await call(token.ada, 'POST', approvePath)).status, 403)
    assert.equal((await call(token.outsider, 'POST', approvePath)).status, 403)
    const approved = await call(token.lead, 'POST', approvePath, { unitNumber: 'Block D' })
    assert.equal(approved.data.resident.estateId, state.estate.id)
    assert.equal(approved.data.resident.unitNumber, 'Block D')
    assert.equal((await call(token.lead, 'POST', approvePath)).status, 404) // already answered

    assert.equal((await call(token.dayo, 'GET', `/api/campaigns/${state.campaignId}`)).status, 200)
    const dayoInbox = await call(token.dayo, 'GET', '/api/users/me/notifications')
    assert.ok(dayoInbox.data.notifications.some((n) => n.type === 'join_approved'))
  })

  it('hides an estate that closed registration, but its join code still works', async () => {
    await call(token.lead, 'PUT', `/api/estates/${state.estate.id}`, { allowRegistration: false })
    assert.deepEqual((await call(null, 'GET', '/api/public/estates?q=katampe')).data.estates, [])

    const refused = await call(token.efe, 'POST', '/api/users/register', { name: 'Efe Musa', estateId: state.estate.id })
    assert.equal(refused.status, 403)
    assert.equal(refused.data.error.code, 'REGISTRATION_CLOSED')

    // The admin handed the code out on purpose, so it skips both the setting and approval.
    const withCode = await call(token.efe, 'POST', '/api/users/register', { name: 'Efe Musa', joinCode: state.estate.joinCode })
    assert.equal(withCode.data.user.estateId, state.estate.id)
  })

  it('lets a declined resident ask again or withdraw their request', async () => {
    await call(token.lead, 'PUT', `/api/estates/${state.estate.id}`, { allowRegistration: true })
    const asked = await call(token.funmi, 'POST', '/api/users/register', { name: 'Funmi Ade', estateId: state.estate.id })

    const declinePath = `/api/estates/${state.estate.id}/join-requests/${asked.data.user.id}`
    assert.equal((await call(token.lead, 'DELETE', declinePath)).status, 204)
    assert.equal((await call(token.funmi, 'GET', '/api/users/me')).data.joinRequest, null)
    const inbox = await call(token.funmi, 'GET', '/api/users/me/notifications')
    assert.ok(inbox.data.notifications.some((n) => n.type === 'join_declined'))

    const again = await call(token.funmi, 'POST', '/api/users/me/join-request', { estateId: state.estate.id })
    assert.equal(again.data.user.requestedEstateId, state.estate.id)
    assert.equal((await call(token.funmi, 'DELETE', '/api/users/me/join-request')).status, 204)
    assert.equal((await call(token.funmi, 'DELETE', '/api/users/me/join-request')).status, 404)
  })

  it("protects the estate's owner and lets them hand the estate on", async () => {
    const estatePath = `/api/estates/${state.estate.id}`
    const leadId = (await call(token.lead, 'GET', '/api/users/me')).data.user.id
    const adaId = (await call(token.ada, 'GET', '/api/users/me')).data.user.id

    // The estate's photo and community type can be set in Estate Settings.
    const updated = await call(token.lead, 'PUT', estatePath, { communityType: 'compound' })
    assert.equal(updated.data.estate.communityType, 'compound')
    assert.equal((await call(token.lead, 'PUT', estatePath, { communityType: 'castle' })).status, 400)

    // Ada becomes a co-admin, but still can't touch the owner or take the estate.
    await call(token.lead, 'PUT', `${estatePath}/residents/${adaId}`, { role: 'admin' })
    assert.equal((await call(token.ada, 'PUT', `${estatePath}/residents/${leadId}`, { role: 'resident' })).status, 400)
    assert.equal((await call(token.ada, 'DELETE', `${estatePath}/residents/${leadId}`)).status, 400)
    assert.equal((await call(token.ada, 'POST', `${estatePath}/transfer-ownership`, { userId: adaId })).status, 403)

    // The owner hands it over and stays on as a co-admin.
    const handed = await call(token.lead, 'POST', `${estatePath}/transfer-ownership`, { userId: adaId })
    assert.equal(handed.data.estate.ownerId, adaId)
    assert.equal((await call(token.lead, 'GET', '/api/users/me')).data.user.role, 'admin')
    // Now the old owner is an ordinary co-admin the new owner can manage.
    assert.equal((await call(token.ada, 'PUT', `${estatePath}/residents/${leadId}`, { role: 'resident' })).status, 200)
  })
})
