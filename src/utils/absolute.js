import { ENV } from '../config/env.js'

// Turn a photo path into an absolute URL against the backend's public base.
// Stored photoUrl values may be relative (`/uploads/...`) or already absolute
// (uploads route returns absolute URLs); the Vite dev/proxy setup works with
// relative paths, but any other client origin needs the full URL.
export const absUrl = (path = '') => {
  if (!path) return ''
  if (/^(https?:)?\/\//i.test(path)) return path
  const base = (ENV.apiBaseUrl || 'http://localhost:5050').replace(/\/+$/, '') + '/'
  return new URL(path, base).href
}