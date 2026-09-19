import { createServer } from 'node:http'
import { mkdirSync } from 'node:fs'
import { ENV, requireEnv } from './config/env.js'
import { buildSessionMiddleware } from './config/session.js'
import { connectDB, disconnectDB } from './config/db.js'
import { buildApp } from './app.js'
import { initSocket } from './socket/index.js'
import { sweep } from './routes/auctions.js'

const mongoUri = requireEnv('MONGODB_URI')

async function main() {
  mkdirSync(ENV.uploadDir, { recursive: true })
  await connectDB(mongoUri)

  const sessionMiddleware = buildSessionMiddleware(mongoUri)
  const app = buildApp({ sessionMiddleware })
  const httpServer = createServer(app)
  initSocket(httpServer, { corsOrigin: ENV.clientOrigin, sessionMiddleware })

  // Auto-close timed-out auctions every 60s.
  const sweepTimer = setInterval(sweep, 60 * 1000)
  sweep()

  httpServer.listen(ENV.port, () => {
    console.log(`[server] listening on http://localhost:${ENV.port}`)
    console.log(`[server] client origin ${ENV.clientOrigin}`)
  })

  const shutdown = async () => {
    clearInterval(sweepTimer)
    httpServer.close()
    await disconnectDB()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error('[server] failed to start:', err.message)
  process.exit(1)
})