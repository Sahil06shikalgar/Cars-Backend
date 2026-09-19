import mongoose from 'mongoose'
import { absUrl } from '../utils/absolute.js'

const vaultSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    brand: { type: String, default: '', trim: true, maxlength: 60 },
    scale: { type: String, default: '1:64', maxlength: 8 },
    year: { type: Number, default: new Date().getFullYear(), min: 1900, max: 2100 },
    condition: { type: String, default: 'Fresh', maxlength: 20 },
    color: { type: String, default: '', maxlength: 40 },
    valueCents: { type: Number, default: 0, min: 0 },
    rarity: { type: String, default: 'Common', maxlength: 20 },
    tags: { type: [String], default: [] },
    photoUrl: { type: String, default: '' },
    listedAuctionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', default: null },
  },
  { timestamps: true }
)

vaultSchema.index({ owner: 1, name: 'text', brand: 'text', tags: 'text' })

export const toDto = (doc) => ({
  id: String(doc._id),
  name: doc.name,
  brand: doc.brand,
  scale: doc.scale,
  year: doc.year,
  condition: doc.condition,
  color: doc.color,
  value: Math.round(doc.valueCents) / 100,
  rarity: doc.rarity,
  tags: doc.tags.filter((t) => typeof t === 'string').map((t) => t.trim()).filter(Boolean),
  photoUrl: absUrl(doc.photoUrl),
  listed: Boolean(doc.listedAuctionId),
  auctionId: doc.listedAuctionId ? String(doc.listedAuctionId) : null,
  added: new Date(doc.createdAt).getTime(),
})

const VaultModel = mongoose.model('VaultModel', vaultSchema)
export default VaultModel