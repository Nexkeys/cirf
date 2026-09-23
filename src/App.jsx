import { Navigate, Route, Routes } from 'react-router'
import { GuestOnly, MemberOnly, SignedInOnly } from './auth/RouteGuards.jsx'
import About from './pages/About.jsx'
import Account from './pages/Account.jsx'
import CampaignDetails from './pages/campaigns/CampaignDetails.jsx'
import CampaignsList from './pages/campaigns/CampaignsList.jsx'
import Contribute from './pages/campaigns/Contribute.jsx'
import CreateCampaign from './pages/campaigns/CreateCampaign.jsx'
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
  ['/campaigns/:id/contributors', 'Contributors'],
  ['/contributions', 'Contributions'],
  ['/vendors', 'Vendors & Quotes'],
  ['/reconciliation', 'Reconciliation'],
  ['/reports', 'Transparency Report'],
  ['/notifications', 'Notifications'],
  ['/settings', 'Settings'],
]

// Home (and About) -> Welcome -> Create Account / Sign In -> Overview
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/signin" element={<GuestOnly><SignIn /></GuestOnly>} />
      <Route path="/signup" element={<GuestOnly><CreateAccount /></GuestOnly>} />
      <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
      <Route path="/forgot-password/sent" element={<GuestOnly><CheckEmail /></GuestOnly>} />
      <Route path="/account" element={<SignedInOnly><Account /></SignedInOnly>} />
      <Route path="/dashboard" element={<MemberOnly><Dashboard /></MemberOnly>} />
      <Route path="/campaigns" element={<MemberOnly><CampaignsList /></MemberOnly>} />
      <Route path="/campaigns/new" element={<MemberOnly><CreateCampaign /></MemberOnly>} />
      <Route path="/campaigns/:id" element={<MemberOnly><CampaignDetails /></MemberOnly>} />
      <Route path="/campaigns/:id/edit" element={<MemberOnly><CreateCampaign /></MemberOnly>} />
      <Route path="/campaigns/:id/contribute" element={<MemberOnly><Contribute /></MemberOnly>} />
      {UPCOMING.map(([path, title]) => (
        <Route key={path} path={path} element={<MemberOnly><ComingSoon title={title} /></MemberOnly>} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
