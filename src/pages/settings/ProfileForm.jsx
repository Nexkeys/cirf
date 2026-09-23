import { CircleCheck, Hash, House, Mail, Phone, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext.js'
import { Button } from '../../components/Button.jsx'
import { FormField } from '../../components/dashboard/FormField.jsx'
import { FormAlert } from '../../components/FormAlert.jsx'
import { useToast } from '../../components/ToastContext.js'
import { api } from '../../lib/api.js'
import shared from '../campaigns/campaigns.module.css'
import styles from './settings.module.css'

const localPhone = (phone) => (phone ? phone.replace(/^\+234/, '0') : '')

// Your own name, phone and unit (PUT /api/users/me). Residents' unit details are set by
// their community lead, so they only see them; leads can change their own. `onSaved`
// runs after a successful save (a dialog closes itself, say).
export function ProfileForm({ onSaved, onCancel }) {
  const { profile, refresh } = useAuth()
  const toast = useToast()
  const isAdmin = profile.role === 'admin'
  const [form, setForm] = useState({
    name: profile.name,
    phone: localPhone(profile.phone),
    unitNumber: profile.unitNumber ?? '',
    units: String(profile.units ?? 1),
  })
  const [errors, setErrors] = useState({})
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const set = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
    setSaved(false)
  }

  async function submit(event) {
    event.preventDefault()
    const found = {}
    if (form.name.trim().length < 2) found.name = 'Enter your full name'
    const units = Number(form.units)
    if (isAdmin && (!Number.isInteger(units) || units < 1 || units > 1000)) found.units = 'Enter a whole number from 1 to 1,000'
    setErrors(found)
    setProblem('')
    if (Object.keys(found).length) return

    setBusy(true)
    try {
      await api('/users/me', {
        method: 'PUT',
        body: {
          name: form.name.trim(),
          ...(form.phone.trim() && { phone: form.phone.trim() }),
          ...(isAdmin && { unitNumber: form.unitNumber.trim() || null, units }),
        },
      })
      await refresh()
      setSaved(true)
      toast.success('Your profile has been updated')
      onSaved?.()
    } catch (error) {
      const fieldErrors = {}
      for (const field of ['name', 'phone', 'unitNumber', 'units']) {
        const message = error.fieldMessage?.(field)
        if (message) fieldErrors[field] = message
      }
      setErrors(fieldErrors)
      if (!Object.keys(fieldErrors).length) setProblem(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className={styles.dialogForm}>
      <FormField label="Full Name" required icon={UserRound} value={form.name} onChange={set('name')} error={errors.name} autoComplete="name" />
      <FormField
        label="Phone Number"
        icon={Phone}
        type="tel"
        value={form.phone}
        onChange={set('phone')}
        error={errors.phone}
        hint="You can also sign in with it."
        autoComplete="tel"
      />
      <FormField label="Email Address" icon={Mail} value={profile.email} readOnly hint="Your sign-in email can't be changed here." />
      <div className={styles.twoFields}>
        {isAdmin ? (
          <>
            <FormField label="Your Unit" icon={House} placeholder="e.g. A12" value={form.unitNumber} onChange={set('unitNumber')} error={errors.unitNumber} optional />
            <FormField label="Units Held" icon={Hash} type="number" min="1" value={form.units} onChange={set('units')} error={errors.units} hint="Sets your share of a per-unit levy" />
          </>
        ) : (
          <>
            <FormField label="Unit" icon={House} value={profile.unitNumber ?? 'Not set'} readOnly />
            <FormField label="Units" value={String(profile.units ?? 1)} readOnly hint="Set by your community lead" />
          </>
        )}
      </div>
      {problem && <FormAlert>{problem}</FormAlert>}
      <div className={styles.saveRow}>
        {saved && !onSaved && (
          <span className={styles.savedNote} role="status">
            <CircleCheck size={17} aria-hidden="true" /> Saved
          </span>
        )}
        {onCancel && (
          <button type="button" className={shared.secondary} onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
        <Button type="submit" busy={busy} className={styles.saveButton}>
          {busy ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
