import { Router } from 'express'
import TradeRequest, { toDto } from '../models/TradeRequest.js'
import Find from '../models/Find.js'
import Conversation from '../models/Conversation.js'
import User, { publicProfile } from '../models/User.js'
import { asyncHandler, AppError } from '../middleware/errors.js'
import { requireAuth } from '../middleware/auth.js'
import { push } from '../services/notify.js'
import { absUrl } from '../utils/absolute.js'

const r = Router()
r.use(requireAuth)

async function hydrate(tr) {
  const t = tr.toObject ? tr.toObject() : tr
  const owner = await User.findById(t.owner).select('name handle initials color').lean()
  const requester = await User.findById(t.requester).select('name handle initials color').lean()
  const trade = await Find.findById(t.tradeId || t.trade).lean()
  return {
    ...toDto(tr, {}),
    trade: trade
      ? { id: String(trade._id), title: trade.title, brand: trade.brand, price: trade.priceCents / 100, photoUrl: absUrl(trade.photoUrl) }
      : null,
    owner: owner ? publicProfile(owner) : null,
    requester: requester ? publicProfile(requester) : null,
  }
}

// Requests involving the current user (incoming = pending for you, outgoing = pending from you).
r.get('/', asyncHandler(async (req, res) => {
  const { incoming = 'true' } = req.query
  const filter = { $or: [{ owner: req.user._id }, { requester: req.user._id }] }
  const docs = await TradeRequest.find(filter).sort({ createdAt: -1 }).limit(60)
  const out = []
  for (const d of docs) out.push(await hydrate(d))
  res.json({ requests: out })
}))

// Create a trade request against a trade find (type=trade).
r.post('/', asyncHandler(async (req, res) => {
  const { tradeId, message } = req.body
  if (!tradeId) return res.status(400).json({ error: { message: 'tradeId is required.' } })
  const trade = await Find.findOne({ _id: tradeId, type: 'trade' })
  if (!trade) return res.status(404).json({ error: { message: 'Trade find not found.' } })
  if (String(trade.owner) === String(req.user._id)) {
    return res.status(403).json({ error: { message: 'You cannot request your own trade.' } })
  }
  const existing = await TradeRequest.findOne({ trade: tradeId, requester: req.user._id, status: 'pending' })
  if (existing) return res.status(409).json({ error: { message: 'You already requested this trade.' } })
  const tr = await TradeRequest.create({
    trade: tradeId,
    requester: req.user._id,
    owner: trade.owner,
    message: String(message || '').trim().slice(0, 600),
  })
  push(trade.owner, 'trade', `${req.user.name} requested your trade “${trade.title}”.`, {
    href: `/finds/trade/${tradeId}`,
    actor: req.user._id,
  })
  res.status(201).json({ request: await hydrate(tr) })
}))

// Accept: open a conversation between the two and mark accepted.
r.post('/:id/accept', asyncHandler(async (req, res) => {
  const tr = await TradeRequest.findOne({ _id: req.params.id, owner: req.user._id, status: 'pending' })
  if (!tr) return res.status(404).json({ error: { message: 'Trade request not found or already handled.' } })
  let convo = await Conversation.findOne({ participants: { $all: [tr.requester, tr.owner] } })
  if (!convo) convo = await Conversation.create({ participants: [tr.requester, tr.owner], tradeRequestId: tr._id })
  else if (!convo.tradeRequestId) { convo.tradeRequestId = tr._id; await convo.save() }
  tr.status = 'accepted'
  tr.conversation = convo._id
  await tr.save()
  push(tr.requester, 'trade', `${req.user.name} accepted your trade request.`, { href: `/messages/${String(convo._id)}`, actor: req.user._id })
  res.json({ request: await hydrate(tr) })
}))

r.post('/:id/decline', asyncHandler(async (req, res) => {
  const tr = await TradeRequest.findOne({ _id: req.params.id, owner: req.user._id, status: 'pending' })
  if (!tr) return res.status(404).json({ error: { message: 'Trade request not found or already handled.' } })
  tr.status = 'declined'
  await tr.save()
  push(tr.requester, 'trade', `${req.user.name} declined your trade request.`, { actor: req.user._id })
  res.json({ request: await hydrate(tr) })
}))

export default r