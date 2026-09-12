import { assertSameEstate, isAdmin } from '../lib/access.js'
import { docToJson } from '../lib/firestore.js'
import { conflict, notFound } from '../lib/httpError.js'
import { collections } from './collections.js'

export const CAMPAIGN_CATEGORIES = ['transformer', 'pole', 'cable', 'borehole', 'other']

// The lifecycle, in order. Each step is moved forward by one admin action:
//   draft -> fundraising   POST /campaigns/:id/publish
//   fundraising -> repairing   PUT /vendor-quotes/:id/select
//   repairing -> completed   POST /campaigns/:id/complete
//   completed -> reconciled   POST /campaigns/:id/reconcile
export const CAMPAIGN_STATUSES = ['draft', 'fundraising', 'repairing', 'completed', 'reconciled']

// Residents can still pay while the repair is underway, but not after it is complete.
export const ACCEPTS_CONTRIBUTIONS = ['fundraising', 'repairing']

// Loads a campaign the viewer is allowed to see. Drafts are invisible to residents,
// so for them a draft is reported as not found rather than forbidden.
export async function loadCampaignFor(viewer, campaignId) {
  const snapshot = await collections.campaigns.doc(campaignId).get()
  if (!snapshot.exists) throw notFound('Campaign not found')

  const campaign = docToJson(snapshot)
  assertSameEstate(viewer, campaign.estateId)
  if (campaign.status === 'draft' && !isAdmin(viewer)) throw notFound('Campaign not found')
  return campaign
}

export function assertStatus(campaign, allowedStatuses, action) {
  if (!allowedStatuses.includes(campaign.status)) {
    throw conflict(`You can't ${action} while the campaign is ${campaign.status}`)
  }
}

// Adds the derived progress figure the dashboards show.
export function campaignJson(campaign) {
  const percentFunded = campaign.targetAmount
    ? Math.round((campaign.totalCollected / campaign.targetAmount) * 1000) / 10
    : 0
  return { ...campaign, percentFunded }
}
