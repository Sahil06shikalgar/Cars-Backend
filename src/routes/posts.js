import { Router } from 'express'
import Post, { toDto } from '../models/Post.js'
import Comment from '../models/Comment.js'
import Auction from '../models/Auction.js'
import { asyncHandler, AppError } from '../middleware/errors.js'
import { requireAuth } from '../middleware/auth.js'
import { postLimiter } from '../middleware/rateLimit.js'
import { publicProfile } from '../models/User.js'

const r = Router()

// Feed: public community read; liking/posting/commenting needs an account.
r.get('/', asyncHandler(async (req, res) => {
  const posts = await Post.find({}).sort({ createdAt: -1 }).limit(80).populate('author', 'name handle initials color city bio createdAt')
  const userIds = {}
  for (const p of posts) {
    const id = String(p.author?._id || p.author)
    userIds[id] = publicProfile(p.author)
  }
  res.json({ posts: posts.map((p) => toDto(p, userIds[String(p.author._id || p.author)], req.user?._id)) })
}))

r.post('/', requireAuth, postLimiter, asyncHandler(async (req, res) => {
  const content = String(req.body.content || '').trim()
  if (content.length < 1) return res.status(400).json({ error: { message: 'Post content is required.' } })
  const post = await Post.create({
    author: req.user._id,
    community: req.body.community || 'Berlin Trade Circle',
    content: content.slice(0, 1500),
    auctionId: req.body.auctionId || null,
  })
  const full = await post.populate('author', 'name handle initials color city bio createdAt')
  res.status(201).json({ post: toDto(full, publicProfile(full.author), req.user._id) })
}))

r.post('/:id/like', requireAuth, asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id)
  if (!post) return res.status(404).json({ error: { message: 'Post not found.' } })
  const me = String(req.user._id)
  const idx = (post.likes || []).findIndex((id) => String(id) === me)
  if (idx >= 0) post.likes.splice(idx, 1)
  else post.likes.push(req.user._id)
  await post.save()
  res.json({ id: String(post._id), likes: post.likes.length, liked: idx < 0 })
}))

r.get('/:id/comments', asyncHandler(async (req, res) => {
  const comments = await Comment.find({ post: req.params.id }).sort({ createdAt: 1 }).populate('author', 'name handle initials color city bio createdAt')
  const users = {}
  for (const c of comments) {
    const id = String(c.author?._id || c.author)
    users[id] = publicProfile(c.author)
  }
  res.json({ comments: comments.map((c) => ({ ...c.toObject(), author: users[String(c.author._id || c.author)] || null })) })
}))

r.post('/:id/comments', requireAuth, postLimiter, asyncHandler(async (req, res) => {
  const content = String(req.body.content || '').trim()
  if (content.length < 1) return res.status(400).json({ error: { message: 'Comment is required.' } })
  const post = await Post.findById(req.params.id)
  if (!post) return res.status(404).json({ error: { message: 'Post not found.' } })
  const comment = await Comment.create({ post: post._id, author: req.user._id, content: content.slice(0, 600) })
  post.commentCount = (post.commentCount || 0) + 1
  await post.save()
  await comment.populate('author', 'name handle initials color')
  res.status(201).json({ comment: toDto(comment, publicProfile(comment.author)) })
}))

r.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id })
  if (!post) return res.status(404).json({ error: { message: 'Post not found.' } })
  if (String(post.author) !== String(req.user._id)) {
    return res.status(403).json({ error: { message: 'You can only delete your own posts.' } })
  }
  await post.deleteOne()
  await Comment.deleteMany({ post: post._id })
  res.json({ ok: true })
}))

export default r