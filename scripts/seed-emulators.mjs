// Fills the local Firebase emulators with a realistic estate, so every dashboard screen
// has something to show. It never touches the real project: it refuses to run unless
// the emulator settings from .env.emulators are loaded.
//
//   npm run emulators          (in one terminal)
//   npm run seed:emulators     (in another; run it again any time for a fresh copy)
//
// Then sign in as the community lead, john@cirf.test, or as any resident, for example
// amina@cirf.test. Every password is password123.
//
// What it creates, modelled on the dashboard design: Maple Estate in Alagbado with 62
// members, and a "Transformer Repair Campaign" raising ₦3,500,000. Contributions were
// verified day by day since the campaign opened 13 days ago: 48 households have paid in
// full, 10 part-paid, 4 not yet. Three vendors quoted, and the cheapest was selected.
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run this with `npm run seed:emulators`, so it only ever writes to the emulators')
}

const { Timestamp } = await import('firebase-admin/firestore')
const { auth, db } = await import('../server/services/firebaseAdmin.js')
const { collections } = await import('../server/services/collections.js')

const PASSWORD = 'password123'
const DAY = 24 * 60 * 60 * 1000
const now = Date.now()
const daysAgo = (days, hour = 10) => {
  const date = new Date(now - days * DAY)
  date.setUTCHours(hour - 1, (days * 17) % 60, 0, 0) // hour is Nigerian time (UTC+1)
  return Timestamp.fromMillis(Math.min(date.getTime(), now - 60_000)) // never in the future
}
const dayString = (daysFromNow) => new Date(now + daysFromNow * DAY + 60 * 60 * 1000).toISOString().slice(0, 10)

const FIRST = ['Chinedu', 'Amina', 'Tunde', 'Blessing', 'Samuel', 'Faith', 'Ibrahim', 'Ngozi', 'Kelvin', 'Esther',
  'Emeka', 'Aisha', 'Segun', 'Grace', 'Musa', 'Chioma', 'Femi', 'Halima', 'Uche', 'Yetunde', 'Bayo', 'Zainab',
  'Ikenna', 'Funmi', 'Sani', 'Adaeze', 'Kunle', 'Hauwa', 'Obinna', 'Temitope', 'Dapo']
const LAST = ['Okafor', 'Yusuf', 'Bello', 'Eze', 'Adeyemi', 'Ojo', 'Musa', 'Chukwu', 'Okoro', 'Daniel', 'Balogun',
  'Nwosu', 'Abubakar', 'Adebayo', 'Obi', 'Lawal', 'Okonkwo', 'Salami', 'Ibe', 'Afolabi']

async function clearEmulators() {
  const project = process.env.FIREBASE_PROJECT_ID ?? 'demo-cirf'
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: 'DELETE' })
  await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${project}/accounts`, { method: 'DELETE' })
}

// Firestore batches take at most 500 writes.
async function commitAll(writes) {
  for (let start = 0; start < writes.length; start += 450) {
    const batch = db.batch()
    for (const [ref, data] of writes.slice(start, start + 450)) batch.set(ref, data)
    await batch.commit()
  }
}

await clearEmulators()
const writes = []

// People: John Doe leads the estate; 61 residents live in blocks A and B.
const people = [{ name: 'John Doe', email: 'john@cirf.test', role: 'admin', unitNumber: 'A01', phone: '+2348012345678' }]
for (let i = 0; people.length < 62; i++) {
  const first = FIRST[i % FIRST.length]
  const last = LAST[(i * 7 + Math.floor(i / FIRST.length)) % LAST.length]
  const email = `${first.toLowerCase()}${i < FIRST.length ? '' : i}@cirf.test`
  const unitNumber = `${i % 2 ? 'B' : 'A'}${String(Math.floor(i / 2) + 2).padStart(2, '0')}`
  people.push({ name: `${first} ${last}`, email, role: 'resident', unitNumber, phone: `+23480${String(90000000 + i * 1379).slice(0, 8)}` })
}

const estateRef = collections.estates.doc()
for (const person of people) {
  const { uid } = await auth.createUser({ email: person.email, password: PASSWORD, displayName: person.name })
  person.id = uid
  writes.push([collections.users.doc(uid), {
    name: person.name,
    email: person.email,
    phone: person.phone,
    role: person.role,
    estateId: estateRef.id,
    requestedEstateId: null,
    requestedAt: null,
    unitNumber: person.unitNumber,
    units: 1,
    status: 'active',
    createdAt: daysAgo(30),
    updatedAt: daysAgo(30),
  }])
  writes.push([collections.phoneNumbers.doc(person.phone), { uid, createdAt: daysAgo(30) }])
}
const lead = people[0]
const actor = (at) => ({ actorId: lead.id, actorName: lead.name, createdAt: at })

writes.push([estateRef, {
  name: 'Maple Estate',
  nameLower: 'maple estate',
  address: 'Alagbado',
  // 70 households, not all of them on CIRF yet; a flat levy of ₦50,000 each.
  totalHouseholds: 70,
  totalUnits: 70,
  joinCode: 'MAPLE7',
  allowRegistration: true,
  requireApproval: true,
  createdBy: lead.id,
  createdAt: daysAgo(30),
  updatedAt: daysAgo(30),
}])

// The campaign opened 13 days ago and has 12 days to go.
const campaignRef = collections.campaigns.doc()
const events = []
const event = (type, message, at, data = {}) => events.push({ type, message, data, ...actor(at) })
event('campaign_created', 'Campaign created with a target of ₦3,500,000', daysAgo(14), { targetAmount: 3_500_000 })
event('campaign_published', 'Campaign published and opened for contributions', daysAgo(13))

// Contributions: 48 households pay ₦50,000 in full, 10 pay ₦45,000 so far, 4 nothing yet.
// Payments are spread evenly over the days since opening, verified by the lead the same day.
const residents = people.slice(1)
const payers = [lead, ...residents].slice(0, 58)
let totalCollected = 0
payers.forEach((person, index) => {
  const amount = index < 48 ? 50_000 : 45_000
  const at = daysAgo(12 - Math.floor((index * 13) / 58), 9 + (index % 9))
  totalCollected += amount
  const ref = collections.contributions.doc()
  writes.push([ref, {
    campaignId: campaignRef.id,
    estateId: estateRef.id,
    userId: person.id,
    userName: person.name,
    unitNumber: person.unitNumber,
    amount,
    method: index % 4 ? 'bank_transfer' : 'cash',
    reference: `REF-${String(100 + index).padStart(5, '0')}`,
    note: null,
    paidAt: null,
    proofUrl: null,
    status: 'verified',
    recordedBy: person.id,
    recordedByName: person.name,
    verifiedBy: lead.id,
    verifiedByName: lead.name,
    verifiedAt: at,
    rejectionReason: null,
    createdAt: at,
    updatedAt: at,
  }])
  event('contribution_verified', `${lead.name} verified ${person.name}'s contribution`, at, { contributionId: ref.id, amount })
})

// Vendor quotes; the cheapest one is selected, which moves the campaign into repairs.
const quotes = [
  { vendorName: 'Sunvolt Electrical Services', quotedAmount: 2_640_000, notes: 'Delivery in 3 days, 12 months warranty' },
  { vendorName: 'Greenline Power Solutions', quotedAmount: 3_450_000, notes: 'Delivery in 5 days, 6 months warranty' },
  { vendorName: 'BrightFix Electricals', quotedAmount: 3_750_000, notes: 'Delivery in 4 days, 12 months warranty' },
]
const quoteRefs = quotes.map(() => collections.vendorQuotes.doc())
quotes.forEach((quote, index) => {
  const at = daysAgo(8 - index)
  writes.push([quoteRefs[index], {
    campaignId: campaignRef.id,
    estateId: estateRef.id,
    vendorName: quote.vendorName,
    vendorPhone: null,
    quotedAmount: quote.quotedAmount,
    notes: quote.notes,
    attachmentUrl: null,
    selected: index === 0,
    selectedAt: index === 0 ? daysAgo(3) : null,
    selectedBy: index === 0 ? lead.id : null,
    selectionReason: null,
    addedBy: lead.id,
    addedByName: lead.name,
    submittedAt: at,
  }])
  event('quote_added', `Quote added: ${quote.vendorName}`, at, { quoteId: quoteRefs[index].id, quotedAmount: quote.quotedAmount })
})
event('vendor_selected', 'Sunvolt Electrical Services selected at ₦2,640,000', daysAgo(3), { quoteId: quoteRefs[0].id })

writes.push([campaignRef, {
  estateId: estateRef.id,
  title: 'Transformer Repair Campaign',
  description: 'Replacement of faulty 100kVA transformer serving Block A and B. This campaign is self-funded by residents and managed transparently through CIRF.',
  category: 'transformer',
  imageUrl: null,
  deadline: dayString(12),
  targetAmount: 3_500_000,
  levyMethod: 'flat',
  levyPerHousehold: 50_000,
  levyPerUnit: null,
  status: 'repairing',
  publicToken: 'demo-maple-transformer-report',
  totalCollected,
  pendingAmount: 0,
  verifiedCount: payers.length,
  pendingCount: 0,
  targetReachedAt: null,
  selectedQuoteId: quoteRefs[0].id,
  selectedVendorName: quotes[0].vendorName,
  selectedQuoteAmount: quotes[0].quotedAmount,
  actualCost: null,
  completionNote: null,
  receiptUrl: null,
  createdBy: lead.id,
  createdByName: lead.name,
  createdAt: daysAgo(14),
  updatedAt: daysAgo(3),
  publishedAt: daysAgo(13),
  repairStartedAt: daysAgo(3),
  completedAt: null,
  reconciledAt: null,
}])
for (const e of events) writes.push([campaignRef.collection('events').doc(), e])

// Kemi found Maple Estate on Create Account this morning and is waiting for approval.
const kemi = await auth.createUser({ email: 'kemi@cirf.test', password: PASSWORD, displayName: 'Kemi Adewale' })
writes.push([collections.users.doc(kemi.uid), {
  name: 'Kemi Adewale',
  email: 'kemi@cirf.test',
  phone: null,
  role: 'resident',
  estateId: null,
  requestedEstateId: estateRef.id,
  requestedAt: daysAgo(0, 8),
  unitNumber: 'B33',
  units: 1,
  status: 'active',
  createdAt: daysAgo(0, 8),
  updatedAt: daysAgo(0, 8),
}])

// Unread notifications for the lead, so the bell has its dot.
for (const [type, title, message, at] of [
  ['join_request', 'New join request', 'Kemi Adewale asked to join Maple Estate.', daysAgo(0, 8)],
  ['vendor_selected', 'Vendor selected', 'Sunvolt Electrical Services will carry out the repair.', daysAgo(3)],
]) {
  writes.push([collections.notifications.doc(), {
    userId: lead.id, type, campaignId: type === 'join_request' ? null : campaignRef.id, title, message, read: false, createdAt: at,
  }])
}

await commitAll(writes)
console.log(`Seeded Maple Estate: ${people.length} people, ₦${totalCollected.toLocaleString()} collected.`)
console.log(`Sign in as ${lead.email} (community lead) or ${residents[1].email} (resident), password ${PASSWORD}.`)
process.exit(0)
