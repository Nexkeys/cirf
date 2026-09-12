import { sendPasswordResetEmail } from 'firebase/auth'
import { Mail } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { Button } from '../components/Button.jsx'
import { StatusIcon } from '../components/StatusIcon.jsx'
import { authMessage } from '../lib/authErrors.js'
import { auth } from '../lib/firebase.js'
import { usePageTitle } from '../lib/usePageTitle.js'
import shared from '../styles/auth.module.css'
import s from '../styles/status.module.css'

// Check Your Email, shown after Reset Your Password sends the link.
export default function CheckEmail() {
  usePageTitle('Check Your Email')
  const { state } = useLocation()
  const [resend, setResend] = useState({ status: 'idle', message: '' })
  const email = state?.email

  // Opened directly, without coming from Reset Your Password.
  if (!email) return <Navigate to="/forgot-password" replace />

  async function handleResend() {
    setResend({ status: 'sending', message: '' })
    try {
      await sendPasswordResetEmail(auth, email)
      setResend({ status: 'sent', message: 'We sent the link again.' })
    } catch (error) {
      if (error.code === 'auth/user-not-found') setResend({ status: 'sent', message: 'We sent the link again.' })
      else setResend({ status: 'failed', message: authMessage(error) })
    }
  }

  return (
    <AuthLayout header="logo" className={s.page}>
      <div className={s.center}>
        <StatusIcon icon={Mail} />
        <h1 className={s.title}>Check Your Email</h1>
        <p className={s.text}>
          We&apos;ve sent a password reset link to
          <strong className={s.email}>{email}</strong>
        </p>
        <p className={s.note}>If you don&apos;t see it, check your spam folder.</p>

        <Button to="/signin" className={s.action}>
          Back to Sign In
        </Button>

        <p className={s.footer}>
          Didn&apos;t receive the email?
          <button
            type="button"
            className={`${shared.link} ${shared.underlined}`}
            onClick={handleResend}
            disabled={resend.status === 'sending'}
          >
            {resend.status === 'sending' ? 'Sending…' : 'Resend'}
          </button>
        </p>
        <p className={s.feedback} role="status">
          {resend.message}
        </p>
      </div>
    </AuthLayout>
  )
}
