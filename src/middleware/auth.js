import { AppError } from './errors.js'
import User, { fullProfile } from '../models/User.js'
import VaultModel from '../models/VaultModel.js'
import Find from '../models/Find.js'

// Attach req.user when a valid session exists; otherwise leave it unset.
export async function loadUser(req, res, next) {
  const userId = req.session?.userId
  if (userId) {
    const user = await User.findById(userId)
    if (user) req.user = user
  }
  next()
}

// Protected route — 401 unless a user is loaded.
export const requireAuth = (req, res, next) => {
  if (!req.user) return next(new AppError(401, 'You must be signed in. Please log in or create an account.'))
  next()
}

export function getProfileStats(userId) {
  return Promise.all([
    VaultModel.countDocuments({ owner: userId }),
    Find.countDocuments({ owner: userId }),
  ]).then(([models, finds]) => ({ models, finds, trades: 0, rating: 0 }))
}

export async function respondWithMe(req, res) {
  const stats = await getProfileStats(req.user._id)
  res.json({ user: fullProfile(req.user, stats) })
}