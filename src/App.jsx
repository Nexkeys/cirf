import { Navigate, Route, Routes } from 'react-router'
import { GuestOnly, MemberOnly, SignedInOnly } from './auth/RouteGuards.jsx'
import Account from './pages/Account.jsx'
import CheckEmail from './pages/CheckEmail.jsx'
import ComingSoon from './pages/ComingSoon.jsx'
import CreateAccount from './pages/CreateAccount.jsx'
import Dashboard from './pages/Dashboard.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import Home from './pages/Home.jsx'
import SignIn from './pages/SignIn.jsx'
import Welcome from './pages/Welcome.jsx'

// Dashboard screens still to be built. Each gets its own page as it's designed in.
const UPCOMING = [
  ['/campaigns/*', 'Campaigns'],
  ['/contributions', 'Contributions'],
  ['/vendors', 'Vendors & Quotes'],
  ['/reconciliation', 'Reconciliation'],
  ['/reports', 'Transparency Report'],
  ['/notifications', 'Notifications'],
  ['/settings', 'Settings'],
]

// Home -> Welcome -> Create Account / Sign In -> Overview
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/signin" element={<GuestOnly><SignIn /></GuestOnly>} />
      <Route path="/signup" element={<GuestOnly><CreateAccount /></GuestOnly>} />
      <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
      <Route path="/forgot-password/sent" element={<GuestOnly><CheckEmail /></GuestOnly>} />
      <Route path="/account" element={<SignedInOnly><Account /></SignedInOnly>} />
      <Route path="/dashboard" element={<MemberOnly><Dashboard /></MemberOnly>} />
      {UPCOMING.map(([path, title]) => (
        <Route key={path} path={path} element={<MemberOnly><ComingSoon title={title} /></MemberOnly>} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
