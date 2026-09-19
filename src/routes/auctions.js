import { Router } from 'express'
import Auction, { toDto } from '../models/Auction.js'
import VaultModel from '../models/VaultModel.js'
import User, { publicProfile } from '../models/User.js'
import { AppError, asyncHandler } from '../middleware/errors.js'
import { requireAuth } from '../middleware/auth.js'
import { bidLimiter } from '../middleware/rateLimit.js'
import { toCents } from '../utils/money.js'
import { push } from '../services/notify.js'

const r = Router()

const STATUS = ['active', 'ended']

const saleLabel = (a) => {
  const now = Date.now()
  if (a.status === 'ended') return 'ended'
  return new Date(a.endsAt).getTime() > now ? 'live' : 'ended'
}

async function auctionWithUsers(a, viewerId) {
  const seller = a.seller ? await User.findById(a.seller).select('name handle initials color') : null
  const bidderIds = [...new Set((a.bids || []).map((b) => String(b.bidder?._id || b.bidder)))]
  const userMap = {}
  if (viewerId) {
    try { userMap[String(viewerId)] = publicProfile(await User.findById(viewerId).select('name handle initials color')) } catch {}
  }
  const users = await User.find({ _id: { $in: bidderIds } }).select('name handle initials color').lean()
  users.forEach((u) => { userMap[String(u._id)] = publicProfile(u) })
  return toDto(a, { seller: seller ? publicProfile(seller) : null, userMap })
}

// Public read of live + ended auctions, with filters.
r.get('/', asyncHandler(async (req, res) => {
  const { status = 'live', q = '', seller } = req.query
  const filter = {}
  if (status === 'live') filter.status = 'active'
  if (status === 'ended') filter.status = 'ended'
  if (q) {
    const s = String(q).slice(0, 80)
    filter['model.name'] = { $regex: s, $options: 'i' }
  }
  if (seller) filter.seller = seller
  const docs = await Auction.find(filter)
    .sort(status === 'ended' ? { endsAt: -1 } : { endsAt: 1 })
    .limit(150)
  const out = await Promise.all(docs.map((a) => auctionWithUsers(a, req.user?._id)))
  res.json({ auctions: out })
}))

r.get('/:id', asyncHandler(async (req, res) => {
  const doc = await Auction.findById(req.params.id)
  if (!doc) return res.status(404).json({ error: { message: 'Auction not found.' } })
  res.json({ auction: await auctionWithUsers(doc, req.user?._id) })
}))

// Listing an auction must create the linked vault model if none is referenced.
r.post('/', requireAuth, asyncHandler(async (req, res) => {
  const { model, photoUrl, startingBid, buyNow, endsAt, sourceModelId } = req.body
  const startingCents = toCents(startingBid)
  const buyNowCents = buyNow ? toCents(buyNow) : 0
  if (!startingCents || startingCents < 1) return res.status(400).json({ error: { message: 'A starting bid in EUR is required.' } })
  if (buyNowCents && buyNowCents < startingCents) return res.status(400).json({ error: { message: 'Buy now must be at least the starting bid.' } })
  let end = new Date(String(endsAt) || '')
  if (Number.isNaN(end.getTime())) end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  else if (end.getTime() <= Date.now()) return res.status(400).json({ error: { message: 'Ends at must be in the future.' } })

  let source = sourceModelId ? await VaultModel.findById(sourceModelId) : null
  let auctionSourceId = null
  if (!source && model) {
    source = await VaultModel.create({
      owner: req.user._id,
      name: model.name || 'Die-cast model',
      brand: model.brand || '',
      scale: model.scale || '1:64',
      color: model.color || '',
      valueCents: startingCents,
      photoUrl,
      rarity: 'Common',
    })
  }
  if (source) {
    if (String(source.owner) !== String(req.user._id)) {
      return res.status(403).json({ error: { message: 'You can only list your own models.' } })
    }
    auctionSourceId = source._id
  }

  const doc = await Auction.create({
    seller: req.user._id,
    sourceModelId: auctionSourceId,
    model: model && source
      ? { name: source.name, brand: source.brand, scale: source.scale, color: source.color }
      : { name: (model?.name || 'Die-cast model'), brand: model?.brand || '', scale: model?.scale || '1:64', color: model?.color || '' },
    photoUrl: String(photoUrl || '').slice(0, 500),
    endsAt: end,
    startingBidCents: startingCents,
    buyNowCents,
  })
  if (source) {
    source.listedAuctionId = doc._id
    await source.save()
  }
  res.status(201).json({ auction: await auctionWithUsers(doc, req.user?._id) })
}))

const BID_FILTER = (auctionId, amountCents) => ({
  _id: auctionId,
  status: 'active',
  endsAt: { $gt: new Date() },
  $or: [
    { currentBidCents: { $lt: amountCents } },
    { currentBidCents: 0, startingBidCents: { $lte: amountCents } },
  ],
})

const bidPush = (req, amountCents) => ({
  $inc: { bidCount: 1 },
  $set: {
    currentBidCents: amountCents,
    currentBidder: req.user._id,
    lastBidAt: new Date(),
  },
  $push: { bids: { bidder: req.user._id, amountCents, at: new Date() } },
})

r.post('/:id/bid', requireAuth, bidLimiter, asyncHandler(async (req, res) => {
  const amountCents = toCents(req.body.amount)
  if (!amountCents || amountCents < 1) return res.status(400).json({ error: { message: 'A bid amount is required.' } })
  const auction = await Auction.findById(req.params.id)
  if (!auction) return res.status(404).json({ error: { message: 'Auction not found.' } })
  if (auction.status !== 'active') return res.status(400).json({ error: { message: 'This auction has ended.' } })
  if (new Date(auction.endsAt).getTime() <= Date.now()) return res.status(400).json({ error: { message: 'This auction has ended.' } })
  if (String(auction.seller) === String(req.user._id)) {
    return res.status(403).json({ error: { message: 'You cannot bid on your own auction.' } })
  }
  if (auction.currentBidCents > 0 && amountCents < minNext(auction.currentBidCents)) {
    return res.status(400).json({ error: { message: `Bid must be at least ${minNext(auction.currentBidCents) / 100} €.` } })
  }
  if (auction.currentBidCents === 0 && amountCents < auction.startingBidCents) {
    return res.status(400).json({ error: { message: `Bid must be at least ${auction.startingBidCents / 100} €.` } })
  }

  const prevBidder = auction.currentBidder
  const updated = await Auction.findOneAndUpdate(BID_FILTER(req.params.id, amountCents), bidPush(req, amountCents), { new: true })
  if (!updated) {
    return res.status(409).json({ error: { message: 'Your bid was too low — someone beat you. Place a higher bid.' } })
  }

  // Notify the person we outbid.
  if (prevBidder && String(prevBidder) !== String(req.user._id)) {
    push(prevBidder, 'outbid', `You were outbid on “${updated.model.name}”.`, {
      href: `/auctions/${String(updated._id)}`,
      actor: req.user._id,
    })
  }
  const { getIo } = await import('../socket/index.js')
  const io = getIo()
  io.to(`auction:${String(updated._id)}`).emit('auction:bid', { auction: await auctionWithUsers(updated, req.user._id) })
  res.json({ auction: await auctionWithUsers(updated, req.user._id) })
}))

// buy now — atomic end.
r.post('/:id/buy', requireAuth, asyncHandler(async (req, res) => {
  const auction = await Auction.findById(req.params.id)
  if (!auction) return res.status(404).json({ error: { message: 'Auction not found.' } })
  if (String(auction.seller) === String(req.user._id)) {
    return res.status(403).json({ error: { message: 'You cannot buy your own auction.' } })
  }
  if (!auction.buyNowCents) return res.status(400).json({ error: { message: 'This auction has no buy-now price.' } })
  const updated = await Auction.findOneAndUpdate(
    BID_FILTER(req.params.id, auction.buyNowCents),
    {
      $set: { status: 'ended', winnerId: req.user._id, endsAt: new Date(), currentBidder: req.user._id, currentBidCents: auction.buyNowCents },
      $inc: { bidCount: 1 },
      $push: { bids: { bidder: req.user._id, amountCents: auction.buyNowCents, at: new Date() } },
    },
    { new: true }
  )
  if (!updated) return res.status(409).json({ error: { message: 'This auction was just closed by someone else.' } })
  push(updated.seller, 'auction_ended', `Your auction “${updated.model.name}” was sold via Buy Now.`, { href: `/auctions/${String(updated._id)}`, actor: req.user._id })
  const { getIo } = await import('../socket/index.js')
  const io = getIo()
  io.to(`auction:${String(updated._id)}`).emit('auction:ended', { auction: await auctionWithUsers(updated, req.user?._id) })
  res.json({ auction: await auctionWithUsers(updated, req.user?._id) })
}))

// Manual close by seller (snapshot winner).
r.post('/:id/close', requireAuth, asyncHandler(async (req, res) => {
  const auction = await Auction.findById(req.params.id)
  if (!auction) return res.status(404).json({ error: { message: 'Auction not found.' } })
  if (String(auction.seller) !== String(req.user._id)) {
    return res.status(403).json({ error: { message: 'Only the seller can close an auction.' } })
  }
  const updated = await Auction.findOneAndUpdate(
    { _id: req.params.id, status: 'active' },
    { $set: { status: 'ended', endsAt: new Date(), winnerId: auction.currentBidder || null } },
    { new: true }
  )
  if (!updated) return res.status(400).json({ error: { message: 'Auction is already ended.' } })
  if (updated.winnerId) {
    push(updated.winnerId, 'auction_ended', `You won “${updated.model.name}” — the auction is closed.`, { href: `/auctions/${String(updated._id)}` })
  }
  res.json({ auction: await auctionWithUsers(updated, req.user?._id) })
}))

async function minNext(currentCents) {
  return currentCents >= 20000 ? currentCents + 1000 : currentCents + 500
}

const sweep = async () => {
  const expired = await Auction.find({ status: 'active', endsAt: { $lte: new Date() } }).select('_id model winnerId currentBidder seller')
  for (const a of expired) {
    const updated = await Auction.findOneAndUpdate(
      { _id: a._id, status: 'active', endsAt: { $lte: new Date() } },
      { $set: { status: 'ended', winnerId: a.currentBidder || null } },
      { new: true }
    )
    if (!updated) continue
    if (updated.winnerId) {
      push(updated.winnerId, 'auction_ended', `You won “${updated.model.name}” — the auction is closed.`, { href: `/auctions/${String(updated._id)}` })
    }
    if (String(updated.seller) !== String(updated.winnerId)) {
      push(updated.seller, 'auction_ended', `Your auction “${updated.model.name}” has ended.`, { href: `/auctions/${String(updated._id)}` })
    }
    const { getIo } = await import('../socket/index.js')
    const io = getIo()
    io.to(`auction:${String(updated._id)}`).emit('auction:ended', { auction: await auctionWithUsers(updated, null) })
  }
}

export default r
export { sweep }