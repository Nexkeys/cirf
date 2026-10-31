import { createContext, useContext } from 'react'

// This context exposes authentication state to the rest of the app.
// Components can grab the current user, role, estate membership, and loading status
// without passing props manually through many layers.
export const AuthContext = createContext(null)

// Who is signed in and where they stand. See AuthProvider.jsx for the possible statuses.
export const useAuth = () => useContext(AuthContext)
