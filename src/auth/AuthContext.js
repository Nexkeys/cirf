import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

// Who is signed in and where they stand. See AuthProvider.jsx for the possible statuses.
export const useAuth = () => useContext(AuthContext)
