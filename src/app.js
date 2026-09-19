import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { ENV, requireEnv } from './config/env.js'
import { buildSessionMiddleware } from './config/session.js'
import { AppError, errorHandler, notFound } from './middleware/errors.js'
import { sanitizeBody } from './utils/sanitize.js'
import { loadUser } from './middleware/auth.js'
import { apiLimiter } from './middleware/rateLimit.js'
import authRoutes from './routes/auth.js'
import vaultRoutes from './routes/vault.js'
import wishlistRoutes from './routes/wishlist.js'
import findsRoutes from './routes/finds.js'
import postsRoutes from './routes/posts.js'
import auctionsRoutes from './routes/auctions.js'
import conversationsRoutes from './routes/conversations.js'
import notificationsRoutes from './routes/notifications.js'
import reportsRoutes from './routes/reports.js'
import uploadsRoutes from './routes/uploads.js'
import tradesRoutes from './routes/trades.js'

const mongoUri = requireEnv('MONGODB_URI')

export function buildApp({ sessionMiddleware } = {}) {
  const app = express()
  app.set('trust proxy', 1)

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }))
  app.use(cors({ origin: ENV.clientOrigin, credentials: true }))
  app.use(express.json({ limit: '512kb' }))
  app.use(express.urlencoded({ extended: true, limit: '512kb' }))
  app.use(sanitizeBody)

  app.use('/uploads', express.static(ENV.uploadDir, { maxAge: '7d' }))

  app.use(sessionMiddleware || buildSessionMiddleware(mongoUri))

  app.use(loadUser)
  app.use('/api', apiLimiter)

  app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }))

  app.use('/api/auth', authRoutes)
  app.use('/api/vault', vaultRoutes)
  app.use('/api/wishlist', wishlistRoutes)
  app.use('/api/finds', findsRoutes)
  app.use('/api/posts', postsRoutes)
  app.use('/api/auctions', auctionsRoutes)
  app.use('/api/conversations', conversationsRoutes)
  app.use('/api/notifications', notificationsRoutes)
  app.use('/api/reports', reportsRoutes)
  app.use('/api/upload', uploadsRoutes)
  app.use('/api/trades', tradesRoutes)

  app.use(notFound)
  app.use(errorHandler)

  return app
}