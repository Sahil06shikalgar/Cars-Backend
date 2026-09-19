import mongoose from 'mongoose'

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      required: true,
      validate: [(arr) => arr.length === 2, 'A conversation needs exactly two participants'],
    },
    tradeRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'TradeRequest', default: null },
    lastMessage: { type: String, default: '' },
    lastActivity: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
)

conversationSchema.index({ participants: 1 })

export const toDto = (convo, extras = {}) => {
  const users = extras.users || {}
  const other = (convo.participants || []).find((p) => {
    const pid = String(p._id || p)
    return pid !== String(extras.viewerId)
  })
  const otherId = other ? String(other._id || other) : ''
  return {
    id: String(convo._id),
    with: otherId,
    user: users[otherId] || null,
    last: convo.lastMessage || '',
    ts: new Date(convo.lastActivity || convo.updatedAt).getTime(),
    tradeRequestId: convo.tradeRequestId ? String(convo.tradeRequestId) : null,
  }
}

const Conversation = mongoose.model('Conversation', conversationSchema)
export default Conversation