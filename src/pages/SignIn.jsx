import { signInWithCustomToken, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth'
import { LockKeyhole, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import googleG from '../assets/images/google-g.png'
import { useAuth } from '../auth/AuthContext.js'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { Button } from '../components/Button.jsx'
import { FormAlert } from '../components/FormAlert.jsx'
import { RoleTabs } from '../components/RoleTabs.jsx'
import { TextField } from '../components/TextField.jsx'
import { api } from '../lib/api.js'
import { authMessage, isCancelled } from '../lib/authErrors.js'
import { auth, googleProvider, rememberSession } from '../lib/firebase.js'
import { usePageTitle } from '../lib/usePageTitle.js'
import { isEmail, isPhone } from '../lib/validation.js'
import shared from '../styles/auth.module.css'
import styles from './SignIn.module.css'

// Sign In. The tab doesn't limit who can sign in: people land on the screens for their
// real role. It's kept in ?role= so a first-time Google user arrives on Create Account
// with the same tab picked.
export default function SignIn() {
  usePageTitle('Sign In')
  const { status, error: accountError } = useAuth()
  const [params, setParams] = useSearchParams()
  const role = params.get('role') === 'admin' ? 'admin' : 'resident'

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(null) // 'password' or 'google' while signing in

  // Signed in, but the API couldn't load the account: stop the spinner and say why.
  const working = status === 'error' ? null : busy
  const shownError = formError || (status === 'error' ? accountError : '')

  const setRole = (next) => setParams(next === 'admin' ? { role: 'admin' } : {}, { replace: true })

  async function handleSubmit(event) {
    event.preventDefault()
    const value = identifier.trim()
    const found = {}
    if (!value) found.identifier = 'Enter your email or phone number'
    else if (!isEmail(value) && !isPhone(value)) found.identifier = 'Enter a valid email address or phone number'
    if (!password) found.password = 'Enter your password'
    setErrors(found)
    setFormError('')
    if (Object.keys(found).length > 0) return

    setBusy('password')
    try {
      await rememberSession(remember)
      if (isEmail(value)) {
        await signInWithEmailAndPassword(auth, value, password)
      } else {
        // Firebase only takes passwords with an email, so the API checks phone sign-ins.
        const { customToken } = await api('/auth/phone-sign-in', {
          method: 'POST',
          body: { phone: value, password },
          signedIn: false,
        })
        await signInWithCustomToken(auth, customToken)
      }
      // AuthProvider sees the new session and GuestOnly moves on to the account screen.
    } catch (error) {
      setFormError(authMessage(error))
      setBusy(null)
    }
  }

  async function handleGoogle() {
    setFormError('')
    setBusy('google')
    try {
      await rememberSession(remember)
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      if (!isCancelled(error)) setFormError(authMessage(error))
      setBusy(null)
    }
  }

  return (
    <AuthLayout>
      <h1 className={shared.title}>Welcome Back</h1>
      <p className={shared.subtitle}>Sign in to your account to continue</p>

      <form className={`${shared.form} ${styles.form}`} onSubmit={handleSubmit} noValidate>
        <RoleTabs value={role} onChange={setRole} disabled={Boolean(working)} />

        <TextField
          className={styles.firstField}
          label="Email or Phone Number"
          icon={UserRound}
          placeholder="you@example.com or 08012345678"
          autoComplete="username"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          error={errors.identifier}
        />
        <TextField
          className={styles.field}
          label="Password"
          type="password"
          icon={LockKeyhole}
          placeholder="Enter your password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />

        <div className={styles.options}>
          <label className={styles.remember}>
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            <span>Remember me</span>
          </label>
          <Link to="/forgot-password" className={styles.forgot}>
            Forgot password?
          </Link>
        </div>

        {shownError && (
          <div className={styles.alert}>
            <FormAlert>{shownError}</FormAlert>
          </div>
        )}

        <Button type="submit" arrow busy={working === 'password'} disabled={Boolean(working)} className={styles.submit}>
          Sign In
        </Button>

        <div className={styles.divider}>
          <span>OR</span>
        </div>

        <Button
          variant="outline"
          className={styles.google}
          onClick={handleGoogle}
          busy={working === 'google'}
          disabled={Boolean(working)}
        >
          {working !== 'google' && <img src={googleG} alt="" width="18" height="18" />}
          Continue with Google
        </Button>
      </form>

      <p className={shared.footer}>
        Don&apos;t have an account?
        <Link to={role === 'admin' ? '/signup?role=admin' : '/signup'} className={`${shared.link} ${shared.underlined} ${styles.createOne}`}>
          Create one
        </Link>
      </p>
    </AuthLayout>
  )
}
