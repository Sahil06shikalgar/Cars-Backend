import mongoSanitize from 'mongo-sanitize'
import { AppError } from '../middleware/errors.js'

// Strip $ operators and dots from all request bodies to stop query injection.
export function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = mongoSanitize(req.body)
  }
  next()
}

// Reject unexpected fields / enforce required fields + types for JSON bodies.
export function requireFields(fields) {
  return (req, res, next) => {
    const missing = fields.filter((f) => req.body[f] === undefined || req.body[f] === null || req.body[f] === '')
    if (missing.length) {
      return next(new AppError(400, `Missing required field${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`))
    }
    next()
  }
}