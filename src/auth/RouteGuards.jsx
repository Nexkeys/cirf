import { Navigate, useLocation } from 'react-router'
import { useAuth } from './AuthContext.js'

// Sign In, Create Account and password reset are for people who aren't in yet.
// Someone signed in with Firebase who hasn't finished Create Account (for example after
// their first Google sign-in) is sent there, keeping ?role= so the right tab stays picked.
export function GuestOnly({ children }) {
  const { status } = useAuth()
  const { pathname, search } = useLocation()

  if (status === 'ready' || status === 'suspended') return <Navigate to="/account" replace />
  if (status === 'needsProfile' && pathname !== '/signup') return <Navigate to={`/signup${search}`} replace />
  return children
}

// Screens that need a signed-in, registered person.
export function SignedInOnly({ children }) {
  const { status } = useAuth()

  if (status === 'loading') return null
  if (status === 'signedOut') return <Navigate to="/signin" replace />
  if (status === 'needsProfile') return <Navigate to="/signup" replace />
  return children
}
