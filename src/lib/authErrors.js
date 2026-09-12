// Turns Firebase Auth error codes into messages people can act on. API errors already
// arrive with a readable message, so they pass straight through.
const MESSAGES = {
  'auth/invalid-credential': 'Incorrect email or password',
  'auth/invalid-login-credentials': 'Incorrect email or password',
  'auth/wrong-password': 'Incorrect email or password',
  'auth/user-not-found': 'Incorrect email or password',
  'auth/invalid-email': 'Enter a valid email address',
  'auth/missing-password': 'Enter your password',
  'auth/email-already-in-use': 'An account already uses this email. Sign in instead.',
  'auth/weak-password': 'Use at least 8 characters for your password',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes, or reset your password.',
  'auth/network-request-failed': "Can't reach the sign-in service. Check your connection and try again.",
  'auth/popup-blocked': 'Your browser blocked the Google window. Allow pop-ups for this site and try again.',
  'auth/unauthorized-domain': "Google sign-in isn't switched on for this web address yet. Use your email and password for now.",
  'auth/account-exists-with-different-credential': 'This email is already registered another way. Sign in with your email and password.',
  'auth/user-disabled': 'This account has been disabled. Contact your community lead.',
}

// Closing the Google window on purpose isn't worth an error message.
export const isCancelled = (error) =>
  ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(error?.code)

export function authMessage(error) {
  if (MESSAGES[error?.code]) return MESSAGES[error.code]
  if (String(error?.code ?? '').startsWith('auth/')) return 'Sign-in failed, please try again'
  return error?.message ?? 'Something went wrong, please try again'
}
