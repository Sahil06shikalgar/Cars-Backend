import { Router } from 'express'
import WishlistItem, { toDto } from '../models/Wishlist.js'
import Auction from '../models/Auction.js'
import Find from '../models/Find.js'
import { asyncHandler } from '../middleware/errors.js'
import { requireAuth } from '../middleware/auth.js'
import { loadOwned } from '../middleware/ownership.js'

const r = Router()
r.use(requireAuth)

const normalize = (v = '') => String(v).toLowerCase().trim().replace(/\s+/g, ' ')

const nameTokens = (v = '') => normalize(v).split(' ').filter((t) => t.length >= 3)

// Server-side twin of the frontend wishlistMatches so live badges are accurate.
export function computeMatches(item, { auctions = [], finds = [] } = {}) {
  const want = normalize(item.name)
  const tokens = nameTokens(item.name)
  const wantBrand = normalize(item.brand)
  const wantScale = normalize(item.scale)
  const out = { auction: null, finds: [] }

  for (const a of auctions) {
    const m = a.model || {}
    const brandOk = !wantBrand || (normalize(m.brand) === wantBrand)
    const scaleOk = !wantScale || normalize(m.scale) === wantScale
    const an = normalize(m.name)
    const nameOk = !!want && Boolean(
      want === an ||
      (want.length >= 4 && (want.includes(an) || an.includes(want))) ||
      tokens.some((t) => an.includes(t))
    )
    if (brandOk && scaleOk && nameOk) { out.auction = a; break }
  }

  for (const f of finds) {
    const brandOk = !wantBrand || normalize(f.brand) === wantBrand || normalize(f.brand) === 'any'
    const haystack = `${normalize(f.title)} ${normalize(f.brand)}`
    const hit = tokens.some((t) => haystack.includes(t)) || (want.length >= 4 && haystack.includes(want))
    if (brandOk && hit) out.finds.push({ id: String(f._id), title: f.title })
  }
  return out
}

r.get('/', asyncHandler(async (req, res) => {
  const wish = await WishlistItem.find({ owner: req.user._id }).sort({ createdAt: -1 })
  const auctions = await Auction.find({ status: 'active' }).lean()
  const finds = await Find.find({ type: 'find', status: 'active' }).lean()
  const items = wish.map((item) => ({ ...toDto(item), matches: computeMatches(item, { auctions, finds }) }))
  res.json({ wishlist: items })
}))

r.post('/', asyncHandler(async (req, res) => {
  if (!req.body.name || !String(req.body.name).trim()) {
    return res.status(400).json({ error: { message: 'Model name is required.' } })
  }
  const doc = await WishlistItem.create({
    owner: req.user._id,
    name: String(req.body.name).trim().slice(0, 120),
    brand: String(req.body.brand || '').trim().slice(0, 60),
    scale: String(req.body.scale || '1:64').slice(0, 8),
    note: String(req.body.note || '').trim().slice(0, 300),
  })
  res.status(201).json({ item: toDto(doc), matches: { auction: null, finds: [] } })
}))

const owned = loadOwned(WishlistItem, { as: 'wish', message: 'Wishlist item not found.' })

r.patch('/:id', owned, asyncHandler(async (req, res) => {
  const wish = req.wish
  wish.name = String(req.body.name === undefined ? '' : req.body.name).trim().slice(0, 120)
  wish.brand = String(req.body.brand || '').trim().slice(0, 60)
  wish.scale = String(req.body.scale || '1:64').slice(0, 8)
  wish.note = String(req.body.note || '').trim().slice(0, 300)
  await wish.save()
  res.json({ item: toDto(wish) })
}))

r.delete('/:id', owned, asyncHandler(async (req, res) => {
  await req.wish.deleteOne()
  res.json({ ok: true })
}))

export default r