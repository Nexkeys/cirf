import { forbidden } from '../lib/httpError.js'

// Role gate for a route, used after verifyFirebaseToken.
//   requireRole()         -> any registered user (the "Resident" level in the API spec)
//   requireRole('admin')  -> community leads only
// Suspended accounts are refused everywhere.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      throw forbidden('Finish setting up your account first (POST /api/users/register)')
    }
    if (req.user.status === 'suspended') {
      throw forbidden('Your account has been suspended by your estate admin')
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      throw forbidden(`Only ${roles.join(' or ')} accounts can do this`)
    }
    next()
  }
}
