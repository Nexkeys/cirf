import { useAuth } from '../../auth/AuthContext.js'
import { usePageTitle } from '../../lib/usePageTitle.js'
import EstateSettings from './EstateSettings.jsx'
import MySettings from './MySettings.jsx'

// /settings: the full Estate Settings for community leads, a profile page for residents.
// This route decides which settings screen to show depending on whether the current user is a leader or resident.
export default function Settings() {
  const { profile } = useAuth()
  const isAdmin = profile.role === 'admin'
  usePageTitle(isAdmin ? 'Estate Settings' : 'Settings')
  return isAdmin ? <EstateSettings /> : <MySettings />
}
