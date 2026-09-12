import { forbidden } from './httpError.js'

// Everything in CIRF belongs to an estate, and people may only see or change their own
// estate's data. Routes call this after loading a document from Firestore.
export function assertSameEstate(user, estateId) {
  if (!user.estateId || user.estateId !== estateId) {
    throw forbidden('That belongs to an estate you are not a member of')
  }
}

export const isAdmin = (user) => user?.role === 'admin'
