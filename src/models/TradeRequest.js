import mongoose from 'mongoose'

const tradeRequestSchema = new mongoose.Schema(
  {
    trade: { type: mongoose.Schema.Types.ObjectId, ref: 'Find', required: true, index: true },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    message: { type: String, default: '', maxlength: 600 },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', default: null },
  },
  { timestamps: true }
)

export const toDto = (tr) => ({
  id: String(tr._id),
  tradeId: String(tr.trade._id || tr.trade),
  requesterId: String(tr.requester._id || tr.requester),
  ownerId: String(tr.owner._id || tr.owner),
  message: tr.message,
  status: tr.status,
  conversationId: tr.conversation ? String(tr.conversation) : null,
  ts: new Date(tr.createdAt).getTime(),
})

const TradeRequest = mongoose.model('TradeRequest', tradeRequestSchema)
export default TradeRequest