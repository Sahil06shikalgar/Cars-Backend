import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
)

messageSchema.index({ conversation: 1, createdAt: -1 })

export const toDto = (msg) => ({
  id: String(msg._id),
  conversationId: String(msg.conversation),
  senderId: msg.sender ? String(msg.sender._id || msg.sender) : '',
  text: msg.text,
  read: msg.read,
  ts: new Date(msg.createdAt).getTime(),
})

const Message = mongoose.model('Message', messageSchema)
export default Message