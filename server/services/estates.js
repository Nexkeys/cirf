import { randomInt } from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { isAdmin } from '../lib/access.js'
import { docToJson } from '../lib/firestore.js'
import { badRequest, forbidden, notFound } from '../lib/httpError.js'
import { collections } from './collections.js'

// No 0/O or 1/I, so a code read out loud or copied from a WhatsApp message can't be misread.
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const JOIN_CODE_LENGTH = 6

export async function generateJoinCode() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Array.from(
      { length: JOIN_CODE_LENGTH },
      () => JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)],
    ).join('')
    if (!(await findEstateByJoinCode(code))) return code
  }
  throw new Error('Could not generate a unique estate join code')
}

export async function findEstateByJoinCode(code) {
  const snapshot = await collections.estates.where('joinCode', '==', code).limit(1).get()
  return snapshot.empty ? null : docToJson(snapshot.docs[0])
}

export async function loadEstate(estateId) {
  const snapshot = await collections.estates.doc(estateId).get()
  if (!snapshot.exists) throw notFound('Estate not found')
  return docToJson(snapshot)
}

// Only admins see the join code; residents could otherwise hand it to anyone.
export function estateJson(estate, viewer) {
  if (isAdmin(viewer)) return estate
  const { joinCode: _hidden, ...rest } = estate
  return rest
}

// Residents find their estate by typing the start of its name, so a lowercase copy with
// single spaces is stored next to the name for Firestore to range-match on.
export const searchableName = (name) => name.trim().toLowerCase().replace(/\s+/g, ' ')

export const COMMUNITY_TYPES = ['residential_estate', 'street', 'compound', 'other']

// The person who created the estate owns it, until they hand it on (Transfer ownership).
export const estateOwnerId = (estate) => estate.ownerId ?? estate.createdBy

// The fields every new estate starts with. Only the name is required, because that's all
// the Create Account screen asks a community lead for. The address and household counts
// are added in Estate Settings before the first campaign (see assertLevyCounts).
export async function newEstate({ name, address, totalHouseholds, totalUnits }, createdBy) {
  return {
    name,
    nameLower: searchableName(name),
    address: address ?? null,
    totalHouseholds: totalHouseholds ?? null,
    totalUnits: totalUnits ?? totalHouseholds ?? null,
    joinCode: await generateJoinCode(),
    communityType: 'residential_estate',
    imageUrl: null,
    // "Community Access" in Estate Settings. By default residents can find the estate
    // and ask to join, and an admin approves each request before they see anything.
    allowRegistration: true,
    requireApproval: true,
    createdBy,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }
}

// How a resident gets into an estate. Returns null if they gave neither option.
//   joinCode -> the admin shared the code with them, so they join straight away
//   estateId -> picked from the estate search; waits for approval if the estate requires it
// `membership` is the fields to write on their user profile. Someone waiting for approval
// only gets requestedEstateId, never estateId, so every estate-scoped check keeps
// refusing them until an admin says yes.
export async function resolveJoin({ joinCode, estateId }) {
  if (joinCode) {
    const estate = await findEstateByJoinCode(joinCode)
    if (!estate) {
      throw badRequest('No estate matches that join code', [
        { field: 'joinCode', message: 'No estate matches that join code' },
      ])
    }
    return { estate, membership: { estateId: estate.id } }
  }

  if (estateId) {
    const snapshot = await collections.estates.doc(estateId).get()
    if (!snapshot.exists) {
      throw badRequest('That estate is no longer on CIRF', [
        { field: 'estateId', message: 'That estate is no longer on CIRF' },
      ])
    }
    const estate = docToJson(snapshot)
    if (estate.allowRegistration === false) {
      throw forbidden(
        `${estate.name} isn't accepting new residents. Ask your community lead to invite you.`,
        'REGISTRATION_CLOSED',
      )
    }
    const membership =
      estate.requireApproval === false
        ? { estateId: estate.id }
        : { requestedEstateId: estate.id, requestedAt: FieldValue.serverTimestamp() }
    return { estate, membership }
  }

  return null
}

// A levy is the target split across households (flat) or units (per_unit), so the estate
// needs that count before a campaign can be priced.
export function assertLevyCounts(estate, levyMethod) {
  const [field, label] =
    levyMethod === 'per_unit' ? ['totalUnits', 'total number of units'] : ['totalHouseholds', 'number of households']
  if (!estate[field]) {
    throw badRequest(`Add your estate's ${label} in Estate Settings first, so CIRF can work out each levy`, [
      { field, message: `Add the estate's ${label}` },
    ])
  }
}
