import crypto from 'node:crypto'

const AVATAR_COLORS = [
  '#ff5a3c', '#2e9fff', '#a06bff', '#ffc24b',
  '#2fe08a', '#5fd0ff', '#ff7aa8', '#ff6b81', '#b3ff5c', '#00c2a8',
]

export const randomId = (prefix = '') => prefix + crypto.randomBytes(8).toString('hex')

export const makeHandle = (name = '') => {
  const base = (name || 'collector').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'collector'
  return `@${base}${crypto.randomBytes(2).toString('hex')}`
}

export const makeInitials = (name = '') =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

export const pickColor = (seed = '') => {
  let hash = 0
  for (const ch of String(seed)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export const randomToken = () => crypto.randomBytes(32).toString('hex')
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')