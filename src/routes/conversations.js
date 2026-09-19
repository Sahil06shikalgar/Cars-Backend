import { Router } from 'express'
import Conversation, { toDto } from '../models/Conversation.js'
import Message, { toDto as msgDto } from '../models/Message.js'
import User, { publicProfile } from '../models/User.js'
import Find from '../models/Find.js'
import TradeRequest from '../models/TradeRequest.js'
import { AppError, asyncHandler } from '../middleware/errors.js'
import { requireAuth } from '../middleware/auth.js'
import { messageLimiter } from '../middleware/rateLimit.js'
import { push } from '../services/notify.js'
import { getIo } from '../socket/index.js'

const r = Router()
r.use(requireAuth)

async function usersByIds(ids) {
  if (!ids.length) return {}
  const users = await User.find({ _id: { $in: ids } }).select('name handle initials color').lean()
  const map = {}
  users.forEach((u) => { map[String(u._id)] = publicProfile(u) })
  return map
}

r.get('/', asyncHandler(async (req, res) => {
  const convos = await Conversation.find({ participants: req.user._id }).sort({ lastActivity: -1 }).limit(60)
  const ids = new Set()
  convos.forEach((c) => c.participants.forEach((p) => ids.add(String(p._id || p))))
  ids.add(String(req.user._id))
  const users = await usersByIds([...ids])
  res.json({ conversations: convos.map((c) => toDto(c, { users, viewerId: req.user._id })) })
}))

r.get('/:id/messages', asyncHandler(async (req, res) => {
  const convo = await Conversation.findOne({
    _id: req.params.id,
    participants: req.user._id,
  })
  if (!convo) return res.status(404).json({ error: { message: 'Conversation not found.' } })
  await Message.updateMany({ conversation: convo._id, sender: { $ne: req.user._id }, read: false }, { read: true })
  const msgs = await Message.find({ conversation: convo._id }).sort({ createdAt: 1 }).populate('sender', 'name handle initials color')
  res.json({ conversation: toDto(convo, { users: await usersByIds(convo.participants.map((p) => String(p._id || p))), viewerId: req.user._id }), messages: msgs.map(msgDto) })
}))

// Start a conversation with another user (find trade or direct from profile).
r.post('/', messageLimiter, asyncHandler(async (req, res) => {
  const { userId, message, tradeRequestId } = req.body
  const other = String(userId || '')
  if (!other) return res.status(400).json({ error: { message: 'userId is required.' } })
  if (other === String(req.user._id)) return res.status(400).json({ error: { message: 'You cannot message yourself.' } })
  const target = await User.findById(other)
  if (!target) return res.status(404).json({ error: { message: 'User not found.' } })

  if (tradeRequestId) {
    const tr = await TradeRequest.findById(tradeRequestId)
    if (!tr || (String(tr.requester) !== String(req.user._id) && String(tr.owner) !== String(req.user._id))) {
      return res.status(403).json({ error: { message: 'You are not part of this trade request.' } })
    }
  }

  let convo = await Conversation.findOne({ participants: { $all: [req.user._id, other] } })
  if (!convo) {
    convo = await Conversation.create({ participants: [req.user._id, other] })
    if (tradeRequestId) {
      convo.tradeRequestId = tradeRequestId
      await convo.save()
    }
  }

  if (message && String(message).trim()) {
    const msg = await Message.create({ conversation: convo._id, sender: req.user._id, text: String(message).trim().slice(0, 2000) })
    convo.lastMessage = msg.text
    convo.lastActivity = new Date()
    await convo.save()
    push(other, 'message', `${target.name} sent you a message.`, { href: `/messages/${String(convo._id)}`, actor: req.user._id })
    getIo().to(`user:${other}`).emit('message:new', {
      message: msgDto(msg),
      conversation: toDto(convo, { users: await usersByIds([other, String(req.user._id)]), viewerId: String(req.user._id) }),
    })
  }

  res.status(201).json({ conversation: toDto(convo, { users: await usersByIds([other, String(req.user._id)]), viewerId: String(req.user._id) }) })
}))

r.post('/:id/messages', messageLimiter, asyncHandler(async (req, res) => {
  const convo = await Conversation.findOne({ _id: req.params.id, participants: req.user._id })
  if (!convo) return res.status(404).json({ error: { message: 'Conversation not found.' } })
  const text = String(req.body.text || '').trim()
  if (!text) return res.status(400).json({ error: { message: 'Message text is required.' } })
  const msg = await Message.create({ conversation: convo._id, sender: req.user._id, text: text.slice(0, 2000) })
  convo.lastMessage = msg.text
  convo.lastActivity = new Date()
  await convo.save()
  const other = convo.participants.find((p) => String(p._id || p) !== String(req.user._id))
  const userMap = await usersByIds([other, String(req.user._id)])
  getIo().to(`user:${String(other)}`).emit('message:new', {
    message: msgDto(msg),
    conversation: toDto(convo, { users: userMap, viewerId: String(req.user._id) }),
  })
  getIo().to(`conversation:${String(convo._id)}`).emit('conversation:message', msgDto(msg))
  push(other, 'message', `${req.user.name || 'User'} sent you a message.`, { href: `/messages/${String(convo._id)}`, actor: req.user._id })
  res.status(201).json({ message: msgDto(msg) })
}))

// Mark a conversation read (for unread badge).
r.post('/:id/read', asyncHandler(async (req, res) => {
  const convo = await Conversation.findOne({ _id: req.params.id, participants: req.user._id })
  if (!convo) return res.status(404).json({ error: { message: 'Conversation not found.' } })
  await Message.updateMany({ conversation: convo._id, sender: { $ne: req.user._id }, read: false }, { read: true })
  res.json({ ok: true })
}))

export default r