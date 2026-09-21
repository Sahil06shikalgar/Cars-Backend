import Blog from '../models/Blog.js'

export const makeSlug = (text = '') =>
  String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)

// Make a URL-safe slug unique against existing blog rows.
export async function uniqueSlug(seed, existingId = null) {
  const base = makeSlug(seed) || 'article'
  const query = { slug: base }
  if (existingId) query._id = { $ne: existingId }
  let candidate = base
  let n = 2
  while (await Blog.exists(query)) {
    candidate = `${base}-${n}`
    query.slug = candidate
    n += 1
  }
  return candidate
}