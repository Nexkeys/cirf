import { useAuth } from '../../auth/AuthContext.js'
import { usePageTitle } from '../../lib/usePageTitle.js'
import EstateSettings from './EstateSettings.jsx'
import MySettings from './MySettings.jsx'

// /settings: the full Estate Settings for community leads, a profile page for residents.
export default function Settings() {
  const { profile } = useAuth()
  const isAdmin = profile.role === 'admin'
  usePageTitle(isAdmin ? 'Estate Settings' : 'Settings')
  return isAdmin ? <EstateSettings /> : <MySettings />
}
