import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { body, validationResult } from 'express-validator'
import User, { fullProfile } from '../models/User.js'
import { AppError, asyncHandler } from '../middleware/errors.js'
import { requireAuth, getProfileStats, respondWithMe } from '../middleware/auth.js'
import { signupLimiter, loginLimiter, forgotLimiter } from '../middleware/rateLimit.js'
import { requireFields } from '../utils/sanitize.js'
import { makeHandle, makeInitials, pickColor, hashToken, randomToken } from '../utils/identity.js'
import { push } from '../services/notify.js'
import { ENV } from '../config/env.js'
import {
  googleConfigured,
  googleAuthorizeUrl,
  googleExchangeCode,
  googleUserInfo,
  oauthState,
  OAUTH_STATE_TTL,
} from '../services/google.js'

const r = Router()

const signupValidations = [
  body('name').trim().isLength({ min: 1, max: 60 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
]

const loginValidations = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 1 }),
]

r.post(
  '/signup',
  signupLimiter,
  requireFields(['name', 'email', 'password']),
  signupValidations,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ error: { message: errors.array().map((e) => e.msg).join('; ') } })
    const { name, email, password } = req.body
    const exists = await User.findOne({ email })
    if (exists) return res.status(409).json({ error: { message: 'An account with that email already exists. Please log in.' } })
    const handle = makeHandle(name)
    const user = new User({ name, email, handle, initials: makeInitials(name), color: pickColor(name) })
    await user.setPassword(password)
    await user.save()
    req.session.userId = user._id
    res.status(201).json({ user: fullProfile(user) })
  })
)

r.post(
  '/login',
  loginLimiter,
  requireFields(['email', 'password']),
  loginValidations,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ error: { message: errors.array().map((e) => e.msg).join('; ') } })
    const { email, password } = req.body
    const user = await User.findOne({ email }).select('+passwordHash')
    if (!user || !(await user.verifyPassword(password))) {
      return res.status(401).json({ error: { message: 'Invalid email or password.' } })
    }
    req.session.userId = user._id
    res.json({ user: fullProfile(user) })
  })
)

r.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  await req.session.destroy()
  res.clearCookie('dg.sid')
  res.json({ ok: true })
}))

r.get('/me', asyncHandler(async (req, res) => {
  // Only ever the caller's own safe profile: no password hash, reset token or
  // session secret leaves the server.
  res.set('Cache-Control', 'no-store')
  if (!req.user) return res.status(401).json({ error: { message: 'Not authenticated.' } })
  const stats = await getProfileStats(req.user._id)
  res.json({ user: fullProfile(req.user, stats) })
}))

r.patch('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = req.user
  const allowed = ['name', 'handle', 'city', 'bio']
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      user[key] = String(req.body[key]).trim().slice(0, 300)
    }
  }
  if (req.body.name) {
    user.initials = makeInitials(req.body.name)
    user.color = user.color || pickColor(req.body.name)
  }
  await user.save()
  const stats = await getProfileStats(user._id)
  res.json({ user: fullProfile(user, stats) })
}))

r.post('/forgot', forgotLimiter, requireFields(['email']), asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email })
  if (!user) return res.json({ ok: true, message: 'If an account with that email exists, a reset link has been sent.' })
  const token = randomToken()
  user.resetTokenHash = hashToken(token)
  user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000)
  await user.save()
  // In production this would send an email. In dev the token is returned so the frontend can use it.
  const message = process.env.NODE_ENV === 'production'
    ? 'If an account with that email exists, a reset link has been sent.'
    : 'A dev reset token was generated (check server logs for testing).'
  console.log(`[auth] dev reset token for ${user.email}: ${token}`)
  res.json({ ok: true, message, devToken: process.env.NODE_ENV !== 'production' ? token : undefined })
}))

r.post('/reset', requireFields(['token', 'password']), asyncHandler(async (req, res) => {
  const { token, password } = req.body
  if (password.length < 8) return res.status(400).json({ error: { message: 'Password must be at least 8 characters.' } })
  const tokenHash = hashToken(String(token).trim())
  const user = await User.findOne({ resetTokenHash: tokenHash, resetTokenExpiry: { $gt: new Date() } }).select('+resetTokenHash +resetTokenExpiry')
  if (!user) return res.status(400).json({ error: { message: 'Invalid or expired reset token.' } })
  await user.setPassword(password)
  user.resetTokenHash = null
  user.resetTokenExpiry = null
  await user.save()
  res.json({ ok: true, message: 'Password updated. You can now log in with your new password.' })
}))

// ---------- Google OAuth ----------
// Start: build the authorization URL tied to a per-session state value.
r.get('/google/start', asyncHandler(async (req, res) => {
  if (!googleConfigured()) {
    return res.status(503).json({
      error: { message: 'Google sign-up is not configured on the server yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the backend .env and restart the API.' },
    })
  }
  const state = oauthState()
  req.session.oauthState = { value: state, at: Date.now() }
  res.json({ url: googleAuthorizeUrl(state) })
}))

// Callback: Google redirects the browser here with ?code=&state=.
r.get('/google/callback', asyncHandler(async (req, res) => {
  if (!googleConfigured()) {
    return res.status(503).send('Google sign-up is not configured on the server yet.')
  }
  const { code, state, error } = req.query
  if (error) return res.status(400).send('Google authorization failed.')
  if (!code || !state) return res.status(400).send('Missing authorization parameters.')

  const stored = req.session && req.session.oauthState
  req.session.oauthState = null
  if (!stored || !stored.value || stored.value !== state || Date.now() - stored.at > OAUTH_STATE_TTL) {
    return res.status(400).send('Invalid or expired Google state. Please try again.')
  }

  const tokens = await googleExchangeCode(String(code))
  const info = await googleUserInfo(tokens.access_token)
  if (!info || !info.email) {
    return res.status(400).send('Google did not return an email address.')
  }

  // Find or create the account, then log it in with the normal session.
  const email = info.email.toLowerCase()
  const name = String(info.name || email.split('@')[0] || 'Collector').trim().slice(0, 60)
  let user = await User.findOne({ email })
  if (!user) {
    user = new User({
      name,
      email,
      handle: makeHandle(name),
      initials: makeInitials(name),
      color: pickColor(name),
    })
    await user.setPassword(randomToken())
    await user.save()
  }

  req.session.userId = user._id
  await req.session.save()
  res.redirect(ENV.clientOrigin)
}))

export default r