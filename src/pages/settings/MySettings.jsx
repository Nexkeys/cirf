import { LogOut, MapPin, UserRound } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext.js'
import { AppShell } from '../../components/dashboard/AppShell.jsx'
import { PageHeading } from '../../components/dashboard/PageHeading.jsx'
import { Photo } from '../../components/Photo.jsx'
import { sizedPhoto } from '../../lib/images.js'
import shared from '../campaigns/campaigns.module.css'
import { ProfileForm } from './ProfileForm.jsx'
import styles from './settings.module.css'

// Settings for residents: their own name and phone, and their estate's details.
export default function MySettings() {
  const { estate, signOut } = useAuth()

  return (
    <AppShell heading={<PageHeading back={{ to: '/dashboard', label: 'Back to Dashboard' }} title="Settings" subtitle="Your profile and your estate." />}>
      <div className={styles.residentLayout}>
        <section className={shared.card} aria-labelledby="profile-title">
          <h2 id="profile-title" className={`${shared.cardTitle} ${styles.sideTitle}`}>
            <UserRound aria-hidden="true" /> My Profile
          </h2>
          <ProfileForm />
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
