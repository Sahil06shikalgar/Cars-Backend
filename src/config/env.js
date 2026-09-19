import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

export const ENV = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  isTest: (process.env.NODE_ENV || 'development') === 'test',
  port: Number(process.env.PORT) || 5050,
  mongoUri: process.env.MONGODB_URI || '',
  // When SRV lookups are blocked by the network, these host:port addresses let the
  // server retry a mongodb+srv:// string as a direct mongodb:// connection.
  mongoDirectHosts: (process.env.MONGO_DIRECT_HOSTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  // Extra allowed CORS origins besides CLIENT_ORIGIN (comma separated). Any
  // *.vercel.app origin is also allowed so a deployed frontend always connects.
  clientOrigins: (process.env.CLIENT_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-insecure-secret-change-me',
  secureCookies: String(process.env.SECURE_COOKIES) === 'true',
  apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${Number(process.env.PORT) || 5050}`,
  uploadDir: path.resolve(rootDir, process.env.UPLOAD_DIR || 'uploads'),
  rootDir,
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/api/auth/google/callback`,
}

export function requireEnv(name) {
  if (!process.env[name]) {
    throw new Error(`Missing ${name} in .env (see .env.example)`)
  }
  return process.env[name]
}