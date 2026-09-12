import { requireRole } from './requireRole.js'
import { verifyFirebaseToken } from './verifyFirebaseToken.js'

// Ready-made middleware chains so every route states its access level in one word.
// They match the Auth column of the API spec.

// Signed in with Firebase, but may not have a CIRF profile yet (only for registering).
export const signedIn = [verifyFirebaseToken]

// Any registered, non-suspended user ("Resident" in the spec; admins pass too).
export const registered = [verifyFirebaseToken, requireRole()]

// Community leads only.
export const adminOnly = [verifyFirebaseToken, requireRole('admin')]
