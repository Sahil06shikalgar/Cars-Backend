import { Router } from 'express'
import Report from '../models/Report.js'
import { asyncHandler, AppError } from '../middleware/errors.js'
import { requireAuth } from '../middleware/auth.js'
import { reportLimiter } from '../middleware/rateLimit.js'

const r = Router()
r.use(requireAuth)

r.post('/', reportLimiter, asyncHandler(async (req, res) => {
  const { targetType, targetId, reason } = req.body
  if (!['find', 'post', 'auction', 'user'].includes(targetType)) {
    return res.status(400).json({ error: { message: 'Invalid target type.' } })
  }
  if (!targetId || !String(targetId).trim()) {
    return res.status(400).json({ error: { message: 'targetId is required.' } })
  }
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ error: { message: 'A reason is required.' } })
  }
  const report = await Report.create({
    reporter: req.user._id,
    targetType,
    targetId: String(targetId).slice(0, 80),
    reason: String(reason).trim().slice(0, 400),
  })
  res.status(201).json({ report: { id: String(report._id), status: 'open' } })
}))

export default r