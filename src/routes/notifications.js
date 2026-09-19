import { Router } from 'express'
import Notification, { toDto } from '../models/Notification.js'
import { asyncHandler } from '../middleware/errors.js'
import { requireAuth } from '../middleware/auth.js'
import { markAllRead, markRead } from '../services/notify.js'

const r = Router()
r.use(requireAuth)

r.get('/', asyncHandler(async (req, res) => {
  const notes = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(40)
  const unread = await Notification.countDocuments({ user: req.user._id, read: false })
  res.json({ notifications: notes.map(toDto), unread })
}))

r.get('/unread-count', asyncHandler(async (req, res) => {
  const unread = await Notification.countDocuments({ user: req.user._id, read: false })
  res.json({ unread })
}))

r.post('/:id/read', asyncHandler(async (req, res) => {
  await markRead(req.user._id, req.params.id)
  res.json({ ok: true })
}))

r.post('/read-all', asyncHandler(async (req, res) => {
  await markAllRead(req.user._id)
  res.json({ ok: true })
}))

export default r