import { Router } from 'express'
import { docToJson, newestFirst } from '../lib/firestore.js'
import { notFound } from '../lib/httpError.js'
import { registered } from '../middleware/guards.js'
import { collections } from '../services/collections.js'
import { db } from '../services/firebaseAdmin.js'
import { categoryOf } from '../services/notifications.js'

const router = Router()

const LIST_LIMIT = 200

// GET /api/users/me/notifications
// Newest first, each with its category (the filter tabs on the Notifications screen)
// and the title of the campaign it's about.
router.get('/users/me/notifications', registered, async (req, res) => {
  const snapshot = await collections.notifications.where('userId', '==', req.user.id).get()
  const all = snapshot.docs.map(docToJson).sort(newestFirst('createdAt'))
  const notifications = all.slice(0, LIST_LIMIT)

  const campaignIds = [...new Set(notifications.map((n) => n.campaignId).filter(Boolean))]
  const campaigns = campaignIds.length ? await db.getAll(...campaignIds.map((id) => collections.campaigns.doc(id))) : []
  const titles = new Map(campaigns.map((snap) => [snap.id, snap.get('title') ?? null]))

  res.json({
    notifications: notifications.map((n) => ({
      ...n,
      category: categoryOf(n.type),
      campaignTitle: n.campaignId ? (titles.get(n.campaignId) ?? null) : null,
    })),
    unreadCount: all.filter((n) => !n.read).length,
  })
})

// PUT /api/notifications/:id/read
router.put('/notifications/:id/read', registered, async (req, res) => {
  const ref = collections.notifications.doc(req.params.id)
  const snapshot = await ref.get()
  // Someone else's notification is reported as missing, not forbidden.
  if (!snapshot.exists || snapshot.get('userId') !== req.user.id) throw notFound('Notification not found')

  await ref.update({ read: true })
  res.json({ notification: { ...docToJson(snapshot), read: true } })
})

// PUT /api/users/me/notifications/read-all
router.put('/users/me/notifications/read-all', registered, async (req, res) => {
  const unread = await collections.notifications
    .where('userId', '==', req.user.id)
    .where('read', '==', false)
    .get()

  // Firestore batches hold up to 500 writes.
  for (let start = 0; start < unread.docs.length; start += 500) {
    const batch = db.batch()
    for (const doc of unread.docs.slice(start, start + 500)) batch.update(doc.ref, { read: true })
    await batch.commit()
  }

  res.json({ markedRead: unread.size })
})

export default router
