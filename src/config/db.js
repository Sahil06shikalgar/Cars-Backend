import mongoose from 'mongoose'
import { ENV } from './env.js'

let connected = false

const SRV_PREFIX = 'mongodb+srv://'
const DIRECT_PREFIX = 'mongodb://'

// DNS / SRV-resolution failures. Atlas clusters are reached through `mongodb+srv://`
// URIs that require a DNS SRV lookup for _mongodb._tcp.<cluster>; some networks,
// VPNs and sandboxes silently refuse those (and sometimes all) queries.
function isDnsError(err) {
  if (!err) return false
  const code = String(err.code || '')
  const msg = String(err.message || '')
  return (
    ['ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ESERVFAIL', 'ECONNREFUSED', 'EADDRNOTAVAIL'].includes(code) ||
    /querySrv|SRV|DNS|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ESERVFAIL|ECONNREFUSED/i.test(msg)
  )
}

// Rewrite a `mongodb+srv://` URI into a direct `mongodb://` URI using an explicit
// list of `host:port` shard addresses (from MONGO_DIRECT_HOSTS). Does not touch
// credentials, keeps the database name and query options, and applies the Atlas
// defaults (ssl on, authSource admin). Returns only the string — never logs it.
export function toDirectUri(uri, hosts) {
  const rest = uri.slice(SRV_PREFIX.length)
  const atIdx = rest.indexOf('@')
  const auth = atIdx === -1 ? '' : rest.slice(0, atIdx + 1) // "user:pass@"
  const tail = atIdx === -1 ? rest : rest.slice(atIdx + 1)
  const slash = tail.indexOf('/')
  const dbPart = slash === -1 ? '' : tail.slice(slash + 1) // "db?opts" | "?opts" | ""
  const hashIdx = dbPart.indexOf('?')
  const db = hashIdx === -1 ? dbPart : dbPart.slice(0, hashIdx)
  const params = new URLSearchParams(hashIdx === -1 ? '' : dbPart.slice(hashIdx + 1))
  params.set('ssl', 'true')
  params.set('authSource', params.get('authSource') || 'admin')
  if (!params.has('retryWrites')) params.set('retryWrites', 'true')
  return `${DIRECT_PREFIX}${auth}${hosts.join(',')}/${db}?${params.toString()}`
}

async function tryConnect(uri) {
  await mongoose.connect(uri)
  connected = true
  console.log('[db] connected to MongoDB')
}

export async function connectDB(uri) {
  if (connected && mongoose.connection.readyState === 1) return
  if (!uri) throw new Error('MONGODB_URI is not set — copy Backend/.env.example to Backend/.env and fill it in (see README).')
  if (!uri.startsWith(SRV_PREFIX) && !uri.startsWith(DIRECT_PREFIX)) {
    throw new Error('MONGODB_URI must start with mongodb:// or mongodb+srv:// — see Backend/.env.example.')
  }
  mongoose.set('strictQuery', true)

  try {
    await tryConnect(uri)
  } catch (err) {
    const srvWithoutFallback = uri.startsWith(SRV_PREFIX) && !ENV.mongoDirectHosts.length
    if (isDnsError(err) && srvWithoutFallback) {
      console.warn(
        '[db] Could not resolve the mongodb+srv:// cluster via DNS (network is refusing SRV lookups). ' +
          'Paste the direct mongodb:// connection string into MONGODB_URI, or set MONGO_DIRECT_HOSTS to the ' +
          'shard hosts from Atlas so the server can retry without SRV.'
      )
      throw err
    }
    if (isDnsError(err) && uri.startsWith(SRV_PREFIX) && ENV.mongoDirectHosts.length) {
      console.warn('[db] SRV lookup blocked — retrying via direct mongodb:// addresses from MONGO_DIRECT_HOSTS.')
      try {
        await tryConnect(toDirectUri(uri, ENV.mongoDirectHosts))
        return
      } catch (directErr) {
        throw directErr
      }
    }
    throw err
  }
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
}

export function isObjectId(value) {
  return mongoose.isValidObjectId(String(value))
}

export const objectId = (value) => new mongoose.Types.ObjectId(String(value))