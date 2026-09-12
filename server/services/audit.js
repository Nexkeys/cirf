import { FieldValue } from 'firebase-admin/firestore'
import { db } from './firebaseAdmin.js'

// Append-only audit trail for each campaign, stored at campaigns/{id}/events.
// Every state change writes one event, and the transparency report replays them as
// the campaign's timeline. No route updates or deletes an event.

export const eventsOf = (campaignId) =>
  db.collection('campaigns').doc(campaignId).collection('events')

// Queues the event on the same batch or transaction as the change it describes, so the
// change and its audit record are saved together or not at all.
export function recordEvent(writer, campaignId, { type, actor, message, data = {} }) {
  writer.set(eventsOf(campaignId).doc(), {
    type,
    message,
    data,
    actorId: actor?.id ?? null,
    actorName: actor?.name ?? null,
    createdAt: FieldValue.serverTimestamp(),
  })
}
