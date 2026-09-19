import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    handle: { type: String, required: true, trim: true, unique: true, index: true },
    initials: { type: String, default: '?' },
    color: { type: String, default: '#ff5a3c' },
    city: { type: String, default: '', maxlength: 60 },
    bio: { type: String, default: '', maxlength: 300 },
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    badges: { type: [String], default: [] },
    demo: { type: Boolean, default: false },
    resetTokenHash: { type: String, default: null, select: false },
    resetTokenExpiry: { type: Date, default: null, select: false },
  },
  { timestamps: true }
)

userSchema.methods.setPassword = async function (password) {
  this.passwordHash = await bcrypt.hash(password, 10)
}

userSchema.methods.verifyPassword = function (password) {
  return bcrypt.compare(password, this.passwordHash)
}

export const publicProfile = (user) => ({
  id: String(user._id),
  name: user.name,
  handle: user.handle,
  initials: user.initials,
  color: user.color,
  city: user.city || '—',
})

export const fullProfile = (user, stats = {}) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  handle: user.handle,
  initials: user.initials,
  color: user.color,
  city: user.city || '—',
  bio: user.bio || '',
  joined: user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '',
  level: user.level || 1,
  xp: user.xp || 0,
  badges: user.badges || [],
  stats,
})

export const USER_PROFILE_SELECT = 'name handle initials color city bio createdAt'

const User = mongoose.model('User', userSchema)
export default User