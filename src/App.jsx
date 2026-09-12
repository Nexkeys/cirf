import { Navigate, Route, Routes } from 'react-router'
import { GuestOnly, SignedInOnly } from './auth/RouteGuards.jsx'
import Account from './pages/Account.jsx'
import CheckEmail from './pages/CheckEmail.jsx'
import CreateAccount from './pages/CreateAccount.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import Home from './pages/Home.jsx'
import SignIn from './pages/SignIn.jsx'
import Welcome from './pages/Welcome.jsx'

// Home -> Welcome -> Create Account / Sign In -> Account
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
