import { FieldValue } from 'firebase-admin/firestore'
import { collections } from './collections.js'
import { db } from './firebaseAdmin.js'

// In-app notifications, stored in the notifications collection and read through
// GET /api/users/me/notifications.

const BATCH_LIMIT = 500 // Firestore's maximum writes per batch

// items: [{ userId, type, campaignId, title, message }]
//
// Called after the main change has already been saved. A failed notification must not
// turn a successful contribution or reconciliation into an error for the user, so this
// logs failures instead of throwing.
export async function notify(items) {
  try {
    for (let start = 0; start < items.length; start += BATCH_LIMIT) {
      const batch = db.batch()
      for (const { userId, type, campaignId = null, title, message } of items.slice(start, start + BATCH_LIMIT)) {
        batch.set(collections.notifications.doc(), {
          userId,
          type,
          campaignId,
          title,
          message,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        })
      }
      await batch.commit()
    }
  } catch (err) {
    console.error('Failed to save notifications', err)
  }
}

// The same notification for several people, skipping duplicates.
export const toEach = (userIds, fields) =>
  [...new Set(userIds)].map((userId) => ({ ...fields, userId }))
