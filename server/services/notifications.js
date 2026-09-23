import { FieldValue } from 'firebase-admin/firestore'
import { collections } from './collections.js'
import { db } from './firebaseAdmin.js'

// In-app notifications, stored in the notifications collection and read through
// GET /api/users/me/notifications.

const BATCH_LIMIT = 500 // Firestore's maximum writes per batch

// Which switch on the Notifications screen each type falls under. Types not listed
// here (join requests, approvals, ownership changes) are about someone's account
// itself, so they always go out.
export const NOTIFICATION_CATEGORIES = {
  campaign_published: 'campaigns',
  target_reached: 'campaigns',
  contribution_recorded: 'contributions',
  contribution_verified: 'contributions',
  contribution_rejected: 'contributions',
  vendor_selected: 'repairs',
  repair_completed: 'repairs',
  payment_reminder: 'reminders',
  campaign_reconciled: 'reports',
}

export const PREFERENCE_KEYS = ['campaigns', 'contributions', 'repairs', 'reminders', 'reports']

// Everything is on until someone switches it off.
export const notificationPrefs = (user) =>
  Object.fromEntries(PREFERENCE_KEYS.map((key) => [key, user?.notificationPrefs?.[key] !== false]))

export const categoryOf = (type) => NOTIFICATION_CATEGORIES[type] ?? 'account'

// Drops the items whose person has switched that kind of update off.
async function wanted(items) {
  const ids = [...new Set(items.filter((item) => NOTIFICATION_CATEGORIES[item.type]).map((item) => item.userId))]
  if (ids.length === 0) return items
  const snapshots = await db.getAll(...ids.map((id) => collections.users.doc(id)))
  const prefs = new Map(snapshots.map((snap) => [snap.id, notificationPrefs(snap.data())]))
  return items.filter((item) => {
    const category = NOTIFICATION_CATEGORIES[item.type]
    return !category || prefs.get(item.userId)?.[category] !== false
  })
}

// items: [{ userId, type, campaignId, title, message }]
//
// Called after the main change has already been saved. A failed notification must not
// turn a successful contribution or reconciliation into an error for the user, so this
// logs failures instead of throwing.
export async function notify(items) {
  try {
    const sending = await wanted(items)
    for (let start = 0; start < sending.length; start += BATCH_LIMIT) {
      const batch = db.batch()
      for (const { userId, type, campaignId = null, title, message } of sending.slice(start, start + BATCH_LIMIT)) {
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
