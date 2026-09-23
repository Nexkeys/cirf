import { HandCoins } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/AuthContext.js'
import { AppShell } from '../../components/dashboard/AppShell.jsx'
import { PageHeading } from '../../components/dashboard/PageHeading.jsx'
import { FormAlert } from '../../components/FormAlert.jsx'
import { LoadingNote } from '../../components/Loading.jsx'
import { api } from '../../lib/api.js'
import { pickFeatured } from '../../lib/campaigns.js'
import shared from './campaigns.module.css'
import styles from './CampaignsList.module.css'

// The sidebar's Contributions, Vendors & Quotes, Reconciliation and Transparency Report
// links. Each belongs to one campaign, so this opens that section of ?campaign=<id>, or
// of the featured campaign (the one the Overview shows).
export default function CampaignSection({ section, title }) {
  const [params] = useSearchParams()
  const chosen = params.get('campaign')
  const { profile } = useAuth()
  const [state, setState] = useState({ status: chosen ? 'ready' : 'loading', id: chosen })

  useEffect(() => {
    if (chosen) return undefined
    let current = true
    api('/campaigns')
      .then(({ campaigns }) => current && setState({ status: 'ready', id: pickFeatured(campaigns)?.id ?? null }))
      .catch((error) => current && setState({ status: 'error', message: error.message }))
    return () => {
      current = false
    }
  }, [chosen])

  if (state.status === 'ready' && state.id) return <Navigate to={`/campaigns/${state.id}/${section}`} replace />

  return (
    <AppShell heading={<PageHeading title={title} />}>
      {state.status === 'loading' && <LoadingNote>Please wait, opening {title}…</LoadingNote>}
      {state.status === 'error' && <FormAlert>{state.message}</FormAlert>}
      {state.status === 'ready' && (
        <section className={`${shared.card} ${styles.empty}`}>
          <HandCoins aria-hidden="true" />
          <h2>No campaigns yet</h2>
          <p>{title} belongs to a repair campaign. It will be here as soon as your estate has one.</p>
          {profile.role === 'admin' && (
            <Link to="/campaigns/new" className={styles.create}>
              Create Campaign
            </Link>
          )}
        </section>
      )}
    </AppShell>
  )
}
