import mongoose from 'mongoose'
import { absUrl } from '../utils/absolute.js'

const findSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['find', 'trade'], default: 'find' },
  title: { type: String, required: true, trim: true, maxlength: 140 },
  brand: { type: String, default: 'Any', trim: true, maxlength: 60 },
  desc: { type: String, default: '', maxlength: 600 },
  priceCents: { type: Number, default: 0, min: 0 },
  shop: { type: String, default: '', maxlength: 120 },
  city: { type: String, default: '', maxlength: 80 },
  hue: { type: Number, default: 20, min: 0, max: 360 },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  locLabel: { type: String, default: '', maxlength: 160 },
  expiresAt: { type: Date, default: null },
  status: { type: String, enum: ['active', 'soldout', 'grabbed'], default: 'active', index: true },
  confirmedAt: { type: Date, default: Date.now },
  grabbedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  photoUrl: { type: String, default: '' },
  reported: { type: Boolean, default: false },
})

findSchema.index({ location: '2dsphere' })
findSchema.index({ owner: 1, status: 1 })
findSchema.index({ expiresAt: 1 })

export const toDto = (find, ownerProfile = null) => ({
  id: String(find._id),
  type: find.type,
  title: find.title,
  brand: find.brand,
  desc: find.desc,
  price: Math.round(find.priceCents) / 100,
  shop: find.shop,
  city: find.city,
  hue: find.hue,
  geo: { lat: find.location.coordinates[1], lng: find.location.coordinates[0] },
  loc: { label: find.locLabel, x: null, y: null },
  expiresAt: find.expiresAt ? new Date(find.expiresAt).getTime() : null,
  status: find.status,
  confirmedAt: new Date(find.confirmedAt).getTime(),
  by: find.owner ? String(find.owner._id || find.owner) : '',
  user: ownerProfile || null,
  at: new Date(find.createdAt).getTime(),
  photoUrl: absUrl(find.photoUrl),
})

const Find = mongoose.model('Find', findSchema)
export default Find