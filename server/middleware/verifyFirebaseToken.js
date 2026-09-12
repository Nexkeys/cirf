import { unauthorized } from '../lib/httpError.js'
import { auth } from '../services/firebaseAdmin.js'
import { getUserProfile } from '../services/users.js'

// Every protected request must carry `Authorization: Bearer <Firebase ID token>`.
// The token is verified with the Admin SDK, then the caller's Firestore profile (role
// and estate) is loaded so requireRole and the routes can make permission decisions.
//
// After this runs:
//   req.auth -> { uid, email, name } straight from the verified token
//   req.user -> the Firestore profile, or null if they haven't registered yet
export async function verifyFirebaseToken(req, res, next) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ')
  if (scheme !== 'Bearer' || !token) {
    throw unauthorized('Sign in first: missing "Authorization: Bearer <token>" header')
  }

  let decoded
  try {
    decoded = await auth.verifyIdToken(token)
  } catch {
    throw unauthorized('Your session is invalid or has expired, sign in again')
  }

  req.auth = { uid: decoded.uid, email: decoded.email ?? null, name: decoded.name ?? null }
  req.user = await getUserProfile(decoded.uid)
  next()
}
