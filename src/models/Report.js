import mongoose from 'mongoose'

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['find', 'post', 'auction', 'user'], required: true },
    targetId: { type: String, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 400 },
    status: { type: String, enum: ['open', 'resolved'], default: 'open' },
  },
  { timestamps: true }
)

reportSchema.index({ status: 1, createdAt: -1 })

const Report = mongoose.model('Report', reportSchema)
export default Report