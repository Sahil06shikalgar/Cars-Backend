import mongoose from 'mongoose'
import { absUrl } from '../utils/absolute.js'

const bidSchema = new mongoose.Schema(
  {
    bidder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amountCents: { type: Number, required: true, min: 1 },
    at: { type: Date, default: Date.now },
  },
  { _id: true }
)

const auctionSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sourceModelId: { type: mongoose.Schema.Types.ObjectId, ref: 'VaultModel', default: null },
    model: {
      name: { type: String, required: true, maxlength: 120 },
      brand: { type: String, default: '', maxlength: 60 },
      scale: { type: String, default: '1:64', maxlength: 8 },
      color: { type: String, default: '', maxlength: 40 },
    },
    photoUrl: { type: String, default: '' },
    opening: { type: Date, default: Date.now },
    endsAt: { type: Date, required: true, index: true },
    startingBidCents: { type: Number, required: true, min: 1 },
    buyNowCents: { type: Number, default: 0, min: 0 },
    currentBidCents: { type: Number, default: 0, min: 0 },
    currentBidder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    bidCount: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'ended'], default: 'active', index: true },
    winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    bids: { type: [bidSchema], default: [] },
    reported: { type: Boolean, default: false },
  },
  { timestamps: true }
)

auctionSchema.index({ status: 1, endsAt: 1 })

export const toDto = (auction, extras = {}) => {
  const seller = extras.seller || (auction.seller ? { id: String(auction.seller._id || auction.seller) } : null)
  const bids = (auction.bids || [])
    .map((b) => {
      const userMap = extras.userMap || {}
      const idStr = b.bidder ? String(b.bidder._id || b.bidder) : ''
      return {
        userId: idStr,
        user: userMap[idStr] || null,
        amount: Math.round(b.amountCents) / 100,
        at: new Date(b.at).getTime(),
      }
    })
    .sort((a, b) => b.amount - a.amount)

  return {
    id: String(auction._id),
    model: {
      name: auction.model.name,
      brand: auction.model.brand,
      scale: auction.model.scale,
      color: auction.model.color,
    },
    photoUrl: absUrl(auction.photoUrl),
    sellerId: seller ? seller.id : (auction.seller ? String(auction.seller._id || auction.seller) : ''),
    seller,
    opening: new Date(auction.opening).getTime(),
    endsAt: new Date(auction.endsAt).getTime(),
    startingBid: Math.round(auction.startingBidCents) / 100,
    buyNow: auction.buyNowCents ? Math.round(auction.buyNowCents) / 100 : 0,
    currentBid: auction.currentBidCents ? Math.round(auction.currentBidCents) / 100 : Math.round(auction.startingBidCents) / 100,
    currentBidder: auction.currentBidder ? String(auction.currentBidder) : null,
    bidCount: auction.bidCount || auction.bids.length || 0,
    status: auction.status,
    winnerId: auction.winnerId ? String(auction.winnerId) : null,
    bids,
  }
}

const Auction = mongoose.model('Auction', auctionSchema)
export default Auction