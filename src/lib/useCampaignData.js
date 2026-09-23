import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { useVisibleInterval } from './useVisibleInterval.js'

const POLL_MS = 15_000

// One campaign and what its screens show about it: the overview figures, its
// contributions (newest first) and, with `withQuotes`, its vendor quotes. Checks
// /progress every 15 seconds while the tab is visible and reloads only on a change.
// Returns { status: 'loading' | 'ready' | 'error', campaign, overview, contributions,
// quotes, message, reload }.
export function useCampaignData(campaignId, { withQuotes = false } = {}) {
  const [state, setState] = useState({ status: 'loading' })
  const [reloads, setReloads] = useState(0)
  const lastChange = useRef(null)
  const reload = () => setReloads((count) => count + 1)

  useEffect(() => {
    let current = true
    Promise.all([
      api(`/campaigns/${campaignId}`),
      api(`/campaigns/${campaignId}/overview`),
      api(`/campaigns/${campaignId}/contributions`),
      withQuotes ? api(`/campaigns/${campaignId}/vendor-quotes`) : null,
    ])
      .then(([{ campaign }, { overview }, { contributions }, quotes]) => {
        if (!current) return
        lastChange.current = campaign.updatedAt
        setState({ status: 'ready', campaign, overview, contributions, quotes: quotes?.quotes ?? [] })
      })
      .catch((error) => {
        if (current) setState((shown) => (shown.status === 'ready' ? shown : { status: 'error', message: error.message }))
      })
    return () => {
      current = false
    }
  }, [campaignId, withQuotes, reloads])

  useVisibleInterval(
    async () => {
      const { progress } = await api(`/campaigns/${campaignId}/progress`).catch(() => ({}))
      if (progress && progress.updatedAt !== lastChange.current) reload()
    },
    POLL_MS,
    state.status === 'ready',
  )

  return { ...state, reload }
}
