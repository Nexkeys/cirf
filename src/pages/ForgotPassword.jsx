import { sendPasswordResetEmail } from 'firebase/auth'
import { Mail } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { Button } from '../components/Button.jsx'
import { FormAlert } from '../components/FormAlert.jsx'
import { TextField } from '../components/TextField.jsx'
import { authMessage } from '../lib/authErrors.js'
import { auth } from '../lib/firebase.js'
import { usePageTitle } from '../lib/usePageTitle.js'
import { isEmail } from '../lib/validation.js'
import shared from '../styles/auth.module.css'
import styles from './ForgotPassword.module.css'

// Reset Your Password. Firebase emails the reset link and hosts the page where the new
// password is chosen.
export default function ForgotPassword() {
  usePageTitle('Reset Password')
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const value = email.trim()
    setFormError('')
    if (!isEmail(value)) return setError('Enter a valid email address')
    setError('')

    setBusy(true)
    try {
      await sendPasswordResetEmail(auth, value)
      navigate('/forgot-password/sent', { state: { email: value } })
    } catch (err) {
      // Never reveal whether an email has an account: treat "no such user" as sent.
      if (err.code === 'auth/user-not-found') return navigate('/forgot-password/sent', { state: { email: value } })
      if (err.code === 'auth/invalid-email') setError(authMessage(err))
      else setFormError(authMessage(err))
      setBusy(false)
    }
  }

  return (
    <AuthLayout header="back" backTo="/signin" className={styles.page}>
      <h1 className={shared.title}>Reset Your Password</h1>
      <p className={shared.subtitle}>
        Enter your email address and we&apos;ll send you instructions to reset your password.
      </p>

      <form className={`${shared.form} ${styles.form}`} onSubmit={handleSubmit} noValidate>
        <TextField
          label="Email Address"
          type="email"
          icon={Mail}
          placeholder="you@example.com"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={error}
        />

        {formError && (
          <div className={styles.alert}>
            <FormAlert>{formError}</FormAlert>
          </div>
        )}

        <Button type="submit" arrow busy={busy} className={styles.submit}>
          Send Reset Link
        </Button>
      </form>

      <p className={`${shared.footer} ${styles.footer}`}>
        Remember your password?
        <Link to="/signin" className={shared.link}>
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
