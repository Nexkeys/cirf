import { randomInt } from 'node:crypto'
import { isAdmin } from '../lib/access.js'
import { docToJson } from '../lib/firestore.js'
import { notFound } from '../lib/httpError.js'
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
