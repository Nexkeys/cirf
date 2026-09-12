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
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading' })
  const latestRequest = useRef(0)

  const load = useCallback(async (user) => {
    // Only the newest lookup may update the state, so a slow answer from before
    // registering can't overwrite the fresh one from after.
    const request = ++latestRequest.current
    const apply = (next) => request === latestRequest.current && setState(next)

    if (!user) return apply({ status: 'signedOut' })
    try {
      const { user: profile, estate, joinRequest } = await api('/users/me')
      apply({ status: 'ready', user, profile, estate, joinRequest })
    } catch (error) {
      if (error.code === 'NOT_REGISTERED') apply({ status: 'needsProfile', user })
      else if (error.code === 'SUSPENDED') apply({ status: 'suspended', user, error: error.message })
      else apply({ status: 'error', user, error: error.message })
    }
  }, [])

  useEffect(() => onAuthStateChanged(auth, load), [load])

  const value = useMemo(
    () => ({
      ...state,
      refresh: () => load(auth.currentUser),
      signOut: () => signOut(auth),
    }),
    [state, load],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
