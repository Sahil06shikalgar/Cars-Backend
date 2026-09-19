import { Router } from 'express'
import Find, { toDto } from '../models/Find.js'
import { asyncHandler } from '../middleware/errors.js'
import { requireAuth } from '../middleware/auth.js'
import { loadOwned } from '../middleware/ownership.js'
import { findLimiter } from '../middleware/rateLimit.js'
import { toCents } from '../utils/money.js'
import { publicProfile } from '../models/User.js'

const r = Router()

const FALLBACK_GEO = { lat: 52.52, lng: 13.405 } // Berlin

const coerceGeo = (g) => {
  if (!g) return null
  const lat = Number(Array.isArray(g) ? g[1] : g.lat)
  const lng = Number(Array.isArray(g) ? g[0] : g.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return [lng, lat]
}

const pick = (body) => ({
  type: body.type === 'trade' ? 'trade' : 'find',
  title: String(body.title || '').trim().slice(0, 140),
  brand: String(body.brand || 'Any').trim().slice(0, 60),
  desc: String(body.desc || '').trim().slice(0, 600),
  priceCents: toCents(Math.max(0, Number(body.price) || 0)),
  shop: String(body.shop || '').trim().slice(0, 120),
  city: String(body.city || '').trim().slice(0, 80),
  hue: Math.max(0, Math.min(360, Number(body.hue) || 20)),
  locLabel: String(body.loc?.label || '').trim().slice(0, 160),
})

async function findWithOwner(id) {
  return Find.findById(id).populate('owner grabbedBy owner', 'name handle initials color')
}

async function dtoWithUser(doc, viewerId, opts = {}) {
  const users = opts.users
  const owner = users ? users[String(doc.owner?._id || doc.owner)] : null
  return toDto(doc, owner)
}

// Public reads; mutations require auth.
r.get('/', asyncHandler(async (req, res) => {
  const { type = 'find', q = '', status = 'active', lat, lng, radiusKm, mine } = req.query
  const filter = { type: type === 'trade' ? 'trade' : 'find' }
  if (status && status !== 'all') filter.status = String(status)
  // Private scope: only the signed-in user's own finds. Ownership always comes
  // from the session, never from a query/body value.
  if (mine) {
    if (!req.user) return res.status(401).json({ error: { message: 'You must be signed in.' } })
    filter.owner = req.user._id
  }

  let nearby = false
  const hasLat = lat !== undefined && Number.isFinite(Number(lat))
  const hasLng = lng !== undefined && Number.isFinite(Number(lng))
  if (hasLat && hasLng) {
    const coords = [Number(lng), Number(lat)]
    const radius = Math.max(1, Math.min(500, Number(radiusKm) || 50))
    filter.location = { $geoWithin: { $centerSphere: [coords, radius / 6371] } }
    nearby = true
  }

  const docs = await Find.find(filter)
    .sort(nearby ? { _id: 1 } : { createdAt: -1 })
    .limit(nearby ? 80 : 200)
    .populate('owner', 'name handle initials color')

  const users = {}
  for (const d of docs) {
    const id = String(d.owner?._id || d.owner)
    if (!users[id]) users[id] = publicProfile(d.owner)
  }
  res.json({ finds: docs.map((d) => dtoWithUser(d, req.user?._id, { users })) })
}))

r.post('/', requireAuth, findLimiter, asyncHandler(async (req, res) => {
  const geo = coerceGeo(req.body.geo) || coerceGeo(FALLBACK_GEO)
  const doc = await Find.create({
    ...pick(req.body),
    owner: req.user._id,
    location: { type: 'Point', coordinates: geo },
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    photoUrl: String(req.body.photoUrl || '').slice(0, 500),
  })
  const full = await findWithOwner(doc._id)
  res.status(201).json({ find: toDto(full, publicProfile(full.owner)) })
}))

r.get('/:id', asyncHandler(async (req, res) => {
  const doc = await Find.findById(req.params.id).populate('owner', 'name handle initials color')
  if (!doc) return res.status(404).json({ error: { message: 'Find not found.' } })
  res.json({ find: toDto(doc, publicProfile(doc.owner)) })
}))

const owned = loadOwned(Find, { as: 'find', message: 'Find not found.' })

r.patch('/:id', owned, asyncHandler(async (req, res) => {
  const doc = req.find

  const status = req.body.status
  if (status !== undefined) {
    if (!['active', 'soldout', 'grabbed'].includes(status)) {
      return res.status(400).json({ error: { message: 'Status must be active, soldout or grabbed.' } })
    }
    doc.status = status
    doc.confirmedAt = new Date()
    if (status === 'grabbed') doc.grabbedBy = req.user._id
  }

  const geo = coerceGeo(req.body.geo)
  for (const [k, v] of Object.entries(pick(req.body))) {
    if (req.body[k] !== undefined && req.body[k] !== null) doc[k] = v
  }
  if (geo) doc.location = { type: 'Point', coordinates: geo }
  await doc.save()
  const full = await findWithOwner(doc._id).populate('owner', 'name handle initials color')
  res.json({ find: toDto(full, publicProfile(full.owner)) })
}))

r.delete('/:id', owned, asyncHandler(async (req, res) => {
  await req.find.deleteOne()
  res.json({ ok: true })
}))

export default r