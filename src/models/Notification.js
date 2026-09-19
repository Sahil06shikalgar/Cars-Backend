import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true, maxlength: 40 }, // message | bid | outbid | auction_ended | grabbed | comment | trade
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    text: { type: String, required: true, maxlength: 300 },
    href: { type: String, default: '', maxlength: 200 },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
)

notificationSchema.index({ user: 1, read: 1, createdAt: -1 })

export const toDto = (n) => ({
  id: String(n._id),
  type: n.type,
  actorId: n.actor ? String(n.actor._id || n.actor) : null,
  text: n.text,
  href: n.href || '',
  read: n.read,
  ts: new Date(n.createdAt).getTime(),
})

const Notification = mongoose.model('Notification', notificationSchema)
export default Notification