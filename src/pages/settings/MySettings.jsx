import { CircleCheck, House, LogOut, Mail, MapPin, Phone, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext.js'
import { Button } from '../../components/Button.jsx'
import { AppShell } from '../../components/dashboard/AppShell.jsx'
import { FormField } from '../../components/dashboard/FormField.jsx'
import { PageHeading } from '../../components/dashboard/PageHeading.jsx'
import { FormAlert } from '../../components/FormAlert.jsx'
import { Photo } from '../../components/Photo.jsx'
import { api } from '../../lib/api.js'
import { sizedPhoto } from '../../lib/images.js'
import shared from '../campaigns/campaigns.module.css'
import styles from './settings.module.css'

// Settings for residents: their own name and phone, and their estate's details.
export default function MySettings() {
  const { profile, estate, refresh, signOut } = useAuth()
  const [name, setName] = useState(profile.name)
  const [phone, setPhone] = useState(profile.phone ? profile.phone.replace(/^\+234/, '0') : '')
  const [errors, setErrors] = useState({})
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    setProblem('')
    setSaved(false)
    try {
      await api('/users/me', { method: 'PUT', body: { name: name.trim(), ...(phone.trim() && { phone: phone.trim() }) } })
      await refresh()
      setSaved(true)
    } catch (error) {
      const found = {}
      for (const field of ['name', 'phone']) {
        const message = error.fieldMessage?.(field)
        if (message) found[field] = message
      }
      setErrors(found)
      if (!Object.keys(found).length) setProblem(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell heading={<PageHeading back={{ to: '/dashboard', label: 'Back to Dashboard' }} title="Settings" subtitle="Your profile and your estate." />}>
      <div className={styles.residentLayout}>
        <section className={shared.card} aria-labelledby="profile-title">
          <h2 id="profile-title" className={`${shared.cardTitle} ${styles.sideTitle}`}>
            <UserRound aria-hidden="true" /> My Profile
          </h2>
          <form onSubmit={submit} noValidate className={styles.dialogForm}>
            <FormField label="Full Name" required icon={UserRound} value={name} onChange={(event) => setName(event.target.value)} error={errors.name} />
            <FormField label="Phone Number" icon={Phone} type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} error={errors.phone} hint="You can also sign in with it." />
            <FormField label="Email Address" icon={Mail} value={profile.email} readOnly hint="Your sign-in email can’t be changed here." />
            <div className={styles.twoFields}>
              <FormField label="Unit" icon={House} value={profile.unitNumber ?? 'Not set'} readOnly />
              <FormField label="Units" value={String(profile.units ?? 1)} readOnly hint="Set by your community lead" />
            </div>
            {problem && <FormAlert>{problem}</FormAlert>}
            <div className={styles.saveRow}>
              {saved && (
                <span className={styles.savedNote} role="status">
                  <CircleCheck size={17} aria-hidden="true" /> Saved
                </span>
              )}
              <Button type="submit" busy={busy} className={styles.saveButton}>
                Save Changes
              </Button>
            </div>
          </form>
        </section>

        <div className={styles.residentSide}>
          <section className={`${shared.card} ${styles.estateCard}`} aria-labelledby="my-estate-title">
            <div className={styles.estatePhoto}>
              {estate.imageUrl ? <img src={sizedPhoto(estate.imageUrl, 700)} alt="" /> : <Photo name="evening-street" sizes="(min-width: 900px) 40vw, 100vw" />}
            </div>
            <h2 id="my-estate-title" className={shared.cardTitle}>
              {estate.name}
            </h2>
            <p className={styles.estatePlace}>
              <MapPin size={16} aria-hidden="true" /> {estate.address || 'Address not added yet'}
            </p>
            <p className={shared.cardText}>
              {estate.totalHouseholds ? `${estate.totalHouseholds} households` : 'Household count not set yet'}. Your community lead manages the estate’s
              settings and residents.
            </p>
          </section>
          <button type="button" className={`${shared.secondary} ${styles.signOut}`} onClick={signOut}>
            <LogOut size={17} aria-hidden="true" /> Log Out
          </button>
        </div>
      </div>
    </AppShell>
  )
}
