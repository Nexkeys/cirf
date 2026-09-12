import { docToJson } from '../lib/firestore.js'
import { collections } from './collections.js'

// Every authenticated request needs the caller's role and estate, and the frontend
// polls every few seconds. A short per-instance cache stops each poll from costing an
// extra Firestore read. Writes to a profile call forgetUserProfile() so this instance
// sees the change at once; other warm instances catch up within CACHE_TTL_MS.
const CACHE_TTL_MS = 15_000
const cache = new Map()

export async function getUserProfile(uid) {
  const cached = cache.get(uid)
  if (cached && cached.expiresAt > Date.now()) return cached.profile

  const snapshot = await collections.users.doc(uid).get()
  if (!snapshot.exists) return null // not registered yet, never cached

  const profile = docToJson(snapshot)
  cache.set(uid, { profile, expiresAt: Date.now() + CACHE_TTL_MS })
  return profile
}

export function forgetUserProfile(uid) {
  cache.delete(uid)
}

// The profile fields the API sends back about a person.
export function publicProfile(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    role: user.role,
    estateId: user.estateId ?? null,
    requestedEstateId: user.requestedEstateId ?? null,
    requestedAt: user.requestedAt ?? null,
    unitNumber: user.unitNumber ?? null,
    units: user.units ?? 1,
    status: user.status ?? 'active',
    createdAt: user.createdAt ?? null,
  }
}

export async function estateMembers(estateId) {
  const snapshot = await collections.users.where('estateId', '==', estateId).get()
  return snapshot.docs.map(docToJson).map(publicProfile)
}
