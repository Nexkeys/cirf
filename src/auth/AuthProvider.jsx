import { onAuthStateChanged, signOut } from 'firebase/auth'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { auth } from '../lib/firebase.js'
import { AuthContext } from './AuthContext.js'

// Keeps track of the signed-in person for the whole app. `status` is one of:
//   loading       Firebase is still restoring the session
//   signedOut     nobody is signed in
//   needsProfile  signed in with Firebase but Create Account isn't finished (e.g. first Google sign-in)
//   suspended     their estate admin suspended the account
//   ready         profile loaded; `estate` or `joinRequest` says which estate they're in or waiting for
//   error         the API couldn't be reached
//
// Sign In has a Resident / Community Lead tab. It calls expectRole() before signing in,
// and an account of the other kind is signed straight back out, with `notice` saying
// which tab to use. The server checks the role on every request regardless; this keeps
// people from landing in the wrong kind of account by mistake.
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading' })
  const [notice, setNotice] = useState(null)
  const latestRequest = useRef(0)
  const expectedRole = useRef(null)

  const load = useCallback(async (user) => {
    // Only the newest lookup may update the state, so a slow answer from before
    // registering can't overwrite the fresh one from after.
    const request = ++latestRequest.current
    const apply = (next) => request === latestRequest.current && setState(next)

    if (!user) return apply({ status: 'signedOut' })
    try {
      const { user: profile, estate, joinRequest } = await api('/users/me')
      const expected = expectedRole.current
      expectedRole.current = null
      if (expected && profile.role !== expected) {
        setNotice({ code: 'WRONG_ROLE', role: profile.role })
        // Signing out runs load(null), which shows Sign In again with the notice.
        return await signOut(auth)
      }
      apply({ status: 'ready', user, profile, estate, joinRequest })
    } catch (error) {
      expectedRole.current = null
      if (error.code === 'NOT_REGISTERED') apply({ status: 'needsProfile', user })
      else if (error.code === 'SUSPENDED') apply({ status: 'suspended', user, error: error.message })
      else apply({ status: 'error', user, error: error.message })
    }
  }, [])

  useEffect(() => onAuthStateChanged(auth, load), [load])

  // Sign In: only let `role` ('admin' or 'resident') through on the next sign-in.
  // null clears it (a failed attempt, or leaving the page). Stable, so pages can call it
  // from effect cleanups.
  const expectRole = useCallback((role) => {
    expectedRole.current = role
    setNotice(null)
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      notice,
      refresh: () => load(auth.currentUser),
      signOut: () => signOut(auth),
      expectRole,
    }),
    [state, notice, load, expectRole],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
