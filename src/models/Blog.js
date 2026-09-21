import mongoose from 'mongoose'
import { absUrl } from '../utils/absolute.js'

const blogSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 200 },
    excerpt: { type: String, required: true, trim: true, maxlength: 300 },
    coverUrl: { type: String, default: '' },
    category: { type: String, default: 'Guides', trim: true, maxlength: 40 },
    tags: { type: [String], default: [] },
    // Body stored as an array of paragraphs so the client renders plain text
    // without any markdown parsing.
    body: { type: [String], default: [] },
    readMinutes: { type: Number, default: 3, min: 1, max: 120 },
    featured: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
  },
  { timestamps: true }
)

blogSchema.index({ published: 1, createdAt: -1 })
blogSchema.index({ published: 1, category: 1 })

export const toDto = (blog, authorProfile = null) => ({
  id: String(blog._id),
  slug: blog.slug,
  title: blog.title,
  excerpt: blog.excerpt,
  coverUrl: absUrl(blog.coverUrl),
  category: blog.category,
  tags: blog.tags || [],
  body: blog.body || [],
  readMinutes: blog.readMinutes,
  featured: Boolean(blog.featured),
  views: blog.views || 0,
  published: Boolean(blog.published),
  authorId: blog.author ? String(blog.author._id || blog.author) : '',
  author: authorProfile || null,
  ts: new Date(blog.createdAt).getTime(),
})

const Blog = mongoose.model('Blog', blogSchema)
export default Blog