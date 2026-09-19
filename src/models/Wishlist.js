import mongoose from 'mongoose'

const wishlistSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    brand: { type: String, default: '', trim: true, maxlength: 60 },
    scale: { type: String, default: '1:64', maxlength: 8 },
    note: { type: String, default: '', maxlength: 300 },
  },
  { timestamps: true }
)

wishlistSchema.index({ owner: 1, name: 'text' })

export const toDto = (doc) => ({
  id: String(doc._id),
  name: doc.name,
  brand: doc.brand,
  scale: doc.scale,
  note: doc.note || '',
  addedAt: new Date(doc.createdAt).getTime(),
})

const WishlistItem = mongoose.model('WishlistItem', wishlistSchema)
export default WishlistItem