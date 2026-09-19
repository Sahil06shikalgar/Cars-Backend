import { Router } from 'express'
import VaultModel, { toDto } from '../models/VaultModel.js'
import { asyncHandler } from '../middleware/errors.js'
import { requireAuth } from '../middleware/auth.js'
import { loadOwned } from '../middleware/ownership.js'
import { toCents } from '../utils/money.js'

const r = Router()
r.use(requireAuth)

const pick = (body) => ({
  name: body.name,
  brand: body.brand,
  scale: body.scale,
  year: Number(body.year),
  condition: body.condition,
  color: body.color,
  valueCents: toCents(body.value),
  rarity: body.rarity,
  tags: Array.isArray(body.tags) ? body.tags : String(body.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
})

r.get('/', asyncHandler(async (req, res) => {
  const { q = '', scale = 'All', rarity = 'All' } = req.query
  const filter = { owner: req.user._id }
  if (q) {
    const safe = String(q).slice(0, 80)
    filter.$or = [
      { name: { $regex: safe, $options: 'i' } },
      { brand: { $regex: safe, $options: 'i' } },
      { tags: { $regex: safe, $options: 'i' } },
    ]
  }
  if (scale && scale !== 'All') filter.scale = String(scale)
  if (rarity && rarity !== 'All') filter.rarity = String(rarity)
  const docs = await VaultModel.find(filter).sort({ createdAt: -1 })
  res.json({ models: docs.map(toDto) })
}))

r.post('/', asyncHandler(async (req, res) => {
  if (!req.body.name || !String(req.body.name).trim()) {
    return res.status(400).json({ error: { message: 'Model name is required.' } })
  }
  const doc = await VaultModel.create({ ...pick(req.body), owner: req.user._id })
  res.status(201).json({ model: toDto(doc) })
}))

const owned = loadOwned(VaultModel, { as: 'model', message: 'Model not found.' })

r.get('/:id', owned, asyncHandler(async (req, res) => {
  res.json({ model: toDto(req.model) })
}))

r.patch('/:id', owned, asyncHandler(async (req, res) => {
  const patch = pick(req.body)
  for (const key of Object.keys(patch)) {
    if (patch[key] === undefined) delete patch[key]
  }
  Object.assign(req.model, patch)
  await req.model.save()
  res.json({ model: toDto(req.model) })
}))

r.delete('/:id', owned, asyncHandler(async (req, res) => {
  await req.model.deleteOne()
  res.json({ ok: true, id: String(req.model._id) })
}))

r.post('/:id/photo', owned, asyncHandler(async (req, res) => {
  const url = (req.body && req.body.photoUrl) || ''
  if (!url) return res.status(400).json({ error: { message: 'photoUrl is required.' } })
  req.model.photoUrl = String(url).slice(0, 500)
  await req.model.save()
  res.json({ model: toDto(req.model) })
}))

export default r