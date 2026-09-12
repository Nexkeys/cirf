import { Router } from 'express'
import { docToJson, newestFirst } from '../lib/firestore.js'
import { notFound } from '../lib/httpError.js'
import { registered } from '../middleware/guards.js'
import { collections } from '../services/collections.js'
import { db } from '../services/firebaseAdmin.js'

const router = Router()

const LIST_LIMIT = 50

// GET /api/users/me/notifications
router.get('/users/me/notifications', registered, async (req, res) => {
  const snapshot = await collections.notifications.where('userId', '==', req.user.id).get()
  const notifications = snapshot.docs.map(docToJson).sort(newestFirst('createdAt'))

  res.json({
    notifications: notifications.slice(0, LIST_LIMIT),
    unreadCount: notifications.filter((n) => !n.read).length,
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
