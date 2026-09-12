import { tooManyRequests } from '../lib/httpError.js'

// Checks an email and password against Firebase Auth. The Admin SDK can't verify
// passwords, so this calls the same REST endpoint the Firebase web SDK uses to sign in.
// It needs the project's web API key (public by design) in FIREBASE_API_KEY.
// Returns true or false, and only throws when Firebase refuses to answer.
export async function passwordMatches(email, password) {
  const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST
  const base = emulator ? `http://${emulator}/identitytoolkit.googleapis.com` : 'https://identitytoolkit.googleapis.com'
  const key = emulator ? 'emulator' : process.env.FIREBASE_API_KEY
  if (!key) throw new Error('FIREBASE_API_KEY is not set, so phone sign-in cannot check passwords')

  const response = await fetch(`${base}/v1/accounts:signInWithPassword?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: false }),
  })
  if (response.ok) return true

  const reason = (await response.json().catch(() => null))?.error?.message ?? ''
  if (reason.startsWith('TOO_MANY_ATTEMPTS')) {
    throw tooManyRequests('Too many sign-in attempts. Wait a few minutes, or reset your password.')
  }
  if (/^(INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND|USER_DISABLED)/.test(reason)) return false
  throw new Error(`Firebase password check failed: ${reason || response.status}`)
}
