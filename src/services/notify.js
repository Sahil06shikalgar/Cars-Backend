import Notification from '../models/Notification.js'

export async function push(user, type, text, { href = '', actor = null } = {}) {
  if (!user) return
  const doc = await Notification.create({ user, type, text, href, actor })
  const { getIo } = await import('../socket/index.js')
  const io = getIo()
  io.to(`user:${String(user)}`).emit('notification', {
    id: String(doc._id),
    type,
    text,
    href,
    read: false,
    ts: doc.createdAt.getTime(),
  })
}

export async function markRead(userId, notificationId) {
  await Notification.findOneAndUpdate({ _id: notificationId, user: userId }, { read: true })
}

export async function markAllRead(userId) {
  await Notification.updateMany({ user: userId, read: false }, { read: true })
}