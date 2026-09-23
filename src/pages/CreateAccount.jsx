import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { LockKeyhole, Mail, MapPin, Phone, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../auth/AuthContext.js'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { Button } from '../components/Button.jsx'
import { EstatePicker } from '../components/EstatePicker.jsx'
import { FormAlert } from '../components/FormAlert.jsx'
import { RoleTabs } from '../components/RoleTabs.jsx'
import { TextField } from '../components/TextField.jsx'
import { api } from '../lib/api.js'
import { authMessage } from '../lib/authErrors.js'
import { auth, rememberSession } from '../lib/firebase.js'
import { usePageTitle } from '../lib/usePageTitle.js'
import { isEmail, isPhone, MIN_PASSWORD_LENGTH } from '../lib/validation.js'
import shared from '../styles/auth.module.css'
import styles from './CreateAccount.module.css'

// Makes the Firebase login for a new account. If an earlier attempt already made it but
// stopped before the profile was saved (the API was unreachable, say), the same email and
// password sign back in to it and registering carries on. Returns true in that case.
async function createLogin(email, password, name) {
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password)
    updateProfile(user, { displayName: name }).catch(() => {})
    return false
  } catch (error) {
    if (error.code !== 'auth/email-already-in-use') throw error
    // A wrong password means it really is someone else's account: report the original error.
    await signInWithEmailAndPassword(auth, email, password).catch(() => {
      throw error
    })
    return true
  }
}

// Which API field each form field's errors come back under.
const API_FIELDS = { name: 'name', phone: 'phone', estateId: 'estate', estateName: 'estate' }

// Create Account. Two steps behind one form:
//   1. Firebase Auth account (email + password)
//   2. CIRF profile (POST /api/users/register): name, phone, role and estate
// Someone already signed in with Firebase but without a profile (first Google sign-in, or
// step 2 failed last time) sees the same form without the email and password fields.
export default function CreateAccount() {
  usePageTitle('Create Account')
  const { status, user, error: accountError, refresh, signOut } = useAuth()
  const [params, setParams] = useSearchParams()
  const role = params.get('role') === 'admin' ? 'admin' : 'resident'

  const [name, setName] = useState(null) // null until typed, so a Google name can fill it
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [estate, setEstate] = useState(null) // residents: the estate picked from the list
  const [estateText, setEstateText] = useState('') // residents: what they typed; leads: the new estate's name
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  // While step 1 finishes, Firebase already counts as signed in. Don't swap the form mid-submit.
  const completing = status === 'needsProfile' && !busy
  const working = status === 'error' ? false : busy
  const shownError = formError || (status === 'error' ? accountError : '')
  const fullName = name ?? user?.displayName ?? ''

  const setRole = (next) => {
    setParams(next === 'admin' ? { role: 'admin' } : {}, { replace: true })
    setErrors((current) => ({ ...current, estate: undefined }))
  }

  function validate() {
    const found = {}
    if (fullName.trim().length < 2) found.name = 'Enter your full name'
    if (!completing && !isEmail(email)) found.email = 'Enter a valid email address'
    if (!isPhone(phone)) found.phone = 'Enter a valid phone number, e.g. 08012345678'
    if (role === 'admin' && estateText.trim().length < 2) found.estate = 'Enter your estate or community name'
    // Left empty is allowed: an admin may have invited this email, and the API checks that.
    if (role === 'resident' && estateText.trim() && !estate) found.estate = 'Choose your estate from the list'
    if (!completing && password.length < MIN_PASSWORD_LENGTH) found.password = `Use at least ${MIN_PASSWORD_LENGTH} characters`
    return found
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const found = validate()
    setErrors(found)
    setFormError('')
    if (Object.keys(found).length > 0) return

    setBusy(true)
    try {
      if (!completing) {
        await rememberSession(true)
        const resumed = await createLogin(email.trim(), password, fullName.trim())
        // Signed back in to an account that turns out to be fully set up: just go in.
        if (resumed && (await api('/users/me').then(() => true, () => false))) return await refresh()
      }

      await api('/users/register', {
        method: 'POST',
        body: {
          name: fullName.trim(),
          phone: phone.trim(),
          role,
          ...(role === 'admin' && { estateName: estateText.trim() }),
          ...(role === 'resident' && estate && { estateId: estate.id }),
        },
      })
      // Loading the new profile makes GuestOnly move on to the account screen.
      await refresh()
    } catch (error) {
      const fieldErrors = {}
      for (const [apiField, formField] of Object.entries(API_FIELDS)) {
        const message = error.fieldMessage?.(apiField)
        if (message) fieldErrors[formField] = message
      }
      if (error.code === 'auth/email-already-in-use' || error.code === 'auth/invalid-email') {
        fieldErrors.email = authMessage(error)
      }
      if (error.code === 'auth/weak-password') fieldErrors.password = authMessage(error)

      setErrors(fieldErrors)
      if (Object.keys(fieldErrors).length === 0) setFormError(authMessage(error))
      setBusy(false)
    }
  }

  return (
    <AuthLayout>
      <h1 className={shared.title}>Create Your Account</h1>
      <p className={shared.subtitle}>
        {completing
          ? 'Just a few details left to finish setting up your account.'
          : 'Join your community in building a more transparent and reliable system.'}
      </p>

      <form className={`${shared.form} ${styles.form}`} onSubmit={handleSubmit} noValidate>
        <RoleTabs value={role} onChange={setRole} disabled={working} />

        <TextField
          className={styles.firstField}
          label="Full Name"
          icon={UserRound}
          placeholder="John Doe"
          autoComplete="name"
          value={fullName}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
        />
        <TextField
          className={styles.field}
          label="Email Address"
          type="email"
          icon={Mail}
          placeholder="you@example.com"
          autoComplete="email"
          value={completing ? (user?.email ?? '') : email}
          onChange={(event) => setEmail(event.target.value)}
          readOnly={completing}
          error={errors.email}
        />
        <TextField
          className={styles.field}
          label="Phone Number"
          type="tel"
          icon={Phone}
          placeholder="08012345678"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          error={errors.phone}
        />

        <div className={styles.field}>
          {role === 'resident' ? (
            <EstatePicker
              selected={estate}
              onSelect={setEstate}
              onQueryChange={setEstateText}
              error={errors.estate}
              disabled={working}
            />
          ) : (
            <TextField
              label="Community / Estate"
              icon={MapPin}
              placeholder="e.g. Maple Estate, Alagbado"
              autoComplete="off"
              value={estateText}
              onChange={(event) => setEstateText(event.target.value)}
              error={errors.estate}
            />
          )}
        </div>

        {!completing && (
          <TextField
            className={styles.field}
            label="Password"
            type="password"
            icon={LockKeyhole}
            placeholder="Create a strong password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
          />
        )}

        {shownError && (
          <div className={styles.alert}>
            <FormAlert>{shownError}</FormAlert>
          </div>
        )}

        <Button type="submit" arrow busy={working} className={styles.submit}>
          Create Account
        </Button>
      </form>

      {completing ? (
        <p className={`${shared.footer} ${styles.footer}`}>
          Signed in as {user?.email}.
          <button type="button" className={shared.link} onClick={signOut}>
            Use a different account
          </button>
        </p>
      ) : (
        <p className={`${shared.footer} ${styles.footer}`}>
          Already have an account?
          <Link to={role === 'admin' ? '/signin?role=admin' : '/signin'} className={shared.link}>
            Sign in
          </Link>
        </p>
      )}
    </AuthLayout>
  )
}
