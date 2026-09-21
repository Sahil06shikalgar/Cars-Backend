import { Router } from 'express'
import Blog, { toDto } from '../models/Blog.js'
import { USER_PROFILE_SELECT, publicProfile } from '../models/User.js'
import { asyncHandler, AppError } from '../middleware/errors.js'
import { requireAuth } from '../middleware/auth.js'
import { postLimiter } from '../middleware/rateLimit.js'
import { makeSlug, uniqueSlug } from '../utils/slug.js'

const r = Router()

const authorIndex = (blogs) => {
  const authors = {}
  for (const b of blogs) {
    const id = String(b.author?._id || b.author || '')
    if (id) authors[id] = publicProfile(b.author)
  }
  return authors
}

// Public: every published article (newest first, featured pinned on top).
r.get('/', asyncHandler(async (req, res) => {
  const blogs = await Blog.find({ published: true })
    .sort({ featured: -1, createdAt: -1 })
    .limit(40)
    .populate('author', USER_PROFILE_SELECT)
  const authors = authorIndex(blogs)
  res.json({ blogs: blogs.map((b) => toDto(b, authors[String(b.author?._id || b.author)] || null)) })
}))

// Public: single article, bumps the read counter.
r.get('/:slug', asyncHandler(async (req, res) => {
  const blog = await Blog.findOne({ slug: req.params.slug, published: true }).populate('author', USER_PROFILE_SELECT)
  if (!blog) throw new AppError(404, 'Article not found.')
  blog.views = (blog.views || 0) + 1
  await blog.save()
  res.json({ blog: toDto(blog, publicProfile(blog.author)) })
}))

// Writing an article needs an account (demo: any signed-in user is an editor).
r.post('/', requireAuth, postLimiter, asyncHandler(async (req, res) => {
  const title = String(req.body.title || '').trim()
  const body = (Array.isArray(req.body.body) ? req.body.body : [String(req.body.body || '')])
    .map((s) => String(s).trim())
    .filter(Boolean)
  if (title.length < 3) return res.status(400).json({ error: { message: 'A title of at least 3 characters is required.' } })
  if (body.length === 0) return res.status(400).json({ error: { message: 'The article needs at least one paragraph.' } })

  const slug = await uniqueSlug(makeSlug(req.body.slug) || title)
  const blog = await Blog.create({
    author: req.user._id,
    title: title.slice(0, 160),
    slug,
    excerpt: String(req.body.excerpt || '').trim().slice(0, 300),
    coverUrl: String(req.body.coverUrl || '').trim(),
    category: (String(req.body.category || 'Guides').trim().slice(0, 40)) || 'Guides',
    tags: Array.isArray(req.body.tags)
      ? req.body.tags.map((t) => String(t).trim().toLowerCase()).filter((t) => t.length <= 32).slice(0, 8)
      : [],
    body: body.map((s) => s.slice(0, 5000)).slice(0, 120),
    readMinutes: Math.max(1, Math.min(120, Number(req.body.readMinutes) || 3)),
    featured: Boolean(req.body.featured),
    published: req.body.published !== false,
  })
  res.status(201).json({ blog: toDto(blog, publicProfile(req.user)) })
}))

// Only the author can edit.
r.patch('/:id', requireAuth, postLimiter, asyncHandler(async (req, res) => {
  const blog = await Blog.findById(req.params.id)
  if (!blog) throw new AppError(404, 'Article not found.')
  if (String(blog.author) !== String(req.user._id)) {
    throw new AppError(403, 'You can only edit articles you wrote.')
  }
  const patch = {}
  if (req.body.title !== undefined) {
    const title = String(req.body.title).trim()
    if (title.length < 3) return res.status(400).json({ error: { message: 'A title of at least 3 characters is required.' } })
    patch.title = title.slice(0, 160)
    if (req.body.slug !== undefined) patch.slug = await uniqueSlug(String(req.body.slug), blog._id)
  }
  if (req.body.excerpt !== undefined) patch.excerpt = String(req.body.excerpt).trim().slice(0, 300)
  if (req.body.coverUrl !== undefined) patch.coverUrl = String(req.body.coverUrl).trim()
  if (req.body.category !== undefined) patch.category = String(req.body.category).trim().slice(0, 40) || 'Guides'
  if (req.body.fullBody !== undefined || (Array.isArray(req.body.body))) {
    const body = (Array.isArray(req.body.body) ? req.body.body : [String(req.body.body || '')])
      .map((s) => String(s).trim()).filter(Boolean)
    if (body.length === 0) return res.status(400).json({ error: { message: 'The article needs at least one paragraph.' } })
    patch.body = body.map((s) => s.slice(0, 5000)).slice(0, 120)
  }
  if (req.body.tags !== undefined) {
    patch.tags = Array.isArray(req.body.tags)
      ? req.body.tags.map((t) => String(t).trim().toLowerCase()).filter((t) => t.length <= 32).slice(0, 8)
      : []
  }
  if (req.body.readMinutes !== undefined) patch.readMinutes = Math.max(1, Math.min(120, Number(req.body.readMinutes) || 3))
  if (req.body.featured !== undefined) patch.featured = Boolean(req.body.featured)
  if (req.body.published !== undefined) patch.published = Boolean(req.body.published)

  Object.assign(blog, patch)
  await blog.save()
  res.json({ blog: toDto(blog, publicProfile(req.user)) })
}))

r.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const blog = await Blog.findById(req.params.id)
  if (!blog) throw new AppError(404, 'Article not found.')
  if (String(blog.author) !== String(req.user._id)) {
    throw new AppError(403, 'You can only delete articles you wrote.')
  }
  await blog.deleteOne()
  res.json({ ok: true })
}))

export default r